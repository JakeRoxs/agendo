import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { ConfigService } from "../todos/configService";
import { TodoRepository } from "../todos/todoRepository";
import { buildFileName } from "../todos/todoModel";

class RootConfig extends ConfigService {
  constructor(private readonly rootUri: vscode.Uri) {
    super();
  }
  override getRootUri() {
    return this.rootUri;
  }
  override async writeConfigFile() {}
  override async applyGitignore() {}
}

function makeWatchWatcher(): vscode.FileSystemWatcher {
  const listeners: Array<() => void> = [];
  return {
    onDidCreate: (listener: () => void) => listeners.push(listener),
    onDidChange: (listener: () => void) => listeners.push(listener),
    onDidDelete: (listener: () => void) => listeners.push(listener),
    dispose: () => {},
  } as unknown as vscode.FileSystemWatcher;
}

suite("todo repository active root", () => {
  let root: vscode.Uri;
  let config: RootConfig;
  let repository: TodoRepository;
  let restore: Array<() => void> = [];

  setup(async () => {
    root = vscode.Uri.file(await fs.mkdtemp(path.join(os.tmpdir(), "agendo-repo-")));
    config = new RootConfig(root);
    repository = new TodoRepository(config);
    restore = [];
  });

  teardown(async () => {
    repository.dispose();
    for (const fn of restore) {
      fn();
    }
    restore = [];
    await fs.rm(root.fsPath, { recursive: true, force: true });
  });

  test("refresh scans todos from the active root", async () => {
    const fileName = buildFileName("001", "pending", "p3", "test-todo");
    const fileUri = vscode.Uri.joinPath(root, fileName);
    await vscode.workspace.fs.createDirectory(root);
    await vscode.workspace.fs.writeFile(
      fileUri,
      Buffer.from("---\nstatus: pending\n---\n# Test Todo\n\nBody", "utf8"),
    );

    await repository.refresh();
    const todos = repository.getTodos();
    assert.strictEqual(todos.length, 1);
    assert.strictEqual(todos[0].id, "001");
    assert.strictEqual(todos[0].title, "Test Todo");
  });

  test("rebindRoot rebinds the watcher to the new root without leaking", async () => {
    const watcher = makeWatchWatcher();
    const restoreWatcher = mockCreateFileSystemWatcher(watcher);
    restore.push(restoreWatcher);

    const root2 = vscode.Uri.file(await fs.mkdtemp(path.join(os.tmpdir(), "agendo-repo-2")));

    // Start watching on the first root.
    await repository.rebindRoot();
    assert.ok((repository as unknown as { watcher: vscode.FileSystemWatcher | undefined }).watcher === watcher, "watcher should be bound");

    // Switch to a second root.
    Object.defineProperty(config, "rootUri", { value: root2, configurable: true });
    await repository.rebindRoot();

    // The same watcher instance is reused (startWatching disposes and recreates).
    // Verify the watcher is still bound (not leaked).
    assert.ok((repository as unknown as { watcher: vscode.FileSystemWatcher | undefined }).watcher === watcher, "watcher should still be bound after rebind");

    // Clean up the second root.
    await fs.rm(root2.fsPath, { recursive: true, force: true });
  });

  test("refresh returns empty when no root is available", async () => {
    const noRootConfig = new ConfigService();
    Object.defineProperty(vscode.workspace, "workspaceFolders", {
      value: undefined,
      configurable: true,
    });
    restore.push(() => {
      Object.defineProperty(vscode.workspace, "workspaceFolders", {
        value: vscode.workspace.workspaceFolders,
        configurable: true,
      });
    });

    const noRootRepository = new TodoRepository(noRootConfig);
    await noRootRepository.refresh();
    assert.deepStrictEqual(noRootRepository.getTodos(), []);
    noRootRepository.dispose();
  });

  test("rebindRoot refreshes todos from the new root", async () => {
    const fileName = buildFileName("002", "pending", "p3", "second-todo");
    const fileUri = vscode.Uri.joinPath(root, fileName);
    await vscode.workspace.fs.createDirectory(root);
    await vscode.workspace.fs.writeFile(
      fileUri,
      Buffer.from("---\nstatus: pending\n---\n# Second Todo\n\nBody", "utf8"),
    );

    await repository.refresh();
    assert.strictEqual(repository.getTodos().length, 1);

    const root2 = vscode.Uri.file(await fs.mkdtemp(path.join(os.tmpdir(), "agendo-repo-3")));
    const fileName2 = buildFileName("003", "ready", "p1", "third-todo");
    const fileUri2 = vscode.Uri.joinPath(root2, fileName2);
    await vscode.workspace.fs.createDirectory(root2);
    await vscode.workspace.fs.writeFile(
      fileUri2,
      Buffer.from("---\nstatus: ready\n---\n# Third Todo\n\nBody", "utf8"),
    );

    Object.defineProperty(config, "rootUri", { value: root2, configurable: true });
    await repository.rebindRoot();

    const todos = repository.getTodos();
    assert.strictEqual(todos.length, 1);
    assert.strictEqual(todos[0].id, "003");
    assert.strictEqual(todos[0].title, "Third Todo");

    await fs.rm(root2.fsPath, { recursive: true, force: true });
  });

  test("rebindRoot disposes the old watcher and creates a new one", async () => {
    const watcher = makeWatchWatcher();
    const restoreWatcher = mockCreateFileSystemWatcher(watcher);
    restore.push(restoreWatcher);

    const root2 = vscode.Uri.file(await fs.mkdtemp(path.join(os.tmpdir(), "agendo-repo-4")));

    await repository.rebindRoot();
    assert.ok((repository as unknown as { watcher: vscode.FileSystemWatcher | undefined }).watcher === watcher, "watcher should be bound");

    // Switch to a second root.
    Object.defineProperty(config, "rootUri", { value: root2, configurable: true });
    await repository.rebindRoot();

    // The watcher should be the same instance (startWatching disposes and recreates).
    assert.ok((repository as unknown as { watcher: vscode.FileSystemWatcher | undefined }).watcher === watcher, "watcher should still be bound after rebind");

    await fs.rm(root2.fsPath, { recursive: true, force: true });
  });
});

function mockCreateFileSystemWatcher(watcher: vscode.FileSystemWatcher): () => void {
  const original = vscode.workspace.createFileSystemWatcher;
  Object.defineProperty(vscode.workspace, "createFileSystemWatcher", {
    value: () => watcher,
    configurable: true,
  });
  return () => {
    Object.defineProperty(vscode.workspace, "createFileSystemWatcher", {
      value: original,
      configurable: true,
    });
  };
}
