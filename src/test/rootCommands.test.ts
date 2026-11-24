import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { registerCommands } from "../commandRegistration";
import { Command } from "../commands";
import { ConfigService } from "../todos/configService";
import type { CanvasViewer } from "../todos/canvasViewer";
import type { BusyIndicator } from "../busyIndicator";
import { ROOT_REGISTRY_KEY, TodoRootRegistry } from "../todos/rootRegistry";
import type { CommandServices } from "../commandRegistration";
import type { TodoRepository } from "../todos/todoRepository";

function makeFolder(name: string, fsPath: string): vscode.WorkspaceFolder {
  return { name, uri: vscode.Uri.file(fsPath), index: 0 } as unknown as vscode.WorkspaceFolder;
}

function makeMemento(): vscode.Memento {
  const store: Record<string, unknown> = {};
  return {
    get: <T>(key: string) => store[key] as T | undefined,
    update: async (_key: string, value: unknown) => {
      store[_key] = value;
    },
  } as unknown as vscode.Memento;
}

function mockWorkspaceFolders(folders: vscode.WorkspaceFolder[]): () => void {
  const original = vscode.workspace.workspaceFolders;
  Object.defineProperty(vscode.workspace, "workspaceFolders", {
    value: folders,
    configurable: true,
  });
  return () => {
    Object.defineProperty(vscode.workspace, "workspaceFolders", {
      value: original,
      configurable: true,
    });
  };
}

function mockGetConfiguration(config: {
  get: (key: string) => unknown;
  update: (key: string, value: unknown) => PromiseLike<void>;
  inspect: (key: string) => {
    workspaceFolderValue?: unknown;
    workspaceValue?: unknown;
    globalValue?: unknown;
  } | undefined;
}): () => void {
  const original = vscode.workspace.getConfiguration;
  Object.defineProperty(vscode.workspace, "getConfiguration", {
    value: () => config as unknown as vscode.WorkspaceConfiguration,
    configurable: true,
  });
  return () => {
    Object.defineProperty(vscode.workspace, "getConfiguration", {
      value: original,
      configurable: true,
    });
  };
}

function mock(target: object, key: string, value: unknown) {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, value });
  return () => {
    if (descriptor) Object.defineProperty(target, key, descriptor);
  };
}

suite("root commands", () => {
  const restores: Array<() => void> = [];

  teardown(() => {
    for (const restore of restores.reverse()) restore();
    restores.length = 0;
  });

  async function setupCommands(memento: vscode.Memento, registry?: TodoRootRegistry) {
    const captured: Array<{ command: string; callback: (...args: any[]) => any }> = [];
    const canvasOpenCalls: Array<unknown[]> = [];
    const canvasSettingsCalls: Array<unknown[]> = [];
    const restoreRegister = mock(vscode.commands, "registerCommand", (id: string, callback: () => Promise<void>) => {
      captured.push({ command: id, callback });
      return new vscode.Disposable(() => {});
    });
    restores.push(restoreRegister);

    const config = new ConfigService(memento);
    const rebindRootCalls: Array<unknown> = [];
    const repository = {
      getTodos: () => [],
      refresh: async () => {},
      rebindRoot: async () => {
        rebindRootCalls.push(undefined);
      },
    } as unknown as TodoRepository;

    const busy = {
      run: async <T>(
        _label: string,
        operation: () => Promise<T>,
        _contextKey?: string,
        _todoId?: string,
      ): Promise<T> => operation(),
    } as unknown as BusyIndicator;

    const canvasViewer = {
      open: async (...args: unknown[]) => {
        canvasOpenCalls.push(args);
      },
      openSettings: async (...args: unknown[]) => {
        canvasSettingsCalls.push(args);
      },
    } as unknown as CanvasViewer;

    // One shared root registry, as the extension host would pass it.
    const registryToUse = registry ?? new TodoRootRegistry(config, memento);

    const context: any = {
      subscriptions: [],
      workspaceState: memento,
    };
    registerCommands(
      context,
      { config, repository, rootRegistry: registryToUse, canvasViewer, busy } as CommandServices,
    );
    return { captured, config, repository, registry: registryToUse, rebindRootCalls, canvasOpenCalls, canvasSettingsCalls };
  }

  test("ChooseRoot lists workspace and manual roots and activates the selected root", async () => {
    const folder = makeFolder("folder-a", "/path/a");
    const restoreFolders = mockWorkspaceFolders([folder]);
    restores.push(restoreFolders);

    const restoreConfig = mockGetConfiguration({
      get: () => undefined,
      update: () => Promise.resolve(),
      inspect: () => ({ workspaceFolderValue: "docs/todos" }),
    });
    restores.push(restoreConfig);

    const memento = makeMemento();
    const manualDir = "/path/manual/root";
    memento.update(ROOT_REGISTRY_KEY, [{ uri: manualDir, label: "Manual Root" }]);

    const { captured, config, rebindRootCalls } = await setupCommands(memento);
    const chooseRoot = captured.find((c) => c.command === Command.ChooseRoot)?.callback;
    assert.ok(chooseRoot, "ChooseRoot callback should be registered");

    let picked: vscode.QuickPickItem | undefined;
    let capturedItems: vscode.QuickPickItem[] = [];
    const restorePick = mock(vscode.window, "showQuickPick", async (
      items: vscode.QuickPickItem[],
      _options?: any,
    ) => {
      capturedItems = items;
      picked = items.find((i) => i.label === "Manual Root");
      return picked;
    });
    restores.push(restorePick);

    await chooseRoot();

    // The active root is identified in the picker.
    const activeItem = capturedItems.find((i) => i.picked);
    assert.ok(activeItem, "Active root should be marked as picked");
    assert.strictEqual(activeItem?.label, "todos");

    // Selecting the manual root activates it via the registry.
    assert.strictEqual(config.getManualRoot()?.fsPath, manualDir);
    assert.strictEqual(rebindRootCalls.length, 1, "repository.rebindRoot should be called");
  });

  test("ChooseRoot activates a workspace root and clears the manual override", async () => {
    const folder = makeFolder("folder-a", "/path/a");
    const restoreFolders = mockWorkspaceFolders([folder]);
    restores.push(restoreFolders);

    const restoreConfig = mockGetConfiguration({
      get: () => undefined,
      update: () => Promise.resolve(),
      inspect: () => ({ workspaceFolderValue: "docs/todos" }),
    });
    restores.push(restoreConfig);

    const memento = makeMemento();
    const manualDir = "/path/manual/root";
    memento.update(ROOT_REGISTRY_KEY, [{ uri: manualDir, label: "Manual Root" }]);
    // Persist the manual root as active so the registry restores it.
    memento.update("agendo.activeRootId", manualDir);

    const { captured, config, rebindRootCalls } = await setupCommands(memento);
    const chooseRoot = captured.find((c) => c.command === Command.ChooseRoot)?.callback;
    assert.ok(chooseRoot);

    let picked: vscode.QuickPickItem | undefined;
    const restorePick = mock(vscode.window, "showQuickPick", async (
      items: vscode.QuickPickItem[],
      _options?: any,
    ) => {
      picked = items.find((i) => i.label === "todos");
      return picked;
    });
    restores.push(restorePick);

    await chooseRoot();

    // Selecting the workspace root clears the manual override.
    assert.strictEqual(config.getManualRoot(), undefined);
    assert.strictEqual(config.getWorkspaceFolder(), folder);
    assert.strictEqual(rebindRootCalls.length, 1);
  });

  test("AddManualRoot registers and activates the new manual root", async () => {
    const restoreFolders = mockWorkspaceFolders([]);
    restores.push(restoreFolders);

    const restoreConfig = mockGetConfiguration({
      get: () => undefined,
      update: () => Promise.resolve(),
      inspect: () => undefined,
    });
    restores.push(restoreConfig);

    const memento = makeMemento();
    const { captured, config, rebindRootCalls } = await setupCommands(memento);
    const addManualRoot = captured.find((c) => c.command === Command.AddManualRoot)?.callback;
    assert.ok(addManualRoot);

    // Use a real temporary directory so the command's fs.stat check exercises
    // the actual filesystem instead of redefining the non-configurable
    // vscode.workspace.fs.stat.
    const manualDir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-manual-"));
    restores.push(() => fs.rm(manualDir, { recursive: true, force: true }));
    const uri = vscode.Uri.file(manualDir);

    let openResult: vscode.Uri[] | undefined;
    const restoreOpen = mock(vscode.window, "showOpenDialog", async (_options: any) => {
      openResult = [uri];
      return openResult;
    });
    restores.push(restoreOpen);

    let labelResult: string | undefined;
    const restoreInput = mock(vscode.window, "showInputBox", async (_options: any) => {
      labelResult = "Manual Root";
      return labelResult;
    });
    restores.push(restoreInput);

    await addManualRoot();

    // The new root is registered and activated.
    assert.strictEqual(config.getManualRoot()?.fsPath, manualDir);
    assert.strictEqual(rebindRootCalls.length, 1);
  });

  test("RemoveManualRoot preserves active root when removing an inactive root", async () => {
    const folder = makeFolder("folder-a", "/path/a");
    const restoreFolders = mockWorkspaceFolders([folder]);
    restores.push(restoreFolders);

    const restoreConfig = mockGetConfiguration({
      get: () => undefined,
      update: () => Promise.resolve(),
      inspect: () => ({ workspaceFolderValue: "docs/todos" }),
    });
    restores.push(restoreConfig);

    const memento = makeMemento();
    const manualDir = "/path/manual/root";
    memento.update(ROOT_REGISTRY_KEY, [{ uri: manualDir, label: "Manual Root" }]);
    // Workspace root is active by default (first root).
    const { captured, config, rebindRootCalls } = await setupCommands(memento);
    const removeManualRoot = captured.find((c) => c.command === Command.RemoveManualRoot)?.callback;
    assert.ok(removeManualRoot);

    let picked: vscode.QuickPickItem | undefined;
    const restorePick = mock(vscode.window, "showQuickPick", async (
      items: vscode.QuickPickItem[],
      _options?: any,
    ) => {
      picked = items.find((i) => i.label === `Manual Root (${manualDir})`);
      return picked;
    });
    restores.push(restorePick);

    await removeManualRoot();

    // The manual root is removed from the registry.
    const records = memento.get(ROOT_REGISTRY_KEY) as unknown[];
    assert.deepStrictEqual(records, []);

    // Active selection/config is preserved (workspace root stays active).
    assert.strictEqual(config.getWorkspaceFolder(), folder);
    assert.strictEqual(config.getManualRoot(), undefined);
    assert.strictEqual(rebindRootCalls.length, 1);
  });

  test("RemoveManualRoot falls back to the workspace root when removing the active manual root", async () => {
    const folder = makeFolder("folder-a", "/path/a");
    const restoreFolders = mockWorkspaceFolders([folder]);
    restores.push(restoreFolders);

    const restoreConfig = mockGetConfiguration({
      get: () => undefined,
      update: () => Promise.resolve(),
      inspect: () => ({ workspaceFolderValue: "docs/todos" }),
    });
    restores.push(restoreConfig);

    const memento = makeMemento();
    const manualDir = "/path/manual/root";
    memento.update(ROOT_REGISTRY_KEY, [{ uri: manualDir, label: "Manual Root" }]);
    // Persist the manual root as active.
    memento.update("agendo.activeRootId", manualDir);

    const { captured, config, rebindRootCalls } = await setupCommands(memento);
    const removeManualRoot = captured.find((c) => c.command === Command.RemoveManualRoot)?.callback;
    assert.ok(removeManualRoot);

    let picked: vscode.QuickPickItem | undefined;
    const restorePick = mock(vscode.window, "showQuickPick", async (
      items: vscode.QuickPickItem[],
      _options?: any,
    ) => {
      picked = items.find((i) => i.label === `Manual Root (${manualDir})`);
      return picked;
    });
    restores.push(restorePick);

    await removeManualRoot();

    // The manual root is removed.
    const records = memento.get(ROOT_REGISTRY_KEY) as unknown[];
    assert.deepStrictEqual(records, []);

    // The registry fell back to the workspace root and synchronized ConfigService.
    assert.strictEqual(config.getWorkspaceFolder(), folder);
    assert.strictEqual(config.getManualRoot(), undefined);
    assert.strictEqual(rebindRootCalls.length, 1);
  });

  test("RemoveManualRoot clears the root when no roots remain", async () => {
    const restoreFolders = mockWorkspaceFolders([]);
    restores.push(restoreFolders);

    const restoreConfig = mockGetConfiguration({
      get: () => undefined,
      update: () => Promise.resolve(),
      inspect: () => undefined,
    });
    restores.push(restoreConfig);

    const memento = makeMemento();
    const manualDir = "/path/manual/root";
    memento.update(ROOT_REGISTRY_KEY, [{ uri: manualDir, label: "Manual Root" }]);
    memento.update("agendo.activeRootId", manualDir);

    const { captured, config, rebindRootCalls } = await setupCommands(memento);
    const removeManualRoot = captured.find((c) => c.command === Command.RemoveManualRoot)?.callback;
    assert.ok(removeManualRoot);

    let picked: vscode.QuickPickItem | undefined;
    const restorePick = mock(vscode.window, "showQuickPick", async (
      items: vscode.QuickPickItem[],
      _options?: any,
    ) => {
      picked = items.find((i) => i.label === `Manual Root (${manualDir})`);
      return picked;
    });
    restores.push(restorePick);

    await removeManualRoot();

    // No roots remain: manual/active root is cleared without touching files.
    assert.strictEqual(config.getManualRoot(), undefined);
    assert.strictEqual(config.getWorkspaceFolder(), undefined);
    const records = memento.get(ROOT_REGISTRY_KEY) as unknown[];
    assert.deepStrictEqual(records, []);
    assert.strictEqual(memento.get("agendo.activeRootId"), undefined);
    assert.strictEqual(rebindRootCalls.length, 1);
  });

  test("ChooseRoot shows an information message when no roots are available", async () => {
    const restoreFolders = mockWorkspaceFolders([]);
    restores.push(restoreFolders);

    const restoreConfig = mockGetConfiguration({
      get: () => undefined,
      update: () => Promise.resolve(),
      inspect: () => undefined,
    });
    restores.push(restoreConfig);

    const memento = makeMemento();
    const { captured } = await setupCommands(memento);
    const chooseRoot = captured.find((c) => c.command === Command.ChooseRoot)?.callback;
    assert.ok(chooseRoot);

    let message: string | undefined;
    const restoreInfo = mock(vscode.window, "showInformationMessage", (msg: string) => {
      message = msg;
    });
    restores.push(restoreInfo);

    await chooseRoot();

    assert.strictEqual(message, "No roots available.");
  });

  test("ToggleTreeMode switches between single and multi and persists per workspace", async () => {
    const folder = makeFolder("folder-a", "/path/a");
    const restoreFolders = mockWorkspaceFolders([folder]);
    restores.push(restoreFolders);

    const restoreConfig = mockGetConfiguration({
      get: () => undefined,
      update: () => Promise.resolve(),
      inspect: () => ({ workspaceFolderValue: "docs/todos" }),
    });
    restores.push(restoreConfig);

    const memento = makeMemento();
    const { captured, registry } = await setupCommands(memento);
    const toggleTreeMode = captured.find((c) => c.command === Command.ToggleTreeMode)?.callback;
    assert.ok(toggleTreeMode, "ToggleTreeMode callback should be registered");

    // Default is single.
    assert.strictEqual(registry.getMode(), "single");

    // Toggle to multi.
    await toggleTreeMode();
    assert.strictEqual(registry.getMode(), "multi");
    assert.strictEqual(memento.get("agendo.treeMode"), "multi");

    // Toggle back to single.
    await toggleTreeMode();
    assert.strictEqual(registry.getMode(), "single");
    assert.strictEqual(memento.get("agendo.treeMode"), "single");
  });

  test("OpenPreview operates on the owning root's config when IDs collide across roots", async () => {
    const dir1 = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-preview1-"));
    const dir2 = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-preview2-"));
    restores.push(() => fs.rm(dir1, { recursive: true, force: true }));
    restores.push(() => fs.rm(dir2, { recursive: true, force: true }));

    const rootDir1 = path.join(dir1, "docs", "todos");
    const rootDir2 = path.join(dir2, "docs", "todos");
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(rootDir1));
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(rootDir2));

    const todoContent = "---\nstatus: pending\n---\n# Test Todo\n\nBody";
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(path.join(rootDir1, "001-pending-p3-test.md")),
      Buffer.from(todoContent, "utf8"),
    );
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(path.join(rootDir2, "001-pending-p3-test.md")),
      Buffer.from(todoContent, "utf8"),
    );

    const folder1 = makeFolder("root1", dir1);
    const folder2 = makeFolder("root2", dir2);
    const restoreFolders = mockWorkspaceFolders([folder1, folder2]);
    restores.push(restoreFolders);

    const restoreConfig = mockGetConfiguration({
      get: () => undefined,
      update: () => Promise.resolve(),
      inspect: () => ({ workspaceFolderValue: "docs/todos" }),
    });
    restores.push(restoreConfig);

    const memento = makeMemento();
    const config = new ConfigService(memento);
    const registry = new TodoRootRegistry(config, memento);
    const contexts = registry.getContexts();
    for (const ctx of contexts) {
      await ctx.repository.refresh();
    }

    const { captured } = await setupCommands(memento, registry);

    const todoUri1 = vscode.Uri.file(path.join(rootDir1, "001-pending-p3-test.md"));
    const treeItem = new vscode.TreeItem("001 · Test Todo");
    treeItem.resourceUri = todoUri1;
    treeItem.id = `todo:${todoUri1.toString()}`;

    const openCalls: [string, unknown][] = [];
    const restoreExecute = mock(vscode.commands, "executeCommand", async (_command: string, ...args: unknown[]) => {
      openCalls.push([_command, ...args] as [string, unknown]);
      return undefined;
    });
    restores.push(restoreExecute);

    const openPreview = captured.find((c) => c.command === Command.OpenPreview)?.callback;
    assert.ok(openPreview);

    await openPreview(treeItem);

    // vscode.open (default mode) or markdown.showPreview (preview mode) should
    // be called with the owning root's todo URI.
    const openCall = openCalls.find(([cmd]) => cmd === "vscode.open" || cmd === "markdown.showPreview");
    assert.ok(openCall);
    assert.strictEqual(openCall[1]?.toString(), todoUri1.toString());
  });

  test("SetStatus with a stale TreeItem (todo not in any root) is a safe no-op", async () => {
    const folder = makeFolder("folder-a", "/path/a");
    const restoreFolders = mockWorkspaceFolders([folder]);
    restores.push(restoreFolders);

    const restoreConfig = mockGetConfiguration({
      get: () => undefined,
      update: () => Promise.resolve(),
      inspect: () => ({ workspaceFolderValue: "docs/todos" }),
    });
    restores.push(restoreConfig);

    const memento = makeMemento();
    const { captured } = await setupCommands(memento);

    const setStatus = captured.find((c) => c.command === `agendo.setStatus.${"pending"}`)?.callback;
    assert.ok(setStatus);

    // A TreeItem with a URI that matches no todo in any root.
    const staleItem = new vscode.TreeItem("Stale");
    staleItem.resourceUri = vscode.Uri.file("/path/nonexistent/todo.md");
    staleItem.id = `todo:${staleItem.resourceUri.toString()}`;

    let message: string | undefined;
    const restoreError = mock(vscode.window, "showErrorMessage", (msg: string) => {
      message = msg;
    });
    restores.push(restoreError);

    await setStatus(staleItem);

    // Safe no-op: no error shown, no state change.
    assert.strictEqual(message, undefined);
  });

  test("OpenBoard opens the board for the active manual root in manual mode", async () => {
    const manualDir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-manual-board-"));
    restores.push(() => fs.rm(manualDir, { recursive: true, force: true }));

    const memento = makeMemento();
    memento.update(ROOT_REGISTRY_KEY, [{ uri: manualDir, label: "Manual Root" }]);
    memento.update("agendo.activeRootId", manualDir);

    const { captured, canvasOpenCalls } = await setupCommands(memento);
    const openBoard = captured.find((c) => c.command === Command.OpenBoard)?.callback;
    assert.ok(openBoard, "OpenBoard callback should be registered");

    await openBoard();

    assert.strictEqual(canvasOpenCalls.length, 1, "canvasViewer.open should be called once");
    assert.strictEqual(canvasOpenCalls[0][0], manualDir, "Board should open against the manual root path");
    assert.strictEqual(canvasOpenCalls[0][3], "manual", "Board should open in manual root mode");
  });

  test("OpenBoard opens the board for the active workspace root in workspace mode", async () => {
    const folder = makeFolder("folder-a", "/path/a");
    const restoreFolders = mockWorkspaceFolders([folder]);
    restores.push(restoreFolders);

    const restoreConfig = mockGetConfiguration({
      get: () => undefined,
      update: () => Promise.resolve(),
      inspect: () => ({ workspaceFolderValue: "docs/todos" }),
    });
    restores.push(restoreConfig);

    const memento = makeMemento();
    const { captured, canvasOpenCalls } = await setupCommands(memento);
    const openBoard = captured.find((c) => c.command === Command.OpenBoard)?.callback;
    assert.ok(openBoard, "OpenBoard callback should be registered");

    await openBoard();

    assert.strictEqual(canvasOpenCalls.length, 1, "canvasViewer.open should be called once");
    assert.strictEqual(canvasOpenCalls[0][0], "/path/a", "Board should open against the workspace folder path");
    assert.strictEqual(canvasOpenCalls[0][3], "workspace", "Board should open in workspace root mode");
  });

  test("ShowDigest opens the digest for the active manual root in manual mode", async () => {
    const manualDir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-manual-digest-"));
    restores.push(() => fs.rm(manualDir, { recursive: true, force: true }));

    const memento = makeMemento();
    memento.update(ROOT_REGISTRY_KEY, [{ uri: manualDir, label: "Manual Root" }]);
    memento.update("agendo.activeRootId", manualDir);

    const { captured, canvasOpenCalls } = await setupCommands(memento);
    const showDigest = captured.find((c) => c.command === Command.ShowDigest)?.callback;
    assert.ok(showDigest, "ShowDigest callback should be registered");

    await showDigest();

    assert.strictEqual(canvasOpenCalls.length, 1, "canvasViewer.open should be called once");
    assert.strictEqual(canvasOpenCalls[0][0], manualDir, "Digest should open against the manual root path");
    assert.strictEqual(canvasOpenCalls[0][3], "manual", "Digest should open in manual root mode");
  });

  test("OpenSettings opens settings for the active manual root in manual mode", async () => {
    const manualDir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-manual-settings-"));
    restores.push(() => fs.rm(manualDir, { recursive: true, force: true }));

    const memento = makeMemento();
    memento.update(ROOT_REGISTRY_KEY, [{ uri: manualDir, label: "Manual Root" }]);
    memento.update("agendo.activeRootId", manualDir);

    const { captured, canvasSettingsCalls } = await setupCommands(memento);
    const openSettings = captured.find((c) => c.command === Command.OpenSettings)?.callback;
    assert.ok(openSettings, "OpenSettings callback should be registered");

    await openSettings();

    assert.strictEqual(canvasSettingsCalls.length, 1, "canvasViewer.openSettings should be called once");
    assert.strictEqual(canvasSettingsCalls[0][0], manualDir, "Settings should open against the manual root path");
    assert.strictEqual(canvasSettingsCalls[0][2], "manual", "Settings should open in manual root mode");
  });
});
