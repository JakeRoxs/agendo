import * as assert from "node:assert";
import * as vscode from "vscode";
import { DEFAULT_TODOS_CONFIG } from "../todos/configService";
import { ConfigService } from "../todos/configService";
import { Settings } from "../configuration";

function makeFolder(name: string, fsPath: string): vscode.WorkspaceFolder {
  return {
    name,
    uri: vscode.Uri.file(fsPath),
    index: 0,
  } as unknown as vscode.WorkspaceFolder;
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

suite("config service active root", () => {
  let restore: Array<() => void> = [];

  teardown(() => {
    for (const fn of restore) {
      fn();
    }
    restore = [];
  });

  test("defaults to the first workspace folder when no selection is persisted", () => {
    const folders = [makeFolder("folder-a", "/path/a"), makeFolder("folder-b", "/path/b")];
    const restoreFolders = mockWorkspaceFolders(folders);
    restore.push(restoreFolders);

    const config = new ConfigService();
    assert.strictEqual(config.getWorkspaceFolder(), folders[0]);
    assert.strictEqual(config.workspaceFolders.length, 2);
  });

  test("restores the persisted folder from workspaceState when available", () => {
    const folders = [makeFolder("folder-a", "/path/a"), makeFolder("folder-b", "/path/b")];
    const restoreFolders = mockWorkspaceFolders(folders);
    restore.push(restoreFolders);

    const memento = makeMemento();
    memento.update("activeWorkspaceFolder", folders[1].uri.toString());

    const config = new ConfigService(memento);
    assert.strictEqual(config.getWorkspaceFolder(), folders[1]);
  });

  test("falls back to the first folder when the persisted folder is removed", () => {
    const folders = [makeFolder("folder-a", "/path/a"), makeFolder("folder-b", "/path/b")];
    const restoreFolders = mockWorkspaceFolders(folders);
    restore.push(restoreFolders);

    const memento = makeMemento();
    memento.update("activeWorkspaceFolder", "/path/nonexistent");

    const config = new ConfigService(memento);
    assert.strictEqual(config.getWorkspaceFolder(), folders[0]);
    // The stale reference is cleared.
    assert.strictEqual(memento.get("activeWorkspaceFolder"), undefined);
  });

  test("getRootUri returns the URI for the active folder", () => {
    const folders = [makeFolder("folder-a", "/path/a"), makeFolder("folder-b", "/path/b")];
    const restoreFolders = mockWorkspaceFolders(folders);
    restore.push(restoreFolders);

    const restoreConfig = mockGetConfiguration({
      get: () => undefined,
      update: () => Promise.resolve(),
      inspect: () => undefined,
    });
    restore.push(restoreConfig);

    const config = new ConfigService();
    const rootUri = config.getRootUri();
    assert.strictEqual(rootUri?.fsPath, "/path/a/docs/todos");
  });

  test("getRootUri(folder) returns the URI for the given folder", () => {
    const folders = [makeFolder("folder-a", "/path/a"), makeFolder("folder-b", "/path/b")];
    const restoreFolders = mockWorkspaceFolders(folders);
    restore.push(restoreFolders);

    const restoreConfig = mockGetConfiguration({
      get: () => undefined,
      update: () => Promise.resolve(),
      inspect: () => undefined,
    });
    restore.push(restoreConfig);

    const config = new ConfigService();
    const rootUri = config.getRootUri(folders[1]);
    assert.strictEqual(rootUri?.fsPath, "/path/b/docs/todos");
  });

  test("root reads the folder-scoped value for the active folder", () => {
    const folders = [makeFolder("folder-a", "/path/a")];
    const restoreFolders = mockWorkspaceFolders(folders);
    restore.push(restoreFolders);

    const restoreConfig = mockGetConfiguration({
      get: (key) => (key === Settings.Root ? "custom/root" : undefined),
      update: () => Promise.resolve(),
      inspect: () => ({ workspaceFolderValue: "custom/root" }),
    });
    restore.push(restoreConfig);

    const config = new ConfigService();
    assert.strictEqual(config.root, "custom/root");
  });

  test("root falls back to the default when no value is configured", () => {
    const folders = [makeFolder("folder-a", "/path/a")];
    const restoreFolders = mockWorkspaceFolders(folders);
    restore.push(restoreFolders);

    const restoreConfig = mockGetConfiguration({
      get: () => undefined,
      update: () => Promise.resolve(),
      inspect: () => undefined,
    });
    restore.push(restoreConfig);

    const config = new ConfigService();
    assert.strictEqual(config.root, DEFAULT_TODOS_CONFIG.root);
  });

  test("setWorkspaceFolder persists the selection in workspaceState", () => {
    const folders = [makeFolder("folder-a", "/path/a"), makeFolder("folder-b", "/path/b")];
    const restoreFolders = mockWorkspaceFolders(folders);
    restore.push(restoreFolders);

    const memento = makeMemento();
    const config = new ConfigService(memento);

    config.setWorkspaceFolder(folders[1]);
    assert.strictEqual(config.getWorkspaceFolder(), folders[1]);
    assert.strictEqual(memento.get("activeWorkspaceFolder"), folders[1].uri.toString());
  });

  test("setWorkspaceFolder(undefined) clears the persisted selection", () => {
    const folders = [makeFolder("folder-a", "/path/a")];
    const restoreFolders = mockWorkspaceFolders(folders);
    restore.push(restoreFolders);

    const memento = makeMemento();
    memento.update("activeWorkspaceFolder", folders[0].uri.toString());
    const config = new ConfigService(memento);

    config.setWorkspaceFolder(undefined);
    assert.strictEqual(config.getWorkspaceFolder(), undefined);
    assert.strictEqual(memento.get("activeWorkspaceFolder"), undefined);
  });

  test("returns undefined for getWorkspaceFolder when there are no workspace folders", () => {
    const restoreFolders = mockWorkspaceFolders([]);
    restore.push(restoreFolders);

    const config = new ConfigService();
    assert.strictEqual(config.getWorkspaceFolder(), undefined);
    assert.strictEqual(config.getRootUri(), undefined);
  });

  test("viewMode reads folder-scoped value for the active folder", () => {
    const folders = [makeFolder("folder-a", "/path/a")];
    const restoreFolders = mockWorkspaceFolders(folders);
    restore.push(restoreFolders);

    const restoreConfig = mockGetConfiguration({
      get: (key) => (key === Settings.ViewMode ? "canvas" : undefined),
      update: () => Promise.resolve(),
      inspect: () => ({ workspaceFolderValue: "canvas" }),
    });
    restore.push(restoreConfig);

    const config = new ConfigService();
    assert.strictEqual(config.viewMode, "canvas");
  });

  test("viewMode falls back to workspace value when folder has no folder-scoped value", () => {
    const folders = [makeFolder("folder-a", "/path/a")];
    const restoreFolders = mockWorkspaceFolders(folders);
    restore.push(restoreFolders);

    const restoreConfig = mockGetConfiguration({
      get: (_key) => undefined,
      update: () => Promise.resolve(),
      inspect: () => ({ workspaceValue: "editor" }),
    });
    restore.push(restoreConfig);

    const config = new ConfigService();
    assert.strictEqual(config.viewMode, "editor");
  });

  test("viewMode falls back to openInPreview when no explicit value is configured", () => {
    const folders = [makeFolder("folder-a", "/path/a")];
    const restoreFolders = mockWorkspaceFolders(folders);
    restore.push(restoreFolders);

    const restoreConfig = mockGetConfiguration({
      get: (key) => (key === Settings.OpenInPreview ? false : undefined),
      update: () => Promise.resolve(),
      inspect: () => undefined,
    });
    restore.push(restoreConfig);

    const config = new ConfigService();
    assert.strictEqual(config.viewMode, "default");
  });

  test("refreshActiveFolder is public and re-evaluates the active folder", () => {
    const folderA = makeFolder("folder-a", "/path/a");
    const folderB = makeFolder("folder-b", "/path/b");
    const folders = [folderA, folderB];
    const restoreFolders = mockWorkspaceFolders(folders);
    restore.push(restoreFolders);

    const config = new ConfigService();
    assert.strictEqual(config.getWorkspaceFolder(), folderA);

    // Simulate folder-a being removed; only folder-b remains.
    const restoreFolders2 = mockWorkspaceFolders([folderB]);
    restore.push(restoreFolders2);

    config.refreshActiveFolder();
    assert.strictEqual(config.getWorkspaceFolder(), folderB);
  });

  test("getRootUri returns the explicit root URI when bound to a root", () => {
    const rootUri = vscode.Uri.file("/path/custom/root");
    const config = new ConfigService(undefined, rootUri);
    assert.strictEqual(config.getRootUri(), rootUri);
    // A folder argument returns that folder's root, not the explicit override.
    const otherUri = config.getRootUri(makeFolder("other", "/path/other"));
    assert.ok(otherUri);
    assert.strictEqual(otherUri.fsPath, "/path/other/docs/todos");
    // Old single-root constructor signature still works with no workspace folders.
    const restoreFolders = mockWorkspaceFolders([]);
    restore.push(restoreFolders);
    const single = new ConfigService();
    assert.strictEqual(single.getRootUri(), undefined);
  });

  test("getRootUri returns the manual root URI when a manual root is set", () => {
    const restoreFolders = mockWorkspaceFolders([]);
    restore.push(restoreFolders);

    const manualUri = vscode.Uri.file("/path/manual/root");
    const config = new ConfigService();
    assert.strictEqual(config.getManualRoot(), undefined);
    assert.strictEqual(config.getRootUri(), undefined);

    config.setManualRoot(manualUri);
    assert.strictEqual(config.getManualRoot(), manualUri);
    const rootUri = config.getRootUri();
    assert.ok(rootUri);
    assert.strictEqual(rootUri?.fsPath, manualUri.fsPath);
    // A folder argument returns that folder's root, not the manual override.
    const otherUri = config.getRootUri(makeFolder("other", "/path/other"));
    assert.ok(otherUri);
    assert.strictEqual(otherUri.fsPath, "/path/other/docs/todos");
  });

  test("clearManualRoot restores the workspace-folder root", () => {
    const restoreFolders = mockWorkspaceFolders([]);
    restore.push(restoreFolders);

    const config = new ConfigService();
    const manualUri = vscode.Uri.file("/path/manual/root");
    config.setManualRoot(manualUri);
    assert.strictEqual(config.getManualRoot(), manualUri);
    const rootUri = config.getRootUri();
    assert.ok(rootUri);
    assert.strictEqual(rootUri?.fsPath, manualUri.fsPath);

    config.clearManualRoot();
    assert.strictEqual(config.getManualRoot(), undefined);
    assert.strictEqual(config.getRootUri(), undefined);
  });

  test("setWorkspaceFolder clears the manual root override", () => {
    const restoreFolders = mockWorkspaceFolders([]);
    restore.push(restoreFolders);

    const config = new ConfigService();
    const manualUri = vscode.Uri.file("/path/manual/root");
    config.setManualRoot(manualUri);
    const rootUri = config.getRootUri();
    assert.ok(rootUri);
    assert.strictEqual(rootUri?.fsPath, manualUri.fsPath);

    config.setWorkspaceFolder(undefined);
    assert.strictEqual(config.getManualRoot(), undefined);
    assert.strictEqual(config.getRootUri(), undefined);
  });
});
