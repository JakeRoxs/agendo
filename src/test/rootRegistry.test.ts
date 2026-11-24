import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { ConfigService } from "../todos/configService";
import {
  ACTIVE_ROOT_KEY,
  ROOT_REGISTRY_KEY,
  TREE_MODE_KEY,
  type TreeMode,
  TodoRootRegistry,
} from "../todos/rootRegistry";

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

class RootConfig extends ConfigService {
  private readonly roots: Map<string, vscode.Uri>;
  constructor(roots: Map<string, vscode.Uri>) {
    super();
    this.roots = roots;
  }
  override getRootUri(folder?: vscode.WorkspaceFolder): vscode.Uri | undefined {
    if (!folder) return undefined;
    const custom = this.roots.get(folder.uri.toString());
    if (custom) return custom;
    return super.getRootUri(folder);
  }
  override async writeConfigFile() {}
  override async applyGitignore() {}
}

function setupFolders(
  folders: vscode.WorkspaceFolder[],
  rootValue: string,
): () => void {
  const restoreFolders = mockWorkspaceFolders(folders);
  const restoreConfig = mockGetConfiguration({
    get: () => undefined,
    update: () => Promise.resolve(),
    inspect: () => ({ workspaceFolderValue: rootValue }),
  });
  return () => {
    restoreFolders();
    restoreConfig();
  };
}

suite("root registry", () => {
  let restore: Array<() => void> = [];

  teardown(() => {
    for (const fn of restore) {
      fn();
    }
    restore = [];
  });

  test("returns no roots with no workspace folders and no persisted manual roots", () => {
    setupFolders([], "docs/todos");
    const registry = new TodoRootRegistry(new ConfigService(), makeMemento());
    assert.deepStrictEqual(registry.getRoots(), []);
    assert.strictEqual(registry.getActiveRootId(), undefined);
    assert.strictEqual(registry.getActiveRoot(), undefined);
    assert.strictEqual(registry.getMode(), "single");
  });

  test("derives a workspace root per folder from folder-scoped agendo.root", () => {
    const folderA = makeFolder("folder-a", "/path/a");
    const folderB = makeFolder("folder-b", "/path/b");
    setupFolders([folderA, folderB], "docs/todos");

    const registry = new TodoRootRegistry(new ConfigService(), makeMemento());
    const roots = registry.getRoots();
    assert.strictEqual(roots.length, 2);
    assert.strictEqual(roots[0].source, "workspace");
    assert.strictEqual(roots[0].folder, folderA);
    assert.strictEqual(roots[0].uri.fsPath, "/path/a/docs/todos");
    assert.strictEqual(roots[0].id, "/path/a/docs/todos");
    assert.strictEqual(roots[0].available, true);
    assert.strictEqual(roots[1].source, "workspace");
    assert.strictEqual(roots[1].folder, folderB);
    assert.strictEqual(roots[1].uri.fsPath, "/path/b/docs/todos");
    assert.strictEqual(roots[1].id, "/path/b/docs/todos");
    assert.strictEqual(roots[1].available, true);
    // Distinct folders yield distinct root ids (per-folder root identity).
    assert.notStrictEqual(roots[0].id, roots[1].id);
  });

  test("respects a custom per-folder agendo.root via RootConfig", () => {
    const folder = makeFolder("folder-a", "/path/a");
    setupFolders([folder], "docs/todos");
    const config = new RootConfig(
      new Map([[folder.uri.toString(), vscode.Uri.file("/path/a/custom/root")]]),
    );
    const registry = new TodoRootRegistry(config, makeMemento());
    const roots = registry.getRoots();
    assert.strictEqual(roots.length, 1);
    assert.strictEqual(roots[0].source, "workspace");
    assert.strictEqual(roots[0].folder, folder);
    assert.strictEqual(roots[0].uri.fsPath, "/path/a/custom/root");
    assert.strictEqual(roots[0].id, "/path/a/custom/root");
    assert.strictEqual(roots[0].label, "root");
  });

  test("adds and removes manual roots", async () => {
    const manualDir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-manual-"));
    restore.push(() => fs.rm(manualDir, { recursive: true, force: true }));

    setupFolders([], "docs/todos");
    const memento = makeMemento();
    const registry = new TodoRootRegistry(new ConfigService(), memento);
    assert.deepStrictEqual(registry.getRoots(), []);

    const uri = vscode.Uri.file(manualDir);
    registry.addManualRoot(uri, "Manual Root");
    const roots = registry.getRoots();
    assert.strictEqual(roots.length, 1);
    assert.strictEqual(roots[0].source, "manual");
    assert.strictEqual(roots[0].label, "Manual Root");
    assert.strictEqual(roots[0].uri.fsPath, manualDir);
    assert.strictEqual(roots[0].id, manualDir);
    assert.strictEqual(roots[0].folder, undefined);
    assert.strictEqual(roots[0].available, true);
    assert.strictEqual(registry.getMode(), "single");

    // Persisted in workspaceState, not settings.
    const records = memento.get(ROOT_REGISTRY_KEY) as unknown[];
    assert.strictEqual(records.length, 1);
    assert.strictEqual((records[0] as { uri?: string }).uri, manualDir);
    assert.strictEqual((records[0] as { label?: string }).label, "Manual Root");
    assert.strictEqual(memento.get(ACTIVE_ROOT_KEY), undefined);
    assert.strictEqual(memento.get(TREE_MODE_KEY), "single");

    // Remove removes only the registry entry, not the files.
    registry.removeManualRoot(manualDir);
    assert.deepStrictEqual(registry.getRoots(), []);
    // The last manual root is stored as an empty record list.
    assert.deepStrictEqual(memento.get(ROOT_REGISTRY_KEY), []);

    // Unknown id is a no-op.
    registry.removeManualRoot("/nonexistent");
    assert.deepStrictEqual(registry.getRoots(), []);
  });

  test("re-adding a manual root updates its label without duplicating", async () => {
    const manualDir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-dedup-"));
    restore.push(() => fs.rm(manualDir, { recursive: true, force: true }));

    setupFolders([], "docs/todos");
    const registry = new TodoRootRegistry(new ConfigService(), makeMemento());
    registry.addManualRoot(vscode.Uri.file(manualDir), "First");
    registry.addManualRoot(vscode.Uri.file(manualDir), "Second");
    const roots = registry.getRoots();
    assert.strictEqual(roots.length, 1);
    assert.strictEqual(roots[0].label, "Second");
  });

  test("prefers the workspace descriptor when a manual root overlaps a workspace root", () => {
    const folder = makeFolder("folder-a", "/path/a");
    setupFolders([folder], "docs/todos");
    const memento = makeMemento();
    memento.update(ROOT_REGISTRY_KEY, [
      { uri: "/path/a/docs/todos", label: "Manual Overlap" },
    ]);
    const registry = new TodoRootRegistry(new ConfigService(), memento);
    const roots = registry.getRoots();
    assert.strictEqual(roots.length, 1);
    assert.strictEqual(roots[0].source, "workspace");
    assert.strictEqual(roots[0].folder, folder);
    assert.strictEqual(roots[0].uri.fsPath, "/path/a/docs/todos");
    assert.strictEqual(roots[0].id, "/path/a/docs/todos");
    // The workspace label wins, not the manual label.
    assert.strictEqual(roots[0].label, "todos");
  });

  test("keeps missing persisted manual roots as unavailable", async () => {
    const availableDir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-available-"));
    restore.push(() => fs.rm(availableDir, { recursive: true, force: true }));

    setupFolders([], "docs/todos");
    const memento = makeMemento();
    memento.update(ROOT_REGISTRY_KEY, [
      { uri: "/path/nonexistent/manual", label: "Missing" },
      { uri: availableDir, label: "Available" },
    ]);
    const registry = new TodoRootRegistry(new ConfigService(), memento);
    const roots = registry.getRoots();
    assert.strictEqual(roots.length, 2);

    const missing = roots.find((r) => r.label === "Missing");
    assert.ok(missing);
    assert.strictEqual(missing?.source, "manual");
    assert.strictEqual(missing?.available, false);

    const available = roots.find((r) => r.label === "Available");
    assert.ok(available);
    assert.strictEqual(available?.source, "manual");
    assert.strictEqual(available?.available, true);
    assert.strictEqual(available?.uri.fsPath, availableDir);
  });

  test("persists and falls back the active root per workspace", async () => {
    const folder = makeFolder("folder-a", "/path/a");
    setupFolders([folder], "docs/todos");
    const memento = makeMemento();
    const registry = new TodoRootRegistry(new ConfigService(), memento);

    // No active root persisted: falls back to the first root.
    assert.strictEqual(registry.getActiveRootId(), "/path/a/docs/todos");
    const firstActive = registry.getActiveRoot();
    assert.ok(firstActive);
    assert.strictEqual(firstActive?.source, "workspace");

    const manualDir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-active-"));
    restore.push(() => fs.rm(manualDir, { recursive: true, force: true }));
    registry.addManualRoot(vscode.Uri.file(manualDir));
    registry.setActiveRoot(manualDir);
    assert.strictEqual(registry.getActiveRootId(), manualDir);
    const manualActive = registry.getActiveRoot();
    assert.ok(manualActive);
    assert.strictEqual(manualActive?.source, "manual");

    // A new registry over the same memento restores the active root.
    const restored = new TodoRootRegistry(new ConfigService(), memento);
    assert.strictEqual(restored.getActiveRootId(), manualDir);

    // Removing the active root clears it and falls back to the first root.
    registry.removeManualRoot(manualDir);
    assert.strictEqual(registry.getActiveRootId(), "/path/a/docs/todos");
    const workspaceActive = registry.getActiveRoot();
    assert.ok(workspaceActive);
    assert.strictEqual(workspaceActive?.source, "workspace");
    // The cleared selection is persisted.
    assert.strictEqual(memento.get(ACTIVE_ROOT_KEY), undefined);
  });

  test("persists the tree mode per workspace", () => {
    setupFolders([], "docs/todos");
    const memento = makeMemento();
    const registry = new TodoRootRegistry(new ConfigService(), memento);
    assert.strictEqual(registry.getMode(), "single");

    registry.setMode("multi");
    assert.strictEqual(registry.getMode(), "multi");
    assert.strictEqual(memento.get(TREE_MODE_KEY), "multi");

    // A restored registry preserves the mode.
    const restored = new TodoRootRegistry(new ConfigService(), memento);
    assert.strictEqual(restored.getMode(), "multi");

    registry.setMode("single");
    assert.strictEqual(registry.getMode(), "single");
    assert.strictEqual(memento.get(TREE_MODE_KEY), "single");
  });

  test("disambiguates duplicate labels with a parent-path hint", () => {
    const folderA = makeFolder("folder-a", "/path/a");
    const folderB = makeFolder("folder-b", "/path/b");
    setupFolders([folderA, folderB], "docs/todos");
    const registry = new TodoRootRegistry(new ConfigService(), makeMemento());
    const roots = registry.getRoots();
    assert.strictEqual(roots.length, 2);
    const labels = roots.map((r) => r.label);
    assert.notStrictEqual(labels[0], labels[1]);
    assert.ok(labels[0].includes("todos") && labels[1].includes("todos"));
    // Stable ids are unchanged by label disambiguation.
    assert.strictEqual(roots[0].id, "/path/a/docs/todos");
    assert.strictEqual(roots[1].id, "/path/b/docs/todos");
  });

  test("getRoot returns undefined for an unknown id", () => {
    setupFolders([], "docs/todos");
    const registry = new TodoRootRegistry(new ConfigService(), makeMemento());
    assert.strictEqual(registry.getRoot("/unknown"), undefined);
  });

  test("fires onDidChange when roots, active root, or mode change", async () => {
    setupFolders([], "docs/todos");
    const registry = new TodoRootRegistry(new ConfigService(), makeMemento());
    let count = 0;
    const disposable = registry.onDidChange(() => {
      count++;
    });

    const changeDir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-change-"));
    restore.push(() => fs.rm(changeDir, { recursive: true, force: true }));
    registry.addManualRoot(vscode.Uri.file(changeDir));
    assert.strictEqual(count, 1);

    registry.setMode("multi");
    assert.strictEqual(count, 2);

    registry.setActiveRoot(changeDir);
    assert.strictEqual(count, 3);

    disposable.dispose();
  });

  test("rejects invalid URIs and non-directories when adding manual roots", async () => {
    setupFolders([], "docs/todos");
    const registry = new TodoRootRegistry(new ConfigService(), makeMemento());

    // Non-file scheme.
    assert.throws(() => registry.addManualRoot(vscode.Uri.parse("http://example.com/path")));
    // Nonexistent directory.
    assert.throws(() => registry.addManualRoot(vscode.Uri.file("/path/nonexistent/dir")));

    // A file, not a directory.
    const fileDir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-file-"));
    restore.push(() => fs.rm(fileDir, { recursive: true, force: true }));
    const filePath = vscode.Uri.file(path.join(fileDir, "todo.md"));
    await fs.writeFile(filePath.fsPath, "# x\n");
    assert.throws(() => registry.addManualRoot(filePath));

    // Invalid mode.
    assert.throws(() => registry.setMode("invalid" as TreeMode));
    // Unknown active root.
    assert.throws(() => registry.setActiveRoot("/unknown"));
  });

  test("creates an independent repository context per root with duplicate IDs", async () => {
    const dir1 = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-root1-"));
    const dir2 = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-root2-"));
    restore.push(() => fs.rm(dir1, { recursive: true, force: true }));
    restore.push(() => fs.rm(dir2, { recursive: true, force: true }));

    // Each root gets a todo with the same ID "001" under the per-folder root.
    const todoContent = "---\nstatus: pending\n---\n# Dup Todo\n\nBody";
    const rootDir1 = path.join(dir1, "docs", "todos");
    const rootDir2 = path.join(dir2, "docs", "todos");
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(rootDir1));
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(path.join(rootDir1, "001-pending-p3-dup.md")),
      Buffer.from(todoContent, "utf8"),
    );
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(rootDir2));
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(path.join(rootDir2, "001-pending-p3-dup.md")),
      Buffer.from(todoContent, "utf8"),
    );

    const folder1 = makeFolder("root1", dir1);
    const folder2 = makeFolder("root2", dir2);
    setupFolders([folder1, folder2], "docs/todos");
    const registry = new TodoRootRegistry(new ConfigService(), makeMemento());
    const contexts = registry.getContexts();
    assert.strictEqual(contexts.length, 2);

    const repo1 = contexts[0].repository;
    const repo2 = contexts[1].repository;
    // Separate repository instances.
    assert.notStrictEqual(repo1, repo2);
    // Separate dependency graphs.
    assert.notStrictEqual(repo1.getDependencyGraph().blockedBy, repo2.getDependencyGraph().blockedBy);

    await repo1.refresh();
    await repo2.refresh();
    // Each repository sees its own todo with the duplicate ID.
    assert.strictEqual(repo1.getTodos().length, 1);
    assert.strictEqual(repo1.getTodos()[0].id, "001");
    assert.strictEqual(repo2.getTodos().length, 1);
    assert.strictEqual(repo2.getTodos()[0].id, "001");
    // Independent ID sequences.
    assert.strictEqual(repo1.getMaxId(), 1);
    assert.strictEqual(repo2.getMaxId(), 1);

    registry.dispose();
  });

  test("workspace root context honors per-folder agendo.root", () => {
    const folder = makeFolder("folder-a", "/path/a");
    setupFolders([folder], "docs/todos");
    const config = new RootConfig(
      new Map([[folder.uri.toString(), vscode.Uri.file("/path/a/custom/root")]]),
    );
    const registry = new TodoRootRegistry(config, makeMemento());
    const contexts = registry.getContexts();
    assert.strictEqual(contexts.length, 1);
    assert.strictEqual(contexts[0].descriptor.uri.fsPath, "/path/a/custom/root");
    const boundUri = contexts[0].config.getRootUri();
    assert.ok(boundUri);
    assert.strictEqual(boundUri?.fsPath, "/path/a/custom/root");
    assert.strictEqual(contexts[0].descriptor.source, "workspace");
    assert.strictEqual(contexts[0].descriptor.folder, folder);
    registry.dispose();
  });

  test("manual root context uses its exact URI", async () => {
    const manualDir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-manual-"));
    restore.push(() => fs.rm(manualDir, { recursive: true, force: true }));

    setupFolders([], "docs/todos");
    const registry = new TodoRootRegistry(new ConfigService(), makeMemento());
    registry.addManualRoot(vscode.Uri.file(manualDir), "Manual Root");
    const contexts = registry.getContexts();
    assert.strictEqual(contexts.length, 1);
    assert.strictEqual(contexts[0].descriptor.source, "manual");
    assert.strictEqual(contexts[0].descriptor.uri.fsPath, manualDir);
    const boundUri = contexts[0].config.getRootUri();
    assert.ok(boundUri);
    assert.strictEqual(boundUri?.fsPath, manualDir);
    registry.dispose();
  });

  test("root removal disposes and removes the context", async () => {
    const manualDir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-remove-"));
    restore.push(() => fs.rm(manualDir, { recursive: true, force: true }));

    setupFolders([], "docs/todos");
    const registry = new TodoRootRegistry(new ConfigService(), makeMemento());
    registry.addManualRoot(vscode.Uri.file(manualDir), "Manual Root");
    const contexts = registry.getContexts();
    assert.strictEqual(contexts.length, 1);
    const id = contexts[0].descriptor.id;

    registry.removeManualRoot(id);
    const after = registry.getContexts();
    assert.strictEqual(after.length, 0);
    assert.strictEqual(registry.getContext(id), undefined);
    registry.dispose();
  });

  test("getContext returns undefined for an unknown root", () => {
    setupFolders([], "docs/todos");
    const registry = new TodoRootRegistry(new ConfigService(), makeMemento());
    assert.strictEqual(registry.getContext("/unknown"), undefined);
    registry.dispose();
  });

  test("setActiveRoot updates the config service for manual and workspace roots", async () => {
    const manualDir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-manual-"));
    restore.push(() => fs.rm(manualDir, { recursive: true, force: true }));

    setupFolders([], "docs/todos");
    const config = new ConfigService();
    const registry = new TodoRootRegistry(config, makeMemento());
    registry.addManualRoot(vscode.Uri.file(manualDir), "Manual Root");

    // Selecting a manual root sets the config's manual root URI.
    registry.setActiveRoot(manualDir);
    assert.strictEqual(registry.getActiveRootId(), manualDir);
    const manualRootUri = config.getManualRoot();
    assert.ok(manualRootUri);
    assert.strictEqual(manualRootUri.fsPath, manualDir);
    assert.strictEqual(config.getRootUri()?.fsPath, manualDir);

    // Selecting a workspace folder clears the manual override and sets the active folder.
    const folder = makeFolder("folder-a", "/path/a");
    setupFolders([folder], "docs/todos");
    const registry2 = new TodoRootRegistry(config, makeMemento());
    registry2.addManualRoot(vscode.Uri.file(manualDir), "Manual Root");
    registry2.setActiveRoot(manualDir);
    assert.strictEqual(config.getManualRoot()?.fsPath, manualDir);

    registry2.setActiveRoot(manualDir); // already active, no-op
    assert.strictEqual(config.getManualRoot()?.fsPath, manualDir);

    // Now select the workspace folder - should clear the manual override.
    registry2.setActiveRoot(registry2.getRoots()[0].id);
    assert.strictEqual(config.getManualRoot(), undefined);
    assert.strictEqual(config.getWorkspaceFolder(), folder);
    assert.strictEqual(config.getRootUri()?.fsPath, path.join("/path/a", "docs/todos"));
    registry2.dispose();
  });

  test("getContexts returns a context per root and disposes stale ones", async () => {
    const manualDir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-ctx-"));
    restore.push(() => fs.rm(manualDir, { recursive: true, force: true }));

    const folder = makeFolder("folder-a", "/path/a");
    setupFolders([folder], "docs/todos");
    const registry = new TodoRootRegistry(new ConfigService(), makeMemento());
    registry.addManualRoot(vscode.Uri.file(manualDir), "Manual Root");

    const contexts = registry.getContexts();
    assert.strictEqual(contexts.length, 2);
    // Each context has its own repository.
    assert.notStrictEqual(contexts[0].repository, contexts[1].repository);
    assert.notStrictEqual(contexts[0].config, contexts[1].config);

    // Every context is resolvable by id.
    for (const ctx of contexts) {
      assert.strictEqual(registry.getContext(ctx.descriptor.id), ctx);
    }

    // Removing a root removes its context.
    registry.removeManualRoot(manualDir);
    const after = registry.getContexts();
    assert.strictEqual(after.length, 1);
    assert.strictEqual(after[0].descriptor.source, "workspace");
    assert.strictEqual(registry.getContext(manualDir), undefined);
    registry.dispose();
  });

  test("restoration on construction re-selects the persisted root", async () => {
    const manualDir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-restore-"));
    restore.push(() => fs.rm(manualDir, { recursive: true, force: true }));

    setupFolders([], "docs/todos");
    const config = new ConfigService();
    const memento = makeMemento();
    const registry = new TodoRootRegistry(config, memento);
    registry.addManualRoot(vscode.Uri.file(manualDir), "Manual Root");
    registry.setActiveRoot(manualDir);
    assert.strictEqual(config.getManualRoot()?.fsPath, manualDir);

    // A new registry over the same workspaceState restores the selection.
    const restored = new TodoRootRegistry(config, memento);
    assert.strictEqual(restored.getActiveRootId(), manualDir);
    assert.strictEqual(config.getManualRoot()?.fsPath, manualDir);
    registry.dispose();
    restored.dispose();
  });

  test("root context config binds a root-aware canvas opener", async () => {
    const manualDir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-canvas-opener-"));
    restore.push(() => fs.rm(manualDir, { recursive: true, force: true }));
    const folder = makeFolder("folder-a", "/path/a");
    setupFolders([folder], "docs/todos");
    const memento = makeMemento();
    const registry = new TodoRootRegistry(new ConfigService(), memento);
    registry.addManualRoot(vscode.Uri.file(manualDir), "Manual Root");

    let captured: [string, string, string, string] | undefined;
    registry.setCanvasOpener(async (todoId, returnTo, workspaceRoot, rootMode) => {
      captured = [todoId, JSON.stringify(returnTo), workspaceRoot, rootMode];
      return true;
    });

    const contexts = registry.getContexts();

    // Workspace root context: workspace folder path + "workspace" mode.
    const workspaceCtx = contexts.find((c) => c.descriptor.source === "workspace");
    assert.ok(workspaceCtx);
    const wsUri = vscode.Uri.file(path.join("/path/a", "docs", "todos", "001-pending-p2-first.md"));
    await workspaceCtx.config.openInCanvas(wsUri, { kind: "board", scope: "todos" });
    assert.ok(captured);
    assert.strictEqual(captured[0], "001");
    assert.strictEqual(captured[2], "/path/a");
    assert.strictEqual(captured[3], "workspace");

    // Manual root context: manual root dir + "manual" mode.
    captured = undefined;
    const manualCtx = contexts.find((c) => c.descriptor.source === "manual");
    assert.ok(manualCtx);
    const manualUri = vscode.Uri.file(path.join(manualDir, "001-pending-p2-first.md"));
    await manualCtx.config.openInCanvas(manualUri, { kind: "board", scope: "todos" });
    assert.ok(captured);
    assert.strictEqual(captured[0], "001");
    assert.strictEqual(captured[2], manualDir);
    assert.strictEqual(captured[3], "manual");

    registry.dispose();
  });
});
