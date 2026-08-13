import * as assert from "node:assert";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { out, outputChannel, showOutputChannel } from "../output";
import { ConfigService } from "../todos/configService";
import { StatusService } from "../todos/statusService";
import {
  buildFileName,
  isTodoFileName,
  parseFrontmatter,
  parseTodo,
  splitFrontmatter,
  type Todo,
} from "../todos/todoModel";
import { getTreeNodeKey, TodoTreeProvider } from "../todos/todoTreeProvider";
import { TreeStateService } from "../todos/treeStateService";

suite("todoModel", () => {
  test("isTodoFileName matches the naming contract", () => {
    assert.ok(isTodoFileName("060-pending-p3-vscode-extension.md"));
    assert.ok(isTodoFileName("001-complete-p1-done.md"));
    assert.ok(isTodoFileName("053-cancelled-p2-superseded.md"));
    assert.ok(!isTodoFileName("readme.md"));
    assert.ok(!isTodoFileName("60-pending-p3-short-id.md"));
    assert.ok(!isTodoFileName("060-unknown-p3-bad-status.md"));
  });

  test("buildFileName composes parts", () => {
    assert.strictEqual(
      buildFileName("060", "backlogged", "p3", "my-todo"),
      "060-backlogged-p3-my-todo.md",
    );
  });

  test("splitFrontmatter separates data and body", () => {
    const content = "---\nstatus: pending\n---\n# Title\nBody";
    const { data, body } = splitFrontmatter(content);
    assert.strictEqual(data, "status: pending");
    assert.ok(body.includes("# Title"));
  });

  test("parseFrontmatter handles scalars, flow arrays and block arrays", () => {
    const data = [
      "status: pending",
      'issue_id: "060"',
      "tags: [tooling, vscode]",
      "epic: true",
      "dependencies:",
      "  - 050",
      "  - 051",
    ].join("\n");
    const fm = parseFrontmatter(data);
    assert.strictEqual(fm.status, "pending");
    assert.strictEqual(fm.issue_id, "060");
    assert.deepStrictEqual(fm.tags, ["tooling", "vscode"]);
    assert.strictEqual(fm.epic, true);
    assert.deepStrictEqual(fm.dependencies, ["050", "051"]);
  });

  test("parseTodo derives fields from filename and body", () => {
    const uri = vscode.Uri.file("/tmp/060-ready-p2-do-the-thing.md");
    const content = [
      "---",
      "status: ready",
      "priority: p2",
      'issue_id: "060"',
      "tags: [alpha]",
      "---",
      "",
      "# Do The Thing",
      "",
      "Body.",
    ].join("\n");
    const todo = parseTodo(uri, content, "");
    assert.ok(todo);
    assert.strictEqual(todo?.id, "060");
    assert.strictEqual(todo?.status, "ready");
    assert.strictEqual(todo?.priority, "p2");
    assert.strictEqual(todo?.title, "Do The Thing");
    assert.deepStrictEqual(todo?.tags, ["alpha"]);
  });

  test("parseTodo accepts generic and legacy external keys", () => {
    const uri = vscode.Uri.file("/tmp/061-pending-p3-track-work.md");

    const generic = parseTodo(uri, "---\nkey: TSS-1601\njira: TSS-9999\n---\n# Track Work", "");
    assert.strictEqual(generic?.key, "TSS-1601");
    assert.strictEqual(generic?.jira, "TSS-9999");

    const legacy = parseTodo(uri, "---\njira: TSS-1601\n---\n# Track Work", "");
    assert.strictEqual(legacy?.key, "TSS-1601");
    assert.strictEqual(legacy?.jira, "TSS-1601");

    const untracked = parseTodo(uri, "# Track Work", "");
    assert.strictEqual(untracked?.key, undefined);
    assert.strictEqual(untracked?.jira, undefined);
  });

  test("tree node IDs are stable for persisted collapse state", () => {
    assert.strictEqual(
      getTreeNodeKey({ kind: "status", status: "ready", count: 3 }),
      "status:ready",
    );
    assert.strictEqual(
      getTreeNodeKey({ kind: "priority", status: "ready", priority: "p2", todos: [] }),
      "priority:ready:p2",
    );
    assert.strictEqual(getTreeNodeKey({ id: "status:ready" }), "status:ready");
    assert.strictEqual(getTreeNodeKey({ id: "priority:ready:p2" }), "priority:ready:p2");
    assert.strictEqual(getTreeNodeKey({ kind: "todo", todo: undefined as never }), undefined);
  });

  test("tree state persists collapsed nodes across workspace-state reloads", async () => {
    const store = new Map<string, unknown>();
    const state = {
      get: <T>(key: string, fallback: T): T => (store.has(key) ? (store.get(key) as T) : fallback),
      update: async (key: string, value: unknown) => {
        store.set(key, value);
      },
    };

    const first = new TreeStateService(state as never);
    await first.collapse("status:ready");
    await first.collapse("priority:ready:p2");

    const second = new TreeStateService(state as never);
    assert.strictEqual(second.isCollapsed("status:ready"), true);
    assert.strictEqual(second.isCollapsed("priority:ready:p2"), true);
    assert.strictEqual(second.isCollapsed("status:pending"), false);
  });

  test("config service normalizes the todo root and writes the project config file", async () => {
    const service = new ConfigService();
    const rootUri = vscode.Uri.file(path.join(os.tmpdir(), "agendo-config-tests", "docs", "todos"));
    Object.defineProperty(service, "getRootUri", { value: () => rootUri });

    await vscode.workspace.fs.createDirectory(rootUri);
    await service.writeConfigFile();

    const bytes = await vscode.workspace.fs.readFile(
      vscode.Uri.joinPath(rootUri, ".agendo-config.json"),
    );
    const config = JSON.parse(Buffer.from(bytes).toString("utf8"));
    assert.deepStrictEqual(config, {
      root: "docs/todos",
      gitignored: false,
      backlogFolder: "backlog",
      cancelledFolder: "cancelled",
      completeFolder: "complete",
    });
  });

  test("tree provider groups visible todos by status and priority", () => {
    const todos: Todo[] = [
      {
        id: "001",
        status: "ready",
        priority: "p1",
        title: "First",
        description: "first",
        tags: ["alpha"],
        dependencies: [],
        key: "ABC-1",
        children: [],
        epic: false,
        folder: "",
        fileName: "001-ready-p1-first.md",
        uri: vscode.Uri.file("/tmp/001-ready-p1-first.md"),
        frontmatter: { status: "ready", priority: "p1" },
      },
      {
        id: "002",
        status: "pending",
        priority: "p2",
        title: "Second",
        description: "second",
        tags: [],
        dependencies: ["001"],
        children: [],
        epic: true,
        folder: "",
        fileName: "002-pending-p2-second.md",
        uri: vscode.Uri.file("/tmp/002-pending-p2-second.md"),
        frontmatter: { status: "pending", priority: "p2" },
      },
    ];

    const repository = {
      getTodos: () => todos,
      onDidChange: () => undefined,
    };
    const filter = { matches: () => true };
    const config = { openInPreview: false };
    const treeState = new TreeStateService({
      get: () => [],
      update: async () => undefined,
    } as never);

    const provider = new TodoTreeProvider(
      repository as never,
      filter as never,
      config as never,
      treeState,
    );

    const topLevel = provider.getChildren();
    assert.deepStrictEqual(
      topLevel.map((node) => (node as { status: string }).status),
      ["ready", "pending"],
    );

    const readyGroup = provider.getChildren(topLevel[0] as never);
    assert.strictEqual((readyGroup[0] as { kind: string }).kind, "priority");

    const todoNodes = provider.getChildren(readyGroup[0] as never);
    const item = provider.getTreeItem(todoNodes[0] as never);
    assert.strictEqual(item.contextValue, "todoItem");
    assert.ok(item.tooltip instanceof vscode.MarkdownString);
    assert.strictEqual(item.command?.command, "vscode.open");
  });

  test("status service moves files and updates frontmatter when status or priority changes", async () => {
    const rootUri = vscode.Uri.file(path.join(os.tmpdir(), "agendo-status-tests"));
    await vscode.workspace.fs.createDirectory(rootUri);
    const originalUri = vscode.Uri.joinPath(rootUri, "060-ready-p2-do-the-thing.md");
    const initialContent = [
      "---",
      "status: ready",
      "priority: p2",
      "tags: [alpha]",
      "---",
      "",
      "# Do The Thing",
      "",
      "Body.",
    ].join("\n");
    await vscode.workspace.fs.writeFile(originalUri, Buffer.from(initialContent, "utf8"));

    const todo: Todo = {
      id: "060",
      status: "ready",
      priority: "p2",
      title: "Do The Thing",
      description: "do-the-thing",
      tags: ["alpha"],
      dependencies: [],
      key: undefined,
      children: [],
      epic: false,
      folder: "",
      fileName: "060-ready-p2-do-the-thing.md",
      uri: originalUri,
      frontmatter: { status: "ready", priority: "p2", tags: ["alpha"] },
    };

    const config = {
      getRootUri: () => rootUri,
      backlogFolder: "backlog",
      completeFolder: "complete",
      cancelledFolder: "cancelled",
    } as never;
    const service = new StatusService(config);

    const cancelledUri = await service.setStatus(todo, "cancelled");
    assert.ok(cancelledUri);

    assert.ok(cancelledUri !== undefined);
    const cancelledData = Buffer.from(await vscode.workspace.fs.readFile(cancelledUri)).toString(
      "utf8",
    );
    assert.match(cancelledData, /status: cancelled/);
    assert.match(cancelledData, /tags: \[alpha, cancelled\]/);
    assert.match(cancelledData, /> \*\*CANCELLED\*\*/);

    const nextTodo: Todo = {
      ...todo,
      uri: cancelledUri,
      status: "cancelled",
      folder: "cancelled",
      fileName: "060-cancelled-p2-do-the-thing.md",
    };
    const priorityUri = await service.setPriority(nextTodo, "p1");
    assert.ok(priorityUri);

    const priorityData = Buffer.from(await vscode.workspace.fs.readFile(priorityUri)).toString(
      "utf8",
    );
    assert.match(priorityData, /priority: p1/);
    assert.match(priorityData, /status: cancelled/);
    assert.ok(
      (
        await vscode.workspace.fs.stat(
          vscode.Uri.joinPath(rootUri, "cancelled", "060-cancelled-p1-do-the-thing.md"),
        )
      ).type !== undefined,
    );
  });

  test("tree state service persists collapsed state and clears all entries", async () => {
    const memory = new Map<string, string[]>();
    const state = {
      get: (key: string, fallback: string[]) => memory.get(key) ?? fallback,
      update: async (key: string, value: string[]) => {
        memory.set(key, value);
      },
    };

    const service = new TreeStateService(state as never);
    assert.strictEqual(service.isCollapsed("status:ready"), false);

    await service.collapse("status:ready");
    assert.strictEqual(service.isCollapsed("status:ready"), true);

    await service.toggle("status:ready");
    assert.strictEqual(service.isCollapsed("status:ready"), false);

    await service.expand("status:pending");
    await service.toggle("status:pending");
    assert.strictEqual(service.isCollapsed("status:pending"), true);

    await service.clear();
    assert.strictEqual(service.isCollapsed("status:ready"), false);
    assert.strictEqual(service.isCollapsed("status:pending"), false);
  });

  test("config service exposes subfolder URIs and applies gitignore state", async () => {
    const workspaceRoot = vscode.Uri.file(path.join(os.tmpdir(), "agendo-workspace"));
    const workspaceFolder = {
      uri: workspaceRoot,
      name: "workspace",
      index: 0,
    };
    Object.defineProperty(vscode.workspace, "workspaceFolders", {
      value: [workspaceFolder],
      configurable: true,
    });

    const service = new ConfigService();
    Object.defineProperty(service, "root", { get: () => "docs/todos" });
    Object.defineProperty(service, "gitignored", { get: () => true });
    Object.defineProperty(service, "backlogFolder", { get: () => "backlog" });
    Object.defineProperty(service, "cancelledFolder", { get: () => "cancelled" });
    Object.defineProperty(service, "completeFolder", { get: () => "complete" });

    const rootUri = service.getRootUri();
    const subfolderUri = service.getSubfolderUri("backlog");
    assert.ok(rootUri);
    assert.ok(subfolderUri);
    assert.strictEqual(rootUri?.fsPath, path.join(workspaceRoot.fsPath, "docs", "todos"));
    assert.strictEqual(
      subfolderUri?.fsPath,
      path.join(workspaceRoot.fsPath, "docs", "todos", "backlog"),
    );

    await service.applyGitignore();
    const gitignoreUri = vscode.Uri.joinPath(rootUri ?? workspaceRoot, ".gitignore");
    const content = Buffer.from(await vscode.workspace.fs.readFile(gitignoreUri)).toString("utf8");
    assert.match(content, /^\*/m);
    assert.match(content, /!\.gitignore/);
    assert.match(content, /!\.agendo-config\.json/);
  });

  test("output helpers format template strings and placeholder messages", () => {
    const originalAppendLine = outputChannel.appendLine.bind(outputChannel);
    const originalShow = outputChannel.show.bind(outputChannel);
    const messages: string[] = [];
    const shown: { count: number } = { count: 0 };

    (outputChannel as { appendLine: (value: string) => void }).appendLine = (value: string) => {
      messages.push(value);
    };
    (outputChannel as { show: () => void }).show = () => {
      shown.count += 1;
    };

    try {
      out`hello ${"world"}`;
      out("value {0} and {1}", "alpha", "beta");
      out("plain-message");
      assert.ok(messages.some((value) => value.includes("hello world")));
      assert.ok(messages.some((value) => value.includes("value alpha and beta")));
      assert.ok(messages.some((value) => value === "plain-message"));
      showOutputChannel();
      assert.strictEqual(shown.count, 1);
    } finally {
      (outputChannel as { appendLine: (value: string) => void }).appendLine = originalAppendLine;
      (outputChannel as { show: () => void }).show = originalShow;
    }
  });
});
