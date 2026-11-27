import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { ConfigService } from "../todos/configService";
import {
  TodoRootRegistry,
} from "../todos/rootRegistry";
import {
  MultiRootTreeProvider,
  type MultiRootTreeNode,
  type RootChildNode,
  type RootNode,
} from "../todos/multiRootTreeProvider";
import { buildFileName, type Todo, type TodoPriority, type TodoStatus } from "../todos/todoModel";

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

async function writeTodo(
  dir: string,
  id: string,
  status: TodoStatus,
  priority: TodoPriority,
  title: string,
): Promise<void> {
  const fileName = buildFileName(id, status, priority, title.toLowerCase().replace(/\s+/g, "-"));
  const content = `---\nstatus: ${status}\npriority: ${priority}\n---\n# ${title}\n\nBody`;
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(path.join(dir, fileName)),
    Buffer.from(content, "utf8"),
  );
}

async function setupRegistry(
  folders: vscode.WorkspaceFolder[],
  manualRoots: { uri: string; label: string }[],
  todoFilesPerDir: {
    dir: string;
    files: { id: string; status: TodoStatus; priority: TodoPriority; title: string }[];
  }[],
): Promise<{
  registry: TodoRootRegistry;
  memento: vscode.Memento;
  provider: MultiRootTreeProvider;
  restore: () => void;
}> {
  const memento = makeMemento();
  const restoreFolders = mockWorkspaceFolders(folders);
  const restoreConfig = mockGetConfiguration({
    get: () => undefined,
    update: () => Promise.resolve(),
    inspect: () => ({ workspaceFolderValue: "docs/todos" }),
  });
  const registry = new TodoRootRegistry(new ConfigService(), memento);

  const restores: Array<() => void> = [restoreFolders, restoreConfig];

  for (const { dir, files } of todoFilesPerDir) {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
    for (const file of files) {
      await writeTodo(dir, file.id, file.status, file.priority, file.title);
    }
  }

  for (const root of manualRoots) {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(root.uri));
    registry.addManualRoot(vscode.Uri.file(root.uri), root.label);
  }

  const restore = () => {
    for (const r of restores.reverse()) r();
    restores.length = 0;
  };

  const contexts = registry.getContexts();
  for (const ctx of contexts) {
    await ctx.repository.refresh();
  }

  const provider = new MultiRootTreeProvider(registry, memento);

  return { registry, memento, provider, restore };
}

function collectTodos(nodes: MultiRootTreeNode[], provider: MultiRootTreeProvider): Todo[] {
  const result: Todo[] = [];
  for (const node of nodes) {
    if (node.kind === "root") {
      result.push(...collectTodos(provider.getChildren(node), provider));
    } else if (node.kind === "root-child") {
      if (node.node.kind === "todo") {
        result.push(node.node.todo);
      } else {
        result.push(...collectTodos(provider.getChildren(node), provider));
      }
    } else {
      // Bare TreeNode (single mode).
      if (node.kind === "todo") {
        result.push(node.todo);
      } else {
        result.push(...collectTodos(provider.getChildren(node), provider));
      }
    }
  }
  return result;
}

suite("MultiRootTreeProvider", () => {
  const restore: Array<() => void> = [];

  teardown(() => {
    for (const r of restore.reverse()) r();
    restore.length = 0;
  });

  test("single mode preserves the active root's tree shape without a wrapper", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-single-"));
    restore.push(() => fs.rm(dir, { recursive: true, force: true }));
    const folder = makeFolder("folder-a", dir);
    const rootDir = path.join(dir, "docs", "todos");

    const { registry, provider, restore: cleanup } = await setupRegistry(
      [folder],
      [],
      [
        {
          dir: rootDir,
          files: [
            { id: "001", status: "pending", priority: "p2", title: "Example Todo" },
            { id: "002", status: "ready", priority: "p1", title: "Second Todo" },
          ],
        },
      ],
    );
    restore.push(cleanup);

    // Default mode is single.
    assert.strictEqual(registry.getMode(), "single");
    const activeId = registry.getActiveRootId();
    assert.ok(activeId);

    const children = provider.getChildren();
    // No RootNode wrapper in single mode.
    assert.ok(children.every((n) => n.kind !== "root"));

    const childProvider = provider.getChildProvider(activeId);
    assert.ok(childProvider);
    const expected = childProvider.getChildren();
    assert.strictEqual(children.length, expected.length);
    for (let i = 0; i < children.length; i++) {
      assert.strictEqual(children[i].kind, expected[i].kind);
    }

    // TreeItems delegate unchanged (label, contextValue, resourceUri).
    const item = provider.getTreeItem(children[0]);
    const expectedItem = childProvider.getTreeItem(expected[0]);
    assert.strictEqual(item.label, expectedItem.label);
    assert.strictEqual(item.contextValue, expectedItem.contextValue);
    assert.strictEqual(item.resourceUri?.toString(), expectedItem.resourceUri?.toString());

    provider.dispose();
    registry.dispose();
  });

  test("active-root search filters visible todos by ID", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-search-"));
    restore.push(() => fs.rm(dir, { recursive: true, force: true }));
    const { registry, provider, restore: cleanup } = await setupRegistry(
      [makeFolder("search", dir)],
      [],
      [{
        dir: path.join(dir, "docs", "todos"),
        files: [
          { id: "077", status: "pending", priority: "p2", title: "First" },
          { id: "078", status: "pending", priority: "p2", title: "Second" },
        ],
      }],
    );
    restore.push(cleanup);
    const filter = provider.getActiveFilter();
    assert.ok(filter);
    await filter.set({ text: "077" });
    assert.deepStrictEqual(collectTodos(provider.getChildren(), provider).map((todo) => todo.id), ["077"]);
    provider.dispose();
    registry.dispose();
  });

  test("regular and code-scanning root filters persist independently", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-scoped-search-"));
    restore.push(() => fs.rm(dir, { recursive: true, force: true }));
    const { registry, memento, provider, restore: cleanup } = await setupRegistry(
      [makeFolder("search", dir)],
      [],
      [{
        dir: path.join(dir, "docs", "todos"),
        files: [
          { id: "077", status: "pending", priority: "p2", title: "Todo match" },
          { id: "078", status: "pending", priority: "p2", title: "Todo other" },
          { id: "cql-077", status: "pending", priority: "p2", title: "Scanner match" },
          { id: "cql-078", status: "pending", priority: "p2", title: "Scanner other" },
        ],
      }],
    );
    restore.push(cleanup);
    const scanning = new MultiRootTreeProvider(registry, memento, undefined, "code-scanning");
    const regularFilter = provider.getActiveFilter();
    const scanningFilter = scanning.getActiveFilter();
    assert.ok(regularFilter);
    assert.ok(scanningFilter);
    await regularFilter.set({ text: "077" });
    await scanningFilter.set({ text: "cql-078" });

    assert.deepStrictEqual(collectTodos(provider.getChildren(), provider).map((todo) => todo.id), ["077"]);
    assert.deepStrictEqual(
      collectTodos(scanning.getChildren(), scanning).map((todo) => todo.id),
      ["cql-078"],
    );

    const restoredRegular = new MultiRootTreeProvider(registry, memento);
    const restoredScanning = new MultiRootTreeProvider(registry, memento, undefined, "code-scanning");
    assert.deepStrictEqual(
      collectTodos(restoredRegular.getChildren(), restoredRegular).map((todo) => todo.id),
      ["077"],
    );
    assert.deepStrictEqual(
      collectTodos(restoredScanning.getChildren(), restoredScanning).map((todo) => todo.id),
      ["cql-078"],
    );

    provider.dispose();
    scanning.dispose();
    restoredRegular.dispose();
    restoredScanning.dispose();
    registry.dispose();
  });

  test("multi mode shows named root containers with separate child hierarchies", async () => {
    const dir1 = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-root1-"));
    const dir2 = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-root2-"));
    restore.push(() => fs.rm(dir1, { recursive: true, force: true }));
    restore.push(() => fs.rm(dir2, { recursive: true, force: true }));
    const rootDir1 = path.join(dir1, "docs", "todos");
    const rootDir2 = path.join(dir2, "docs", "todos");

    const folder1 = makeFolder("root1", dir1);
    const folder2 = makeFolder("root2", dir2);
    const { registry, provider, restore: cleanup } = await setupRegistry(
      [folder1, folder2],
      [],
      [
        { dir: rootDir1, files: [{ id: "001", status: "pending", priority: "p2", title: "Root One Todo" }] },
        { dir: rootDir2, files: [{ id: "002", status: "ready", priority: "p1", title: "Root Two Todo" }] },
      ],
    );
    restore.push(cleanup);

    registry.setMode("multi");
    // Rebuild is triggered synchronously by registry onDidChange.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const children = provider.getChildren();
    assert.strictEqual(children.length, 2);
    assert.ok(children.every((n) => n.kind === "root"));
    const rootIds = children.map((n) => n.rootId);
    assert.strictEqual(rootIds[0], registry.getRoots()[0].id);
    assert.strictEqual(rootIds[1], registry.getRoots()[1].id);

    // Root nodes are labeled by disambiguated descriptor label.
    const root0 = children[0] as RootNode;
    const descriptor0 = registry.getRoot(root0.rootId);
    assert.ok(descriptor0);
    const item0 = provider.getTreeItem(root0) as vscode.TreeItem;
    assert.strictEqual(item0.label, descriptor0.label);
    assert.strictEqual(item0.description, descriptor0.uri.fsPath);
    assert.strictEqual(item0.contextValue, "rootContainer");
    assert.strictEqual(item0.resourceUri?.toString(), descriptor0.uri.toString());

    // Expanding a root returns RootChildNodes wrapping that root's children.
    const rootChildren = provider.getChildren(root0);
    assert.ok(rootChildren.every((n) => n.kind === "root-child"));
    assert.ok(rootChildren.every((n) => n.rootId === root0.rootId));
    const todos = collectTodos(rootChildren, provider);
    assert.strictEqual(todos.length, 1);
    assert.strictEqual(todos[0].id, "001");

    // Expanding a child delegates to the correct root provider: the status
    // group reveals its priority/todo children.
    const grandChildren = provider.getChildren(rootChildren[0]);
    const grandTodos = collectTodos(grandChildren, provider);
    assert.strictEqual(grandTodos.length, 1);
    assert.strictEqual(grandTodos[0].id, "001");

    provider.dispose();
    registry.dispose();
  });

  test("identical todo IDs in separate roots remain separate and point to correct resourceUris", async () => {
    const dir1 = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-dup1-"));
    const dir2 = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-dup2-"));
    restore.push(() => fs.rm(dir1, { recursive: true, force: true }));
    restore.push(() => fs.rm(dir2, { recursive: true, force: true }));
    const rootDir1 = path.join(dir1, "docs", "todos");
    const rootDir2 = path.join(dir2, "docs", "todos");
    // Same ID "001" in both roots.
    await writeTodo(rootDir1, "001", "pending", "p2", "Dup One");
    await writeTodo(rootDir2, "001", "pending", "p2", "Dup Two");

    const folder1 = makeFolder("root1", dir1);
    const folder2 = makeFolder("root2", dir2);
    const { registry, provider, restore: cleanup } = await setupRegistry(
      [folder1, folder2],
      [],
      [
        { dir: rootDir1, files: [{ id: "001", status: "pending", priority: "p2", title: "Dup One" }] },
        { dir: rootDir2, files: [{ id: "001", status: "pending", priority: "p2", title: "Dup Two" }] },
      ],
    );
    restore.push(cleanup);

    registry.setMode("multi");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const children = provider.getChildren() as RootNode[];
    assert.strictEqual(children.length, 2);

    // Find the todo TreeItem within each root's hierarchy and verify it points
    // to that root's resource URI with a root-prefixed id.
    for (const root of children) {
      const item = findTodoTreeItem(root, provider);
      if (!item) {
        throw new Error(`Expected a todo item under root ${root.rootId}`);
      }
      const rootDescriptor = registry.getRoot(root.rootId);
      assert.ok(rootDescriptor);
      // The todo's resource URI points to its file under this root.
      assert.ok(item.resourceUri?.fsPath.startsWith(`${rootDescriptor.uri.fsPath}/`));
      // IDs are root-prefixed and distinct across roots.
      assert.ok((item.id ?? "").startsWith(`${root.rootId}:`));
    }

    // The two roots' "001" todos are distinct objects.
    const todosByRoot = new Map<string, Todo[]>();
    for (const root of children) {
      const rootChildren = provider.getChildren(root) as RootChildNode[];
      const todos = collectTodos(rootChildren, provider);
      todosByRoot.set(root.rootId, todos);
    }
    const rootIds = registry.getRoots().map((r) => r.id);
    assert.strictEqual(todosByRoot.size, 2);
    for (const rootId of rootIds) {
      const todos = todosByRoot.get(rootId);
      assert.ok(todos);
      assert.strictEqual(todos.length, 1);
      assert.strictEqual(todos[0].id, "001");
    }

    provider.dispose();
    registry.dispose();
  });

  /** Walk a root's hierarchy to find the first todo and return its TreeItem. */
  function findTodoTreeItem(
    root: RootNode,
    provider: MultiRootTreeProvider,
  ): vscode.TreeItem | undefined {
    const stack: RootChildNode[] = provider.getChildren(root) as RootChildNode[];
    while (stack.length > 0) {
      const rc = stack.pop();
      if (!rc) continue;
      if (rc.node.kind === "todo") {
        return provider.getTreeItem(rc);
      }
      stack.push(...provider.getChildren(rc) as RootChildNode[]);
    }
    return undefined;
  }

  test("root and mode changes refresh the provider", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-refresh-"));
    restore.push(() => fs.rm(dir, { recursive: true, force: true }));
    const folder = makeFolder("folder-a", dir);
    const rootDir = path.join(dir, "docs", "todos");

    const { registry, provider, restore: cleanup } = await setupRegistry(
      [folder],
      [],
      [{ dir: rootDir, files: [{ id: "001", status: "pending", priority: "p2", title: "Example Todo" }] }],
    );
    restore.push(cleanup);

    let refreshCount = 0;
    const disposable = provider.onDidChangeTreeData(() => {
      refreshCount++;
    });
    restore.push(() => disposable.dispose());

    // Switching to multi mode triggers a rebuild and refresh.
    registry.setMode("multi");
    assert.strictEqual(refreshCount, 1, "mode change should refresh");

    // Adding a manual root triggers a rebuild and refresh.
    const manualDir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-manual-"));
    restore.push(() => fs.rm(manualDir, { recursive: true, force: true }));
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(manualDir));
    registry.addManualRoot(vscode.Uri.file(manualDir), "Manual Root");
    assert.strictEqual(refreshCount, 2, "root add should refresh");

    // Removing a root triggers a rebuild and refresh.
    const manualRoots = registry.getRoots().filter((r) => r.source === "manual");
    assert.ok(manualRoots.length);
    const manualRootId = manualRoots[0].id;
    registry.removeManualRoot(manualRootId);
    assert.strictEqual(refreshCount, 3, "root remove should refresh");

    provider.dispose();
    registry.dispose();
  });

  test("collapse keys remain root-specific in multi mode", async () => {
    const dir1 = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-collapse1-"));
    const dir2 = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-collapse2-"));
    restore.push(() => fs.rm(dir1, { recursive: true, force: true }));
    restore.push(() => fs.rm(dir2, { recursive: true, force: true }));
    const rootDir1 = path.join(dir1, "docs", "todos");
    const rootDir2 = path.join(dir2, "docs", "todos");

    const folder1 = makeFolder("root1", dir1);
    const folder2 = makeFolder("root2", dir2);
    const { registry, provider, restore: cleanup } = await setupRegistry(
      [folder1, folder2],
      [],
      [
        { dir: rootDir1, files: [{ id: "001", status: "pending", priority: "p2", title: "Root One Todo" }] },
        { dir: rootDir2, files: [{ id: "002", status: "ready", priority: "p1", title: "Root Two Todo" }] },
      ],
    );
    restore.push(cleanup);

    registry.setMode("multi");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const children = provider.getChildren() as RootNode[];
    assert.strictEqual(children.length, 2);

    // Child TreeItems receive root-prefixed stable ids.
    for (const root of children) {
      const item = findTodoTreeItem(root, provider);
      assert.ok(item, `Expected a todo item under root ${root.rootId}`);
      assert.ok((item.id ?? "").startsWith(`${root.rootId}:`));
      // The resource URI is preserved and points to the correct root.
      const rootDescriptor = registry.getRoot(root.rootId);
      assert.ok(rootDescriptor);
      assert.ok(item.resourceUri?.fsPath.startsWith(`${rootDescriptor.uri.fsPath}/`));
    }

    // Child providers are separate instances with isolated state.
    const provider0 = provider.getChildProvider(children[0].rootId);
    const provider1 = provider.getChildProvider(children[1].rootId);
    assert.ok(provider0);
    assert.ok(provider1);
    assert.notStrictEqual(provider0, provider1);

    provider.dispose();
    registry.dispose();
  });

  test("root persistence hash uses Unicode code points for BMP and astral paths", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-unicode-"));
    const restoreBase = () => fs.rm(baseDir, { recursive: true, force: true });
    restore.push(restoreBase);
    const paths = ["bmp-é", "astral-🧭"].map((name) => path.join(baseDir, name));
    const folders = paths.map((fsPath, index) => makeFolder(`unicode-${index}`, fsPath));
    const { registry, provider, memento, restore: cleanup } = await setupRegistry(
      folders,
      [],
      paths.map((fsPath) => ({ dir: path.join(fsPath, "docs", "todos"), files: [] })),
    );
    restore.push(cleanup);

    registry.setMode("multi");
    const roots = provider.getChildren() as RootNode[];
    assert.strictEqual(roots.length, paths.length);
    for (const root of roots) {
      let expectedHash = 0;
      for (const char of root.rootId) {
        expectedHash = Math.trunc(expectedHash * 31 + (char.codePointAt(0) ?? 0));
        expectedHash %= 4_294_967_296;
        if (expectedHash >= 2_147_483_648) expectedHash -= 4_294_967_296;
        else if (expectedHash < -2_147_483_648) expectedHash += 4_294_967_296;
      }
      const expectedSuffix = `r${Math.abs(expectedHash).toString(36)}`;
      provider.collapse(root);
      assert.deepStrictEqual(
        memento.get(`agendo.tree.collapsed.roots.${expectedSuffix}`),
        [root.rootId],
      );
    }

    provider.dispose();
    registry.dispose();
  });

  test("root-container collapsed state persists per root across reconstruction", async () => {
    const dir1 = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-persist-root1-"));
    const dir2 = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-persist-root2-"));
    restore.push(() => fs.rm(dir1, { recursive: true, force: true }));
    restore.push(() => fs.rm(dir2, { recursive: true, force: true }));
    const rootDir1 = path.join(dir1, "docs", "todos");
    const rootDir2 = path.join(dir2, "docs", "todos");

    const folder1 = makeFolder("root1", dir1);
    const folder2 = makeFolder("root2", dir2);
    const { registry, memento, restore: cleanup } = await setupRegistry(
      [folder1, folder2],
      [],
      [
        { dir: rootDir1, files: [{ id: "001", status: "pending", priority: "p2", title: "Root One Todo" }] },
        { dir: rootDir2, files: [{ id: "002", status: "ready", priority: "p1", title: "Root Two Todo" }] },
      ],
    );
    restore.push(cleanup);

    registry.setMode("multi");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const provider = new MultiRootTreeProvider(registry, memento);
    const children = provider.getChildren() as RootNode[];
    assert.strictEqual(children.length, 2);

    // Collapse both roots.
    provider.collapse(children[0]);
    provider.collapse(children[1]);
    assert.strictEqual(
      (provider.getTreeItem(children[0]) as vscode.TreeItem).collapsibleState,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    assert.strictEqual(
      (provider.getTreeItem(children[1]) as vscode.TreeItem).collapsibleState,
      vscode.TreeItemCollapsibleState.Collapsed,
    );

    // Reconstruct the provider over the same registry/memento; both roots remain collapsed.
    const reconstructed = new MultiRootTreeProvider(registry, memento);
    const reconstructedChildren = reconstructed.getChildren() as RootNode[];
    assert.strictEqual(
      (reconstructed.getTreeItem(reconstructedChildren[0]) as vscode.TreeItem).collapsibleState,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    assert.strictEqual(
      (reconstructed.getTreeItem(reconstructedChildren[1]) as vscode.TreeItem).collapsibleState,
      vscode.TreeItemCollapsibleState.Collapsed,
    );

    // Expanding one root leaves the other collapsed.
    reconstructed.expand(reconstructedChildren[0]);
    assert.strictEqual(
      (reconstructed.getTreeItem(reconstructedChildren[0]) as vscode.TreeItem).collapsibleState,
      vscode.TreeItemCollapsibleState.Expanded,
    );
    assert.strictEqual(
      (reconstructed.getTreeItem(reconstructedChildren[1]) as vscode.TreeItem).collapsibleState,
      vscode.TreeItemCollapsibleState.Collapsed,
    );

    provider.dispose();
    reconstructed.dispose();
    registry.dispose();
  });

  test("code-scanning scope is passed to each root's child provider", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-scope-"));
    restore.push(() => fs.rm(dir, { recursive: true, force: true }));
    const rootDir = path.join(dir, "docs", "todos");
    const scanDir = path.join(rootDir, "code-scanning", "codeql");
    await writeTodo(rootDir, "001", "pending", "p2", "Regular Todo");
    await writeTodo(scanDir, "cql-001", "pending", "p2", "Scanner Todo");

    const folder = makeFolder("folder-a", dir);
    const { registry, memento, provider, restore: cleanup } = await setupRegistry(
      [folder],
      [],
      [
        { dir: rootDir, files: [{ id: "001", status: "pending", priority: "p2", title: "Regular Todo" }] },
        { dir: scanDir, files: [{ id: "cql-001", status: "pending", priority: "p2", title: "Scanner Todo" }] },
      ],
    );
    restore.push(cleanup);

    // Default scope "todos": only regular (non-scanner) todos appear.
    const todosInTodosScope = collectTodos(provider.getChildren(), provider);
    assert.strictEqual(todosInTodosScope.length, 1);
    assert.strictEqual(todosInTodosScope[0].id, "001");
    assert.strictEqual(todosInTodosScope[0].folder, "");

    // Code-scanning scope: only scanner todos appear.
    const scanningProvider = new MultiRootTreeProvider(registry, memento, undefined, "code-scanning");
    const todosInScanningScope = collectTodos(scanningProvider.getChildren(), scanningProvider);
    assert.strictEqual(todosInScanningScope.length, 1);
    assert.strictEqual(todosInScanningScope[0].id, "cql-001");
    assert.strictEqual(todosInScanningScope[0].folder, "code-scanning/codeql");

    scanningProvider.dispose();
    provider.dispose();
    registry.dispose();
  });

  test("collapse/expand persists per root across provider reconstruction", async () => {
    const dir1 = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-persist1-"));
    const dir2 = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-persist2-"));
    restore.push(() => fs.rm(dir1, { recursive: true, force: true }));
    restore.push(() => fs.rm(dir2, { recursive: true, force: true }));
    const rootDir1 = path.join(dir1, "docs", "todos");
    const rootDir2 = path.join(dir2, "docs", "todos");

    const folder1 = makeFolder("root1", dir1);
    const folder2 = makeFolder("root2", dir2);
    const { registry, memento, restore: cleanup } = await setupRegistry(
      [folder1, folder2],
      [],
      [
        { dir: rootDir1, files: [{ id: "001", status: "pending", priority: "p2", title: "Root One Todo" }] },
        { dir: rootDir2, files: [{ id: "002", status: "ready", priority: "p1", title: "Root Two Todo" }] },
      ],
    );
    restore.push(cleanup);

    registry.setMode("multi");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const provider = new MultiRootTreeProvider(registry, memento);
    const children = provider.getChildren() as RootNode[];
    assert.strictEqual(children.length, 2);

    // Collapse root 0.
    provider.collapse(children[0]);
    assert.strictEqual(
      (provider.getTreeItem(children[0]) as vscode.TreeItem).collapsibleState,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    // Root 1 should be unaffected.
    assert.strictEqual(
      (provider.getTreeItem(children[1]) as vscode.TreeItem).collapsibleState,
      vscode.TreeItemCollapsibleState.Expanded,
    );

    // Reconstruct the provider over the same registry/memento; collapsed state
    // should persist via workspaceState.
    const reconstructed = new MultiRootTreeProvider(registry, memento);
    const reconstructedChildren = reconstructed.getChildren() as RootNode[];
    assert.strictEqual(
      (reconstructed.getTreeItem(reconstructedChildren[0]) as vscode.TreeItem).collapsibleState,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    // The other root should not be affected by the reconstruction.
    assert.strictEqual(
      (reconstructed.getTreeItem(reconstructedChildren[1]) as vscode.TreeItem).collapsibleState,
      vscode.TreeItemCollapsibleState.Expanded,
    );

    provider.dispose();
    reconstructed.dispose();
    registry.dispose();
  });

  test("collapse/expand persists child node state per root", async () => {
    const dir1 = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-persist-child1-"));
    const dir2 = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-persist-child2-"));
    restore.push(() => fs.rm(dir1, { recursive: true, force: true }));
    restore.push(() => fs.rm(dir2, { recursive: true, force: true }));
    const rootDir1 = path.join(dir1, "docs", "todos");
    const rootDir2 = path.join(dir2, "docs", "todos");

    const folder1 = makeFolder("root1", dir1);
    const folder2 = makeFolder("root2", dir2);
    const { registry, memento, restore: cleanup } = await setupRegistry(
      [folder1, folder2],
      [],
      [
        { dir: rootDir1, files: [{ id: "001", status: "pending", priority: "p2", title: "Root One Todo" }] },
        { dir: rootDir2, files: [{ id: "002", status: "ready", priority: "p1", title: "Root Two Todo" }] },
      ],
    );
    restore.push(cleanup);

    registry.setMode("multi");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const provider = new MultiRootTreeProvider(registry, memento);
    const children = provider.getChildren() as RootNode[];

    // Expand root 0 to reveal its status-group child, then collapse that child.
    const rootChildren = provider.getChildren(children[0]) as RootChildNode[];
    assert.strictEqual(rootChildren.length, 1);
    const statusChild = rootChildren[0];
    assert.strictEqual(statusChild.node.kind, "status");

    provider.collapse(statusChild);
    assert.strictEqual(
      (provider.getTreeItem(statusChild) as vscode.TreeItem).collapsibleState,
      vscode.TreeItemCollapsibleState.Collapsed,
    );

    // Reconstruct the provider; the child's collapsed state should persist.
    const reconstructed = new MultiRootTreeProvider(registry, memento);
    const reconstructedChildren = reconstructed.getChildren() as RootNode[];
    const reconstructedRootChildren = reconstructed.getChildren(reconstructedChildren[0]) as RootChildNode[];
    assert.strictEqual(reconstructedRootChildren.length, 1);
    assert.strictEqual(
      (reconstructed.getTreeItem(reconstructedRootChildren[0]) as vscode.TreeItem).collapsibleState,
      vscode.TreeItemCollapsibleState.Collapsed,
    );

    // The other root's child should be unaffected.
    const otherRootChildren = reconstructed.getChildren(reconstructedChildren[1]) as RootChildNode[];
    assert.strictEqual(
      (reconstructed.getTreeItem(otherRootChildren[0]) as vscode.TreeItem).collapsibleState,
      vscode.TreeItemCollapsibleState.Expanded,
    );

    provider.dispose();
    reconstructed.dispose();
    registry.dispose();
  });
});
