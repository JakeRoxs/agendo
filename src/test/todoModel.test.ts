import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { performance } from "node:perf_hooks";
import * as vscode from "vscode";
import { Command } from "../commands";
import { get, Settings, set, setDefault } from "../configuration";
import { activate, deactivate } from "../extension";
import { out, outputChannel, showOutputChannel } from "../output";
import {
  applyBoardColumnRules,
  type BoardColumn,
  type BoardTodo,
  BoardViewProvider,
  buildBoardSnapshot,
  limitTerminalBoardColumns,
  normalizeBoardCardFieldOrder,
  sortBoardTodos,
} from "../todos/boardViewProvider";
import { ConfigService } from "../todos/configService";
import { buildTodoDigest } from "../todos/digestService";
import { readText } from "../todos/fileSystem";
import { FilterService } from "../todos/filterService";
import { LinkService } from "../todos/linkService";
import { SkillManager } from "../todos/skillManager";
import { SkillStatusTreeProvider } from "../todos/skillStatusTreeProvider";
import { StatusService } from "../todos/statusService";
import {
  ACTIVE_STATUSES,
  buildFileName,
  getBlockedBy,
  isBlocked,
  isTodoFileName,
  parseFrontmatter,
  parseTodo,
  splitFrontmatter,
  TERMINAL_STATUSES,
  TODO_STATUSES,
  type Todo,
} from "../todos/todoModel";
import { TodoRepository } from "../todos/todoRepository";
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

  test("buildFileName sanitizes unsafe path segments", () => {
    assert.strictEqual(
      buildFileName("060", "ready", "p2", "../../evil/notes.md"),
      "060-ready-p2-evil-notes-md.md",
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
    assert.strictEqual(todo?.summary, "Body.");
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

  test("parseTodo recognizes in-progress status and treats it as active", () => {
    const uri = vscode.Uri.file("/tmp/060-in-progress-p2-do-the-thing.md");
    const content = [
      "---",
      "status: in-progress",
      "priority: p2",
      'issue_id: "060"',
      "---",
      "",
      "# Do The Thing",
    ].join("\n");
    const todo = parseTodo(uri, content, "");
    assert.ok(todo);
    assert.strictEqual(todo?.status, "in-progress");
    assert.ok(ACTIVE_STATUSES.includes(todo?.status ?? ""));
    assert.ok(!TERMINAL_STATUSES.includes(todo?.status ?? ""));
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
    assert.strictEqual(
      getTreeNodeKey({ kind: "group", status: "ready", group: "auth", todos: [] }),
      "group:ready:auth",
    );
    assert.notStrictEqual(
      getTreeNodeKey({ kind: "group", status: "ready", group: "auth", todos: [] }),
      getTreeNodeKey({ kind: "group", status: "pending", group: "auth", todos: [] }),
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

  test("configuration helpers delegate to VS Code settings", async () => {
    const updates: Array<{ key: string; value: unknown; target: number }> = [];
    const config = {
      get: (key: string) => {
        if (key === Settings.Root) return "docs\\todos";
        if (key === Settings.DefaultPriority) return "p2";
        if (key === Settings.OpenInPreview) return false;
        if (key === Settings.GitignoreTodos) return true;
        if (key === Settings.CompleteFolder) return "complete";
        if (key === Settings.CancelledFolder) return "cancelled";
        if (key === Settings.BacklogFolder) return "backlog";
        return undefined;
      },
      update: async (key: string, value: unknown, target: number) => {
        updates.push({ key, value, target });
      },
    };
    const originalGetConfiguration = vscode.workspace.getConfiguration;
    Object.defineProperty(vscode.workspace, "getConfiguration", {
      value: () => config,
      configurable: true,
    });

    try {
      await set(Settings.Root, "docs/todos");
      await setDefault(Settings.DefaultPriority, "p1");
      assert.strictEqual(get<string>(Settings.Root), "docs\\todos");
      assert.strictEqual(get<string>(Settings.DefaultPriority), "p2");
      assert.strictEqual(get<boolean>(Settings.OpenInPreview), false);
      assert.strictEqual(get<boolean>(Settings.GitignoreTodos), true);
      assert.deepStrictEqual(updates[0], {
        key: Settings.Root,
        value: "docs/todos",
        target: vscode.ConfigurationTarget.Workspace,
      });
      assert.deepStrictEqual(updates[1], {
        key: Settings.DefaultPriority,
        value: "p1",
        target: vscode.ConfigurationTarget.Global,
      });
    } finally {
      Object.defineProperty(vscode.workspace, "getConfiguration", {
        value: originalGetConfiguration,
        configurable: true,
      });
    }
  });

  test("readText decodes workspace files as UTF-8", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-read-text-"));
    const uri = vscode.Uri.file(path.join(directory, "sample.md"));
    const expected = "Agendo \u2713";

    try {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(expected, "utf8"));
      assert.strictEqual(await readText(uri), expected);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
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

    const root = service.root;
    assert.strictEqual(root, "docs/todos");
    assert.deepStrictEqual(service.toTodosConfig(), {
      root: "docs/todos",
      gitignored: false,
      backlogFolder: "backlog",
      cancelledFolder: "cancelled",
      completeFolder: "complete",
    });

    const missingRoot = new ConfigService();
    Object.defineProperty(vscode.workspace, "workspaceFolders", {
      value: undefined,
      configurable: true,
    });
    assert.strictEqual(missingRoot.getRootUri(), undefined);
    assert.strictEqual(missingRoot.getSubfolderUri("backlog"), undefined);
  });

  test("config service resolves view mode and opens todos via the matching command", async () => {
    const originalGetConfiguration = vscode.workspace.getConfiguration;
    const originalExecuteCommand = vscode.commands.executeCommand;
    const executed: string[] = [];

    function mockConfig(viewMode: unknown, openInPreview: boolean) {
      Object.defineProperty(vscode.workspace, "getConfiguration", {
        value: () => ({
          get: (key: string) =>
            key === Settings.ViewMode
              ? viewMode
              : key === Settings.OpenInPreview
                ? openInPreview
                : undefined,
          update: async () => undefined,
          inspect: (key: string) =>
            key === Settings.ViewMode && viewMode !== undefined
              ? { globalValue: viewMode }
              : undefined,
        }),
        configurable: true,
      });
    }
    Object.defineProperty(vscode.commands, "executeCommand", {
      value: async (command: string) => {
        executed.push(command);
        return undefined;
      },
      configurable: true,
    });

    try {
      // Explicit viewMode wins.
      mockConfig("editor", false);
      assert.strictEqual(new ConfigService().viewMode, "editor");

      // Falls back to openInPreview when viewMode is not explicitly set.
      mockConfig(undefined, true);
      assert.strictEqual(new ConfigService().viewMode, "preview");
      mockConfig(undefined, false);
      assert.strictEqual(new ConfigService().viewMode, "editor");

      // openTodo delegates to the matching VS Code command.
      const service = new ConfigService();
      mockConfig("preview", true);
      await service.openTodo(vscode.Uri.file("/tmp/t.md"));
      assert.ok(executed.includes("markdown.showPreview"));
    } finally {
      Object.defineProperty(vscode.workspace, "getConfiguration", {
        value: originalGetConfiguration,
        configurable: true,
      });
      Object.defineProperty(vscode.commands, "executeCommand", {
        value: originalExecuteCommand,
        configurable: true,
      });
    }
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
      getDependencyGraph: () => ({
        blockedBy: new Map([
          ["001", []],
          ["002", ["001"]],
        ]),
        blocking: new Map([
          ["001", ["002"]],
          ["002", []],
        ]),
      }),
      onDidChange: () => undefined,
    };
    const filter = { matches: () => true };
    const treeState = new TreeStateService({
      get: () => [],
      update: async () => undefined,
    } as never);

    const provider = new TodoTreeProvider(repository as never, filter as never, treeState);

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
    assert.strictEqual(item.command?.command, Command.OpenPreview);
  });

  test("tree provider renders 200 dependency-indexed todos without a performance regression", () => {
    const todos = Array.from({ length: 200 }, (_, index): Todo => {
      const id = String(index + 1).padStart(3, "0");
      return {
        id,
        status: "ready",
        priority: "p2",
        title: `Todo ${id}`,
        description: `todo-${id}`,
        tags: [],
        dependencies: index === 0 ? [] : ["001"],
        children: [],
        epic: false,
        folder: "",
        fileName: `${id}-ready-p2-todo-${id}.md`,
        uri: vscode.Uri.file(`/tmp/${id}-ready-p2-todo-${id}.md`),
        frontmatter: { status: "ready", priority: "p2" },
      };
    });
    const dependencyGraph = {
      blockedBy: new Map(todos.map((todo) => [todo.id, todo.dependencies.length ? ["001"] : []])),
      blocking: new Map(todos.map((todo) => [todo.id, todo.id === "001" ? ["002"] : []])),
    };
    const repository = {
      getTodos: () => todos,
      getDependencyGraph: () => dependencyGraph,
      onDidChange: () => undefined,
    };
    const filter = { matches: () => true };
    const treeState = new TreeStateService({
      get: () => [],
      update: async () => undefined,
    } as never);
    const provider = new TodoTreeProvider(repository as never, filter as never, treeState);

    const startedAt = performance.now();
    const statuses = provider.getChildren();
    const priorities = provider.getChildren(statuses[0]);
    const todoNodes = provider.getChildren(priorities[0]);
    for (const todoNode of todoNodes) {
      provider.getTreeItem(todoNode);
    }
    const elapsed = performance.now() - startedAt;

    assert.strictEqual(todoNodes.length, 200);
    assert.ok(elapsed < 75, `Expected render under 75ms, received ${elapsed.toFixed(2)}ms`);
  });

  test("task digest deterministically ranks next actions and surfaces blockers", () => {
    const createTodo = (
      id: string,
      status: Todo["status"],
      priority: Todo["priority"],
      dependencies: string[],
      updatedAt: number,
    ): Todo => ({
      id,
      status,
      priority,
      title: `Todo ${id}`,
      description: `todo-${id}`,
      tags: [],
      dependencies,
      children: [],
      epic: false,
      folder: status === "backlogged" ? "backlog" : "",
      fileName: `${id}-${status}-${priority}-todo-${id}.md`,
      uri: vscode.Uri.file(`/tmp/${id}-${status}-${priority}-todo-${id}.md`),
      updatedAt,
      frontmatter: { status, priority },
    });
    const todos: Todo[] = [
      createTodo("001", "ready", "p2", [], 100),
      createTodo("002", "pending", "p1", ["001"], 300),
      createTodo("003", "ready", "p1", [], 200),
      createTodo("004", "backlogged", "p1", [], 400),
    ];
    const dependencyGraph = {
      blockedBy: new Map<string, readonly string[]>([
        ["001", []],
        ["002", ["001"]],
        ["003", []],
        ["004", []],
      ]),
      blocking: new Map<string, readonly string[]>([
        ["001", ["002"]],
        ["002", []],
        ["003", []],
        ["004", []],
      ]),
    };

    const digest = buildTodoDigest(todos, dependencyGraph);
    const recommended = digest.slice(
      digest.indexOf("## Recommended Next Actions"),
      digest.indexOf("## High Priority"),
    );
    const recent = digest.slice(digest.indexOf("## Recently Updated"));

    assert.strictEqual(digest, buildTodoDigest(todos, dependencyGraph));
    assert.match(digest, /Active: \*\*3\*\*/);
    assert.match(digest, /Backlogged: \*\*1\*\*/);
    assert.ok(recommended.indexOf("003") < recommended.indexOf("001"));
    assert.ok(!recommended.includes("002"));
    assert.match(digest, /002 · Todo 002 · blocked by 001/);
    assert.ok(recent.indexOf("002 · Todo 002") < recent.indexOf("003 · Todo 003"));
  });

  test("parseTodo extracts resume context for latest updates and next steps", () => {
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
      "",
      "## Resume Context",
      "",
      "**Current state:** Implemented and verified.",
      "",
      "**Next step:** Review and confirm it is functional.",
      "",
      "## Work Log",
      "",
      "### 2026-08-31 - Work",
    ].join("\n");
    const todo = parseTodo(uri, content, "");
    assert.ok(todo);
    assert.deepStrictEqual(todo?.resumeContext, {
      currentState: "Implemented and verified.",
      nextStep: "Review and confirm it is functional.",
    });

    const empty = parseTodo(
      vscode.Uri.file("/tmp/061-pending-p3-no-context.md"),
      "---\nstatus: pending\npriority: p3\n---\n# No Context",
      "",
    );
    assert.strictEqual(empty?.resumeContext, undefined);
  });

  test("task digest surfaces per-todo resume context when filled", () => {
    const base: Omit<Todo, "id" | "status" | "priority" | "fileName" | "uri" | "updatedAt"> = {
      title: "Todo",
      description: "todo",
      tags: [],
      dependencies: [],
      children: [],
      epic: false,
      folder: "",
      frontmatter: {},
    };
    const todo: Todo = {
      ...base,
      id: "002",
      status: "ready",
      priority: "p2",
      title: "Fix N+1 Query",
      description: "fix-n-1",
      folder: "",
      fileName: "002-ready-p2-fix-n-1.md",
      uri: vscode.Uri.file("/tmp/002-ready-p2-fix-n-1.md"),
      updatedAt: 100,
      resumeContext: {
        currentState: "Implemented and verified.",
        nextStep: "Confirm it is functional.",
      },
    };
    const dependencyGraph = {
      blockedBy: new Map<string, readonly string[]>([["002", []]]),
      blocking: new Map<string, readonly string[]>([["002", []]]),
    };

    const digest = buildTodoDigest([todo], dependencyGraph);
    const section = digest.slice(
      digest.indexOf("## Latest Updates & Next Steps"),
      digest.indexOf("## High Priority"),
    );
    assert.match(section, /002 · Fix N\+1 Query/);
    assert.match(section, /\*\*Now:\*\* Implemented and verified\./);
    assert.match(section, /\*\*Next:\*\* Confirm it is functional\./);
  });

  test("status service moves files and updates frontmatter when status or priority changes", async () => {
    const rootUri = vscode.Uri.file(
      await fs.mkdtemp(path.join(os.tmpdir(), "agendo-status-tests-")),
    );
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
    assert.strictEqual(
      cancelledUri.fsPath,
      path.join(rootUri.fsPath, "cancelled", "060-cancelled-p2-do-the-thing.md"),
    );
    const cancelledData = Buffer.from(await vscode.workspace.fs.readFile(cancelledUri)).toString(
      "utf8",
    );
    assert.match(cancelledData, /status: cancelled/);
    assert.match(cancelledData, /tags: \[alpha, cancelled\]/);
    assert.match(cancelledData, /> \*\*CANCELLED\*\*/);
    assert.match(cancelledData, /# Do The Thing/);

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

  test("status service warns before ready when a dependency is missing", async () => {
    const todo: Todo = {
      id: "060",
      status: "pending",
      priority: "p2",
      title: "Missing dependency",
      description: "missing-dependency",
      tags: [],
      dependencies: ["999"],
      children: [],
      epic: false,
      folder: "",
      fileName: "060-pending-p2-missing-dependency.md",
      uri: vscode.Uri.file("/tmp/060-pending-p2-missing-dependency.md"),
      frontmatter: { status: "pending", priority: "p2", dependencies: ["999"] },
    };
    const repository = {
      getTodos: () => [todo],
      getDependencyGraph: () => ({
        blockedBy: new Map([["060", ["999"]]]),
        blocking: new Map(),
      }),
    };
    const originalShowWarningMessage = vscode.window.showWarningMessage;
    let warning = "";
    Object.defineProperty(vscode.window, "showWarningMessage", {
      value: async (message: string) => {
        warning = message;
        return "Cancel";
      },
      configurable: true,
    });

    try {
      const result = await new StatusService({} as never, repository as never).setStatus(
        todo,
        "ready",
      );
      assert.strictEqual(result, undefined);
      assert.match(warning, /999 \(missing\)/);
    } finally {
      Object.defineProperty(vscode.window, "showWarningMessage", {
        value: originalShowWarningMessage,
        configurable: true,
      });
    }
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

  test("filter service matches active search and tag filters", async () => {
    const memory = new Map<string, unknown>();
    const state = {
      get: <T>(key: string, fallback: T): T =>
        memory.has(key) ? (memory.get(key) as T) : fallback,
      update: async (key: string, value: unknown) => {
        memory.set(key, value);
      },
    };

    const service = new FilterService(state as never);
    assert.strictEqual(service.isActive, false);

    await service.set({ statuses: ["pending"], priorities: ["p2"], tag: "alpha", text: "beta" });
    assert.strictEqual(service.isActive, true);
    assert.strictEqual(service.current.statuses?.includes("pending"), true);

    const todo: Todo = {
      id: "060",
      status: "pending",
      priority: "p2",
      title: "Beta backlog",
      description: "notes for beta",
      tags: ["alpha", "ops"],
      dependencies: ["050"],
      key: "ABC-2",
      children: [],
      epic: false,
      folder: "",
      fileName: "060-pending-p2-beta-backlog.md",
      uri: vscode.Uri.file("/tmp/060-pending-p2-beta-backlog.md"),
      frontmatter: { status: "pending", priority: "p2", tags: ["alpha", "ops"] },
    };

    assert.strictEqual(service.matches(todo), true);
    assert.strictEqual(service.matches({ ...todo, status: "ready" }), false);

    await service.clear();
    assert.strictEqual(service.isActive, false);
    assert.deepStrictEqual(service.current, {});
  });

  test("link service finds stale references and warns when they are broken", async () => {
    const rootUri = vscode.Uri.file(path.join(os.tmpdir(), "agendo-link-tests"));
    await fs.mkdir(rootUri.fsPath, { recursive: true });
    const otherUri = vscode.Uri.joinPath(rootUri, "001-ready-p1-other.md");
    const staleName = "060-ready-p2-do-the-thing.md";
    await vscode.workspace.fs.writeFile(
      otherUri,
      Buffer.from(`# Example\n\nSee [${staleName}](${staleName})\nAnd ${staleName}\n`, "utf8"),
    );

    const config = {
      getRootUri: () => rootUri,
      backlogFolder: "backlog",
      completeFolder: "complete",
      cancelledFolder: "cancelled",
    } as never;
    const service = new LinkService(config);

    const references = await service.findReferencesToName(staleName, otherUri);
    assert.strictEqual(references.length, 0);

    const hiddenUri = vscode.Uri.joinPath(rootUri, "060-ready-p2-do-the-thing.md");
    const refs = await service.findReferencesToName(staleName, hiddenUri);
    assert.strictEqual(refs[0]?.count, 3);

    const originalWarning = vscode.window.showWarningMessage;
    const originalExecute = vscode.commands.executeCommand;
    let warned: string | undefined;
    let executed = false;

    Object.defineProperty(vscode.window, "showWarningMessage", {
      value: async (message: string) => {
        warned = message;
        return "Show Referrers" as never;
      },
      configurable: true,
    });
    Object.defineProperty(vscode.commands, "executeCommand", {
      value: async (command: string) => {
        executed = command === "workbench.action.findInFiles";
        return undefined;
      },
      configurable: true,
    });

    try {
      await service.warnOnBrokenReferences(staleName, hiddenUri);
      assert.ok(warned?.includes(staleName));
      assert.strictEqual(executed, true);
    } finally {
      Object.defineProperty(vscode.window, "showWarningMessage", {
        value: originalWarning,
        configurable: true,
      });
      Object.defineProperty(vscode.commands, "executeCommand", {
        value: originalExecute,
        configurable: true,
      });
    }
  });

  test("skill manager installs bundled skill files and reports version status", async () => {
    const homeDir = path.join(os.tmpdir(), "agendo-skill-tests");
    const extensionDir = path.join(homeDir, "extension");
    const skillDir = path.join(extensionDir, "resources", "skill");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.mkdir(path.join(skillDir, "assets"), { recursive: true });
    await fs.writeFile(
      path.join(skillDir, ".skill-meta.json"),
      JSON.stringify({ version: "1.2.3" }),
    );
    await fs.writeFile(path.join(skillDir, "SKILL.md"), "# bundled skill");
    await fs.writeFile(path.join(skillDir, "reconcile.md"), "# reconcile");
    await fs.writeFile(path.join(skillDir, "assets", "todo-template.md"), "# template");

    const originalHome = process.env.HOME;
    process.env.HOME = homeDir;

    try {
      const manager = new SkillManager(vscode.Uri.file(extensionDir));
      assert.strictEqual(await manager.isInstalled(), false);

      await manager.install();
      assert.strictEqual(await manager.isInstalled(), true);

      const status = await manager.getStatus();
      assert.strictEqual(status.installed, true);
      assert.strictEqual(status.bundledVersion, "1.2.3");
      assert.strictEqual(status.updateAvailable, false);
    } finally {
      if (originalHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = originalHome;
      }
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  test("skill status tree provider renders installed and update states", async () => {
    let status = {
      installed: true,
      installedVersion: "1.1.0",
      bundledVersion: "1.2.0",
      updateAvailable: true,
    };
    const provider = new SkillStatusTreeProvider(
      { getStatus: async () => status } as never,
      { viewMode: "preview" } as never,
    );

    const [updateNode, viewModeNode] = await provider.getChildren();
    const updateItem = provider.getTreeItem(updateNode);
    assert.strictEqual(updateItem.label, "Skill v1.1.0");
    assert.strictEqual(updateItem.description, "v1.2.0 available");
    assert.strictEqual(updateItem.command?.command, Command.EnableSkill);

    const viewModeItem = provider.getTreeItem(viewModeNode);
    assert.strictEqual(viewModeItem.label, "View");
    assert.strictEqual(viewModeItem.description, "Preview");
    assert.strictEqual(viewModeItem.command?.command, Command.SetViewMode);

    status = { ...status, installedVersion: "1.2.0", updateAvailable: false };
    const [installedNode] = await provider.getChildren();
    const installedItem = provider.getTreeItem(installedNode);
    assert.strictEqual(installedItem.label, "Skill v1.2.0");
    assert.strictEqual(installedItem.description, "Installed");
  });

  test("skill status provider renders unknown and install states", async () => {
    const unknownProvider = new SkillStatusTreeProvider(
      {
        getStatus: async () => {
          throw new Error("unreadable");
        },
      } as never,
      { viewMode: "editor" } as never,
    );

    const [unknownNode, viewModeNode] = await unknownProvider.getChildren();
    const unknownItem = unknownProvider.getTreeItem(unknownNode);
    assert.strictEqual(unknownItem.label, "Skill status unknown");
    assert.strictEqual(
      unknownItem.tooltip,
      "Agendo could not read the installed or bundled skill version.",
    );
    assert.strictEqual(unknownItem.command?.command, Command.EnableSkill);

    const viewModeItem = unknownProvider.getTreeItem(viewModeNode);
    assert.strictEqual(viewModeItem.label, "View");
    assert.strictEqual(viewModeItem.description, "Editor (source)");

    const installStatus = {
      installed: false,
      installedVersion: undefined,
      bundledVersion: "1.2.0",
      updateAvailable: false,
    };
    const installProvider = new SkillStatusTreeProvider(
      { getStatus: async () => installStatus } as never,
      { viewMode: "previewEditor" } as never,
    );

    const [installNode] = await installProvider.getChildren();
    const installItem = installProvider.getTreeItem(installNode);
    assert.strictEqual(installItem.label, "Install Agendo skill");
    assert.strictEqual(installItem.description, "Bundled v1.2.0");
    assert.strictEqual(installItem.tooltip, "Select to install the bundled Agendo skill.");
    assert.strictEqual(installItem.command?.command, Command.EnableSkill);
  });

  test("board snapshot preserves status columns and applies filters", async () => {
    const filter = new FilterService({
      get: <T>(_key: string, fallback: T): T => fallback,
      update: async () => undefined,
    } as never);
    await filter.set({ statuses: ["ready"] });

    const todos: Todo[] = [
      {
        id: "002",
        status: "ready",
        priority: "p2",
        title: "Second",
        summary: "Second task summary.",
        description: "second",
        tags: ["ops"],
        dependencies: ["001"],
        key: "JIRA-002",
        children: [],
        epic: true,
        folder: "",
        fileName: "002-ready-p2-second.md",
        uri: vscode.Uri.file("/tmp/002-ready-p2-second.md"),
        frontmatter: { status: "ready", priority: "p2" },
      },
      {
        id: "001",
        status: "ready",
        priority: "p1",
        title: "First",
        description: "first",
        tags: [],
        dependencies: [],
        children: [],
        epic: false,
        folder: "",
        fileName: "001-ready-p1-first.md",
        uri: vscode.Uri.file("/tmp/001-ready-p1-first.md"),
        frontmatter: { status: "ready", priority: "p1" },
      },
      {
        id: "003",
        status: "complete",
        priority: "p3",
        title: "Done",
        description: "done",
        tags: [],
        dependencies: [],
        children: [],
        epic: false,
        folder: "complete",
        fileName: "003-complete-p3-done.md",
        uri: vscode.Uri.file("/tmp/003-complete-p3-done.md"),
        frontmatter: { status: "complete", priority: "p3" },
      },
    ];
    const snapshot = buildBoardSnapshot(
      todos,
      {
        blockedBy: new Map([
          ["001", []],
          ["002", ["001"]],
          ["003", []],
        ]),
        blocking: new Map(),
      },
      filter,
    );

    assert.deepStrictEqual(
      snapshot.columns.map((column) => column.status),
      ["pending", "in-progress", "ready", "backlogged", "complete", "cancelled"],
    );
    assert.deepStrictEqual(
      snapshot.columns.find((column) => column.status === "ready")?.todos.map((todo) => todo.id),
      ["001", "002"],
    );
    assert.strictEqual(snapshot.columns.find((column) => column.status === "ready")?.totalCount, 2);
    assert.strictEqual(
      snapshot.columns.find((column) => column.status === "ready")?.todos[1]?.blocked,
      true,
    );
    assert.strictEqual(
      snapshot.columns.find((column) => column.status === "ready")?.todos[1]?.key,
      "JIRA-002",
    );
    assert.strictEqual(
      snapshot.columns.find((column) => column.status === "complete")?.todos.length,
      0,
    );
    assert.strictEqual(
      snapshot.cardFields.find((preference) => preference.field === "key")?.visible,
      true,
    );
    assert.strictEqual(
      snapshot.cardFields.find((preference) => preference.field === "createdAt")?.visible,
      false,
    );
    assert.strictEqual(snapshot.cardDensity, "comfortable");
    assert.strictEqual(snapshot.sort, "default");
    assert.strictEqual(snapshot.descriptionPreview, "hidden");
    assert.strictEqual(snapshot.hideEmptyColumns, false);
    assert.strictEqual(snapshot.showMetadataLabels, false);
    assert.strictEqual(snapshot.dateFormat, "full");
    assert.strictEqual(snapshot.tagLimit, "all");
    assert.strictEqual(snapshot.titleWrapping, "twoLines");
    assert.strictEqual(snapshot.missingValueBehavior, "omit");
    assert.strictEqual(snapshot.cardAccent, "priority");
    assert.strictEqual(snapshot.columnWidth, "standard");
    assert.strictEqual(snapshot.terminalCardLimit, "all");
    assert.deepStrictEqual(snapshot.columnSorts, {});
    assert.strictEqual(snapshot.grouping, "none");
    assert.deepStrictEqual(snapshot.wipLimits, {});
    assert.strictEqual(
      snapshot.columns.find((column) => column.status === "ready")?.todos[1]?.epic,
      true,
    );
    assert.strictEqual(
      snapshot.columns.find((column) => column.status === "ready")?.todos[1]?.summary,
      "Second task summary.",
    );
  });

  test("board card field order preserves preferences and restores missing fields", () => {
    assert.deepStrictEqual(normalizeBoardCardFieldOrder(["tags", "key", "tags"]), [
      "tags",
      "key",
      "id",
      "priority",
      "group",
      "blocked",
      "createdAt",
      "updatedAt",
    ]);
  });

  test("board card sorting uses stable id tie breakers", () => {
    const todos: BoardTodo[] = [
      {
        id: "002",
        title: "Alpha",
        status: "ready",
        priority: "p2",
        tags: [],
        epic: false,
        blocked: false,
        updatedAt: 20,
      },
      {
        id: "001",
        title: "Zulu",
        status: "ready",
        priority: "p1",
        tags: [],
        epic: false,
        blocked: false,
        updatedAt: 10,
      },
      {
        id: "003",
        title: "Bravo",
        status: "ready",
        priority: "p1",
        tags: [],
        epic: false,
        blocked: false,
      },
    ];

    assert.deepStrictEqual(
      sortBoardTodos(todos, "priority").map((todo) => todo.id),
      ["001", "003", "002"],
    );
    assert.deepStrictEqual(
      sortBoardTodos(todos, "title").map((todo) => todo.id),
      ["002", "003", "001"],
    );
    assert.deepStrictEqual(
      sortBoardTodos(todos, "updatedAt").map((todo) => todo.id),
      ["002", "001", "003"],
    );
  });

  test("board terminal limits preserve active cards and total counts", () => {
    const makeTodo = (id: string, status: Todo["status"]): BoardTodo => ({
      id,
      title: `Todo ${id}`,
      status,
      priority: "p2",
      tags: [],
      epic: false,
      blocked: false,
    });
    const columns: BoardColumn[] = [
      {
        status: "ready",
        label: "Ready",
        icon: "play-circle",
        todos: [makeTodo("001", "ready"), makeTodo("002", "ready")],
        totalCount: 2,
      },
      {
        status: "complete",
        label: "Complete",
        icon: "pass-filled",
        todos: Array.from({ length: 12 }, (_, index) =>
          makeTodo(String(index + 1).padStart(3, "0"), "complete"),
        ),
        totalCount: 12,
      },
    ];

    const limited = limitTerminalBoardColumns(columns, "10");
    assert.strictEqual(limited[0].todos.length, 2);
    assert.strictEqual(limited[1].todos.length, 10);
    assert.strictEqual(limited[1].totalCount, 12);
    assert.strictEqual(limitTerminalBoardColumns(columns, "all")[1].todos.length, 12);

    columns[0].todos[0].title = "Zulu";
    columns[0].todos[1].title = "Alpha";
    const ruled = applyBoardColumnRules(columns, "title", { ready: "id" }, { ready: 1 });
    assert.deepStrictEqual(
      ruled[0].todos.map((todo) => todo.id),
      ["001", "002"],
    );
    assert.strictEqual(ruled[0].wipLimit, 1);
  });

  test("board webview renders and persists layout messages", async () => {
    const todo: Todo = {
      id: "001",
      status: "ready",
      priority: "p2",
      title: "Board task",
      summary: "Board task summary.",
      description: "board-task",
      tags: ["board", "test"],
      dependencies: [],
      key: "JIRA-001",
      children: [],
      epic: true,
      folder: "",
      fileName: "001-ready-p2-board-task.md",
      uri: vscode.Uri.file("/tmp/001-ready-p2-board-task.md"),
      frontmatter: { status: "ready", priority: "p2" },
      createdAt: 10,
      updatedAt: 20,
    };
    const store = new Map<string, unknown>();
    const snapshots: unknown[] = [];
    let receiveMessage: ((message: unknown) => Promise<void>) | undefined;
    let disposePanel: (() => void) | undefined;
    let revealCount = 0;
    const panel = {
      webview: {
        html: "",
        onDidReceiveMessage: (listener: (message: unknown) => Promise<void>) => {
          receiveMessage = listener;
          return { dispose() {} };
        },
        postMessage: async (message: unknown) => {
          snapshots.push(message);
          return true;
        },
      },
      reveal: () => {
        revealCount += 1;
      },
      onDidDispose: (listener: () => void) => {
        disposePanel = listener;
        return { dispose() {} };
      },
    };
    const originalCreateWebviewPanel = vscode.window.createWebviewPanel;
    Object.defineProperty(vscode.window, "createWebviewPanel", {
      value: () => panel,
      configurable: true,
    });

    const repository = {
      getTodos: () => [todo],
      getDependencyGraph: () => ({
        blockedBy: new Map([[todo.id, []]]),
        blocking: new Map([[todo.id, []]]),
      }),
      refresh: async () => undefined,
      onDidChange: () => ({ dispose() {} }),
    };
    const provider = new BoardViewProvider(
      repository as never,
      { matches: () => true } as never,
      { setStatus: async () => undefined, setPriority: async () => undefined } as never,
      {
        get: <T>(key: string, fallback: T): T =>
          store.has(key) ? (store.get(key) as T) : fallback,
        update: async (key: string, value: unknown) => {
          if (value === undefined) store.delete(key);
          else store.set(key, value);
        },
      } as never,
    );

    try {
      provider.open();
      assert.match(panel.webview.html, /Agendo task board/);
      assert.ok(receiveMessage);
      const send = async (message: unknown) => receiveMessage?.(message);
      await send({ type: "ready" });
      await send({ type: "hideStatus", status: "cancelled" });
      await send({ type: "showStatus", status: "cancelled" });
      await send({ type: "reorderStatuses", statuses: ["ready", "pending"] });
      await send({ type: "setCardFieldVisibility", field: "key", visible: false });
      await send({ type: "reorderCardFields", fields: ["key", "id"] });
      await send({ type: "setCardDensity", density: "compact" });
      await send({ type: "setBoardSort", sort: "priority" });
      await send({ type: "setDescriptionPreview", descriptionPreview: "oneLine" });
      await send({ type: "setHideEmptyColumns", enabled: true });
      await send({ type: "setMetadataLabels", enabled: true });
      await send({ type: "setDateFormat", dateFormat: "relative" });
      await send({ type: "setTagLimit", tagLimit: "1" });
      await send({ type: "setTitleWrapping", titleWrapping: "oneLine" });
      await send({ type: "setMissingValueBehavior", missingValueBehavior: "placeholder" });
      await send({ type: "setCardAccent", cardAccent: "status" });
      await send({ type: "setColumnWidth", columnWidth: "wide" });
      await send({ type: "setTerminalCardLimit", terminalCardLimit: "10" });
      await send({ type: "setColumnSort", status: "ready", columnSort: "title" });
      await send({ type: "setGrouping", grouping: "epic" });
      await send({ type: "setWipLimit", status: "ready", limit: 1 });
      await send({ type: "applyPreset", preset: "review" });
      await send({ type: "resetBoardSettings" });
      provider.open();

      assert.ok(snapshots.length > 20);
      assert.strictEqual(revealCount, 1);
      assert.deepStrictEqual(store.size, 0);
      disposePanel?.();
      provider.dispose();
    } finally {
      Object.defineProperty(vscode.window, "createWebviewPanel", {
        value: originalCreateWebviewPanel,
        configurable: true,
      });
    }
  });

  test("manifest registers the todos and skill status views", () => {
    const provider = {
      getTreeItem: (item: vscode.TreeItem) => item,
      getChildren: () => [],
    };
    const todosView = vscode.window.createTreeView("agendo.todos", {
      treeDataProvider: provider,
    });
    const skillView = vscode.window.createTreeView("agendo.skillStatus", {
      treeDataProvider: provider,
    });

    assert.ok(todosView);
    assert.ok(skillView);

    todosView.dispose();
    skillView.dispose();
  });

  test("todo repository refreshes todo files and tracks the highest id", async () => {
    const rootUri = vscode.Uri.file(path.join(os.tmpdir(), "agendo-repo-tests"));
    await vscode.workspace.fs.createDirectory(rootUri);
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(rootUri, "backlog"));

    const files = [
      "001-ready-p1-first.md",
      "020-pending-p2-second.md",
      "099-cancelled-p3-third.md",
    ];
    for (const file of files) {
      const dependencies = file.startsWith("020") ? '\ndependencies: ["001"]' : "";
      const group = file.startsWith("001")
        ? "\ngroup: zeta"
        : file.startsWith("020")
          ? "\ngroup: alpha"
          : "\ngroup: zeta";
      await vscode.workspace.fs.writeFile(
        vscode.Uri.joinPath(rootUri, "backlog", file),
        Buffer.from(
          `---\nstatus: ${file.includes("ready") ? "ready" : file.includes("pending") ? "pending" : "cancelled"}\npriority: ${file.includes("p1") ? "p1" : file.includes("p2") ? "p2" : "p3"}${dependencies}${group}\n---\n# ${file}\n`,
          "utf8",
        ),
      );
    }

    const config = {
      getRootUri: () => rootUri,
      backlogFolder: "backlog",
      completeFolder: "complete",
      cancelledFolder: "cancelled",
    } as never;
    const repository = new TodoRepository(config);

    await repository.refresh();
    assert.strictEqual(repository.getTodos().length, 3);
    assert.strictEqual(repository.getMaxId(), 99);
    assert.deepStrictEqual(repository.getDependencyGraph().blockedBy.get("020"), ["001"]);
    assert.deepStrictEqual(repository.getDependencyGraph().blocking.get("001"), ["020"]);
    assert.deepStrictEqual(repository.getDependencyGraph().blocking.get("099"), []);
    const groups = repository.getGroups();
    assert.deepStrictEqual(groups, ["alpha", "zeta"]);
    assert.strictEqual(repository.getGroups(), groups);

    const created: string[] = [];
    const listeners: Array<() => void> = [];
    const originalWatcher = vscode.workspace.createFileSystemWatcher;
    Object.defineProperty(vscode.workspace, "createFileSystemWatcher", {
      value: (pattern: unknown) => {
        created.push(String(pattern));
        return {
          onDidCreate: (listener: () => void) => listeners.push(listener),
          onDidChange: (listener: () => void) => listeners.push(listener),
          onDidDelete: (listener: () => void) => listeners.push(listener),
          dispose: () => undefined,
        } as never;
      },
      configurable: true,
    });

    try {
      let refreshCount = 0;
      repository.refresh = async () => {
        refreshCount += 1;
      };
      repository.startWatching();
      assert.strictEqual(created.length, 1);
      assert.strictEqual(listeners.length, 3);

      for (let event = 0; event < 5; event++) {
        listeners[0]();
      }
      await new Promise((resolve) => setTimeout(resolve, 450));
      assert.strictEqual(refreshCount, 1);

      listeners[1]();
      await new Promise((resolve) => setTimeout(resolve, 450));
      assert.strictEqual(refreshCount, 2);

      listeners[2]();
      repository.dispose();
      await new Promise((resolve) => setTimeout(resolve, 450));
      assert.strictEqual(refreshCount, 2);
    } finally {
      repository.dispose();
      Object.defineProperty(vscode.workspace, "createFileSystemWatcher", {
        value: originalWatcher,
        configurable: true,
      });
    }
  });

  test("extension activates and executes command registration paths", async () => {
    const workspaceRoot = vscode.Uri.file(
      await fs.mkdtemp(path.join(os.tmpdir(), "agendo-extension-tests-")),
    );
    const todoRoot = vscode.Uri.joinPath(workspaceRoot, "docs", "todos");
    await vscode.workspace.fs.createDirectory(todoRoot);
    await vscode.workspace.fs.writeFile(
      vscode.Uri.joinPath(todoRoot, "050-ready-p3-grouped.md"),
      Buffer.from(
        '---\nstatus: ready\npriority: p3\ngroup: auth\ndependencies: ["999"]\n---\n# Grouped\n',
        "utf8",
      ),
    );

    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    const originalCreateTreeView = vscode.window.createTreeView;
    const originalRegisterCommand = vscode.commands.registerCommand;
    const originalOnDidChangeConfiguration = vscode.workspace.onDidChangeConfiguration;
    const originalCreateWatcher = vscode.workspace.createFileSystemWatcher;
    const originalShowInputBox = vscode.window.showInputBox;
    const originalShowQuickPick = vscode.window.showQuickPick;
    const originalShowTextDocument = vscode.window.showTextDocument;
    const originalShowErrorMessage = vscode.window.showErrorMessage;
    const originalShowInformationMessage = vscode.window.showInformationMessage;
    const originalShowWarningMessage = vscode.window.showWarningMessage;
    const originalOpenTextDocument = vscode.workspace.openTextDocument;
    const originalExecuteCommand = vscode.commands.executeCommand;
    const originalGetConfiguration = vscode.workspace.getConfiguration;

    const registrations = new Map<string, (...args: any[]) => any>();
    const executedCommands: string[] = [];
    const previewSteps: string[] = [];
    const errorMessages: string[] = [];
    const workspaceState = new Map<string, unknown>();
    let watcherCreationCount = 0;
    const treeViewIds: string[] = [];
    const inputQueue = [
      "add-login-page",
      "my-key",
      "docs/todos",
      "fix the login issue",
      "alpha",
      undefined,
      "p2",
      "on",
    ];

    Object.defineProperty(vscode.workspace, "workspaceFolders", {
      value: [{ uri: workspaceRoot, name: "workspace", index: 0 }],
      configurable: true,
    });
    Object.defineProperty(vscode.window, "createTreeView", {
      value: (id: string) => {
        treeViewIds.push(id);
        return {
          onDidCollapseElement: () => ({ dispose() {} }),
          onDidExpandElement: () => ({ dispose() {} }),
          dispose() {},
        };
      },
      configurable: true,
    });
    Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", {
      value: () => ({ dispose() {} }),
      configurable: true,
    });
    Object.defineProperty(vscode.workspace, "createFileSystemWatcher", {
      value: () => {
        watcherCreationCount += 1;
        return {
          onDidCreate: () => undefined,
          onDidChange: () => undefined,
          onDidDelete: () => undefined,
          dispose() {},
        };
      },
      configurable: true,
    });
    Object.defineProperty(vscode.commands, "registerCommand", {
      value: (command: string, callback: (...args: any[]) => any) => {
        registrations.set(command, callback);
        return { dispose() {} };
      },
      configurable: true,
    });
    Object.defineProperty(vscode.window, "showInputBox", {
      value: async () => inputQueue.shift(),
      configurable: true,
    });
    Object.defineProperty(vscode.window, "showErrorMessage", {
      value: async (message: string) => {
        errorMessages.push(message);
        return undefined;
      },
      configurable: true,
    });
    Object.defineProperty(vscode.window, "showInformationMessage", {
      value: async () => undefined,
      configurable: true,
    });
    Object.defineProperty(vscode.window, "showWarningMessage", {
      value: async () => undefined,
      configurable: true,
    });
    Object.defineProperty(vscode.window, "showQuickPick", {
      value: async (items: unknown[], options?: { canPickMany?: boolean }) => {
        if (options?.canPickMany) {
          return Array.isArray(items) ? items : [];
        }
        if (Array.isArray(items) && items.length && typeof items[0] === "object" && items[0]) {
          const first = items[0] as { label: string };
          return { label: first.label };
        }
        return items[0];
      },
      configurable: true,
    });
    Object.defineProperty(vscode.workspace, "openTextDocument", {
      value: async (uri: vscode.Uri) => {
        previewSteps.push("openTextDocument");
        return { uri };
      },
      configurable: true,
    });
    Object.defineProperty(vscode.window, "showTextDocument", {
      value: async () => {
        previewSteps.push("showTextDocument");
        return undefined;
      },
      configurable: true,
    });
    Object.defineProperty(vscode.workspace, "getConfiguration", {
      value: () => ({
        get: () => undefined,
        update: async () => undefined,
        inspect: () => undefined,
      }),
      configurable: true,
    });
    Object.defineProperty(vscode.commands, "executeCommand", {
      value: async (command: string, ...args: unknown[]) => {
        executedCommands.push(command);
        if (command === "vscode.open") {
          return { command, args };
        }
        return undefined;
      },
      configurable: true,
    });

    try {
      const context = {
        workspaceState: {
          get: <T>(key: string, fallback: T): T => {
            return workspaceState.has(key) ? (workspaceState.get(key) as T) : fallback;
          },
          update: async (key: string, value: unknown) => {
            workspaceState.set(key, value);
          },
        },
        extensionUri: vscode.Uri.file(
          path.join(os.tmpdir(), "agendo-extension-tests", "extension"),
        ),
        subscriptions: [] as vscode.Disposable[],
      };
      await activate(context as never);
      assert.strictEqual(watcherCreationCount, 1);
      assert.deepStrictEqual(treeViewIds, ["agendo.todos", "agendo.skillStatus"]);

      await registrations.get(Command.Refresh)?.();
      await registrations.get(Command.OpenPreview)?.({
        kind: "todo",
        todo: {
          id: "001",
          status: "pending",
          priority: "p2",
          title: "Login page",
          description: "login",
          tags: [],
          dependencies: [],
          key: undefined,
          children: [],
          epic: false,
          folder: "",
          fileName: "001-pending-p2-login-page.md",
          uri: vscode.Uri.file(path.join(todoRoot.fsPath, "001-pending-p2-login-page.md")),
          frontmatter: { status: "pending", priority: "p2" },
        },
      });
      await registrations.get(Command.ClearFilters)?.();
      await registrations.get(Command.Filter)?.();
      const selectedFilters = workspaceState.get("agendo.filter") as {
        statuses?: string[];
        group?: string;
      };
      assert.strictEqual(selectedFilters.group, "auth");
      assert.ok(!selectedFilters.statuses?.includes("auth"));
      await registrations.get(Command.Search)?.();
      await registrations.get(Command.ClearSearch)?.();
      await registrations.get(Command.ShowDigest)?.();

      for (const status of TODO_STATUSES) {
        await registrations.get(`agendo.setStatus.${status}`)?.({
          kind: "todo",
          todo: {
            id: "001",
            status,
            priority: "p2",
            title: "Login page",
            description: "login",
            tags: [],
            dependencies: [],
            key: undefined,
            children: [],
            epic: false,
            folder: "",
            fileName: "001-pending-p2-login-page.md",
            uri: vscode.Uri.file(path.join(todoRoot.fsPath, "001-pending-p2-login-page.md")),
            frontmatter: { status, priority: "p2" },
          },
        });
      }

      await registrations.get(Command.SetPriority)?.({
        kind: "todo",
        todo: {
          id: "001",
          status: "pending",
          priority: "p2",
          title: "Login page",
          description: "login",
          tags: [],
          dependencies: [],
          key: undefined,
          children: [],
          epic: false,
          folder: "",
          fileName: "001-pending-p2-login-page.md",
          uri: vscode.Uri.file(path.join(todoRoot.fsPath, "001-pending-p2-login-page.md")),
          frontmatter: { status: "pending", priority: "p2" },
        },
      });
      await registrations.get(Command.SetDependency)?.({
        kind: "todo",
        todo: {
          id: "050",
          status: "ready",
          priority: "p3",
          title: "Grouped",
          description: "grouped",
          tags: [],
          dependencies: ["999"],
          key: undefined,
          children: [],
          epic: false,
          folder: "",
          fileName: "050-ready-p3-grouped.md",
          uri: vscode.Uri.joinPath(todoRoot, "050-ready-p3-grouped.md"),
          frontmatter: { status: "ready", priority: "p3", dependencies: ["999"] },
        },
      });
      assert.match(
        await readText(vscode.Uri.joinPath(todoRoot, "050-ready-p3-grouped.md")),
        /dependencies: \["999"\]/,
      );
      await registrations.get(Command.SetGroup)?.({
        kind: "todo",
        todo: {
          id: "001",
          status: "pending",
          priority: "p2",
          title: "Login page",
          description: "login",
          tags: [],
          dependencies: [],
          group: undefined,
          key: undefined,
          children: [],
          epic: false,
          folder: "",
          fileName: "001-pending-p2-login-page.md",
          uri: vscode.Uri.file(path.join(todoRoot.fsPath, "001-pending-p2-login-page.md")),
          frontmatter: { status: "pending", priority: "p2" },
        },
      });
      await registrations.get(Command.CreateTodo)?.();
      const createdEntries = await vscode.workspace.fs.readDirectory(todoRoot);
      const createdTodo = createdEntries.find(
        ([name]) => name.endsWith(".md") && name !== "050-ready-p3-grouped.md",
      );
      assert.ok(createdTodo);
      assert.match(
        await readText(vscode.Uri.joinPath(todoRoot, createdTodo[0])),
        /## Resume Context/,
      );
      await registrations.get(Command.ChooseRoot)?.();
      await registrations.get(Command.ToggleGitignore)?.();
      await registrations.get(Command.SetViewMode)?.();
      await registrations.get(Command.SetDefaultRoot)?.();
      await registrations.get(Command.SetDefaultPriority)?.();
      await registrations.get(Command.SetDefaultPreview)?.();
      await registrations.get(Command.EnableSkill)?.();
      await registrations.get(Command.UpdateSkill)?.();
      await registrations.get(Command.CollapseNode)?.({ id: "status:ready" });
      await registrations.get(Command.ExpandNode)?.({ id: "status:ready" });
      deactivate();

      assert.ok(registrations.has(Command.Refresh));
      assert.ok(registrations.has(Command.ShowDigest));
      assert.ok(registrations.has(Command.OpenPreview));
      assert.ok(registrations.has(Command.ClearSearch));
      assert.ok(registrations.has(Command.CollapseNode));
      assert.ok(registrations.has(Command.ExpandNode));
      assert.ok(registrations.has(Command.SetDependency));
      assert.ok(registrations.has(Command.SetGroup));
      assert.deepStrictEqual(previewSteps, ["openTextDocument"]);
      assert.strictEqual(
        executedCommands.filter((command) => command === "markdown.showPreview").length,
        2,
      );
      assert.ok(executedCommands.includes("setContext"));
      assert.ok(
        errorMessages.every((message) =>
          [
            "Failed to set priority:",
            "Failed to set group:",
            "Failed to install skill:",
            "Failed to update skill:",
          ].some((prefix) => message.startsWith(prefix)),
        ),
      );
    } finally {
      Object.defineProperty(vscode.workspace, "workspaceFolders", {
        value: originalWorkspaceFolders,
        configurable: true,
      });
      Object.defineProperty(vscode.window, "createTreeView", {
        value: originalCreateTreeView,
        configurable: true,
      });
      Object.defineProperty(vscode.commands, "registerCommand", {
        value: originalRegisterCommand,
        configurable: true,
      });
      Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", {
        value: originalOnDidChangeConfiguration,
        configurable: true,
      });
      Object.defineProperty(vscode.workspace, "createFileSystemWatcher", {
        value: originalCreateWatcher,
        configurable: true,
      });
      Object.defineProperty(vscode.window, "showInputBox", {
        value: originalShowInputBox,
        configurable: true,
      });
      Object.defineProperty(vscode.window, "showErrorMessage", {
        value: originalShowErrorMessage,
        configurable: true,
      });
      Object.defineProperty(vscode.window, "showInformationMessage", {
        value: originalShowInformationMessage,
        configurable: true,
      });
      Object.defineProperty(vscode.window, "showWarningMessage", {
        value: originalShowWarningMessage,
        configurable: true,
      });
      Object.defineProperty(vscode.window, "showQuickPick", {
        value: originalShowQuickPick,
        configurable: true,
      });
      Object.defineProperty(vscode.workspace, "openTextDocument", {
        value: originalOpenTextDocument,
        configurable: true,
      });
      Object.defineProperty(vscode.window, "showTextDocument", {
        value: originalShowTextDocument,
        configurable: true,
      });
      Object.defineProperty(vscode.commands, "executeCommand", {
        value: originalExecuteCommand,
        configurable: true,
      });
      Object.defineProperty(vscode.workspace, "getConfiguration", {
        value: originalGetConfiguration,
        configurable: true,
      });
      await fs.rm(workspaceRoot.fsPath, { recursive: true, force: true });
    }
  });

  test("isBlocked returns false when no dependencies exist", () => {
    const todo: Todo = {
      id: "001",
      status: "ready",
      priority: "p1",
      title: "First",
      description: "first",
      tags: [],
      dependencies: [],
      children: [],
      epic: false,
      folder: "",
      fileName: "001-ready-p1-first.md",
      uri: vscode.Uri.file("/tmp/001-ready-p1-first.md"),
      frontmatter: { status: "ready", priority: "p1" },
    };
    assert.strictEqual(isBlocked(todo, []), false);
  });

  test("isBlocked returns true when any dependency is incomplete", () => {
    const todo: Todo = {
      id: "002",
      status: "pending",
      priority: "p2",
      title: "Second",
      description: "second",
      tags: [],
      dependencies: ["001"],
      children: [],
      epic: false,
      folder: "",
      fileName: "002-pending-p2-second.md",
      uri: vscode.Uri.file("/tmp/002-pending-p2-second.md"),
      frontmatter: { status: "pending", priority: "p2" },
    };
    const allTodos: Todo[] = [
      {
        id: "001",
        status: "pending",
        priority: "p1",
        title: "First",
        description: "first",
        tags: [],
        dependencies: [],
        children: [],
        epic: false,
        folder: "",
        fileName: "001-pending-p1-first.md",
        uri: vscode.Uri.file("/tmp/001-pending-p1-first.md"),
        frontmatter: { status: "pending", priority: "p1" },
      },
    ];
    assert.strictEqual(isBlocked(todo, allTodos), true);
  });

  test("isBlocked returns false when all dependencies are complete", () => {
    const todo: Todo = {
      id: "003",
      status: "pending",
      priority: "p2",
      title: "Third",
      description: "third",
      tags: [],
      dependencies: ["001", "002"],
      children: [],
      epic: false,
      folder: "",
      fileName: "003-pending-p2-third.md",
      uri: vscode.Uri.file("/tmp/003-pending-p2-third.md"),
      frontmatter: { status: "pending", priority: "p2" },
    };
    const allTodos: Todo[] = [
      {
        id: "001",
        status: "complete",
        priority: "p1",
        title: "First",
        description: "first",
        tags: [],
        dependencies: [],
        children: [],
        epic: false,
        folder: "complete",
        fileName: "001-complete-p1-first.md",
        uri: vscode.Uri.file("/tmp/001-complete-p1-first.md"),
        frontmatter: { status: "complete", priority: "p1" },
      },
      {
        id: "002",
        status: "cancelled",
        priority: "p3",
        title: "Second",
        description: "second",
        tags: [],
        dependencies: [],
        children: [],
        epic: false,
        folder: "cancelled",
        fileName: "002-cancelled-p3-second.md",
        uri: vscode.Uri.file("/tmp/002-cancelled-p3-second.md"),
        frontmatter: { status: "cancelled", priority: "p3" },
      },
    ];
    assert.strictEqual(isBlocked(todo, allTodos), false);
  });

  test("getBlockedBy returns dependents that are not terminal", () => {
    const todo: Todo = {
      id: "001",
      status: "complete",
      priority: "p1",
      title: "First",
      description: "first",
      tags: [],
      dependencies: [],
      children: [],
      epic: false,
      folder: "complete",
      fileName: "001-complete-p1-first.md",
      uri: vscode.Uri.file("/tmp/001-complete-p1-first.md"),
      frontmatter: { status: "complete", priority: "p1" },
    };
    const allTodos: Todo[] = [
      {
        id: "002",
        status: "pending",
        priority: "p2",
        title: "Second",
        description: "second",
        tags: [],
        dependencies: ["001"],
        children: [],
        epic: false,
        folder: "",
        fileName: "002-pending-p2-second.md",
        uri: vscode.Uri.file("/tmp/002-pending-p2-second.md"),
        frontmatter: { status: "pending", priority: "p2" },
      },
      {
        id: "003",
        status: "complete",
        priority: "p3",
        title: "Third",
        description: "third",
        tags: [],
        dependencies: ["001"],
        children: [],
        epic: false,
        folder: "complete",
        fileName: "003-complete-p3-third.md",
        uri: vscode.Uri.file("/tmp/003-complete-p3-third.md"),
        frontmatter: { status: "complete", priority: "p3" },
      },
    ];
    assert.deepStrictEqual(getBlockedBy(todo, allTodos), ["002"]);
  });

  test("filter service matches blocked/unblocked filters", async () => {
    const memory = new Map<string, unknown>();
    const state = {
      get: <T>(key: string, fallback: T): T =>
        memory.has(key) ? (memory.get(key) as T) : fallback,
      update: async (key: string, value: unknown) => {
        memory.set(key, value);
      },
    };

    const service = new FilterService(state as never);
    const allTodos: Todo[] = [
      {
        id: "001",
        status: "pending",
        priority: "p1",
        title: "First",
        description: "first",
        tags: [],
        dependencies: [],
        children: [],
        epic: false,
        folder: "",
        fileName: "001-pending-p1-first.md",
        uri: vscode.Uri.file("/tmp/001-pending-p1-first.md"),
        frontmatter: { status: "pending", priority: "p1" },
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
        epic: false,
        folder: "",
        fileName: "002-pending-p2-second.md",
        uri: vscode.Uri.file("/tmp/002-pending-p2-second.md"),
        frontmatter: { status: "pending", priority: "p2" },
      },
    ];
    const dependencyGraph = {
      blockedBy: new Map<string, readonly string[]>([
        ["001", []],
        ["002", ["001"]],
      ]),
      blocking: new Map<string, readonly string[]>([
        ["001", ["002"]],
        ["002", []],
      ]),
    };

    await service.set({ blocked: true });
    assert.strictEqual(service.matches(allTodos[0], dependencyGraph), false);
    assert.strictEqual(service.matches(allTodos[1], dependencyGraph), true);

    await service.set({ blocked: false });
    assert.strictEqual(service.matches(allTodos[0], dependencyGraph), true);
    assert.strictEqual(service.matches(allTodos[1], dependencyGraph), false);

    await service.set({ dependsOn: "001" });
    assert.strictEqual(service.matches(allTodos[0], dependencyGraph), false);
    assert.strictEqual(service.matches(allTodos[1], dependencyGraph), true);

    await service.set({ blocking: "001" });
    assert.strictEqual(service.matches(allTodos[0], dependencyGraph), true);
    assert.strictEqual(service.matches(allTodos[1], dependencyGraph), false);

    await service.clear();
  });

  test("filter service matches group filters", async () => {
    const memory = new Map<string, unknown>();
    const state = {
      get: <T>(key: string, fallback: T): T =>
        memory.has(key) ? (memory.get(key) as T) : fallback,
      update: async (key: string, value: unknown) => {
        memory.set(key, value);
      },
    };

    const service = new FilterService(state as never);
    const allTodos: Todo[] = [
      {
        id: "001",
        status: "pending",
        priority: "p1",
        title: "First",
        description: "first",
        tags: [],
        dependencies: [],
        group: "auth",
        children: [],
        epic: false,
        folder: "",
        fileName: "001-pending-p1-first.md",
        uri: vscode.Uri.file("/tmp/001-pending-p1-first.md"),
        frontmatter: { status: "pending", priority: "p1" },
      },
      {
        id: "002",
        status: "pending",
        priority: "p2",
        title: "Second",
        description: "second",
        tags: [],
        dependencies: [],
        group: "billing",
        children: [],
        epic: false,
        folder: "",
        fileName: "002-pending-p2-second.md",
        uri: vscode.Uri.file("/tmp/002-pending-p2-second.md"),
        frontmatter: { status: "pending", priority: "p2" },
      },
      {
        id: "003",
        status: "pending",
        priority: "p3",
        title: "Third",
        description: "third",
        tags: [],
        dependencies: [],
        children: [],
        epic: false,
        folder: "",
        fileName: "003-pending-p3-third.md",
        uri: vscode.Uri.file("/tmp/003-pending-p3-third.md"),
        frontmatter: { status: "pending", priority: "p3" },
      },
    ];

    await service.set({ group: "auth" });
    assert.strictEqual(service.matches(allTodos[0]), true);
    assert.strictEqual(service.matches(allTodos[1]), false);
    assert.strictEqual(service.matches(allTodos[2]), false);

    await service.set({ group: "billing" });
    assert.strictEqual(service.matches(allTodos[0]), false);
    assert.strictEqual(service.matches(allTodos[1]), true);
    assert.strictEqual(service.matches(allTodos[2]), false);

    await service.clear();
  });

  test("status service updates dependencies and renames the file", async () => {
    const rootUri = vscode.Uri.file(path.join(os.tmpdir(), "agendo-deps-tests"));
    await vscode.workspace.fs.createDirectory(rootUri);
    const originalUri = vscode.Uri.joinPath(rootUri, "060-ready-p2-do-the-thing.md");
    const initialContent = [
      "---",
      "status: ready",
      "priority: p2",
      "dependencies: []",
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
      tags: [],
      dependencies: [],
      key: undefined,
      children: [],
      epic: false,
      folder: "",
      fileName: "060-ready-p2-do-the-thing.md",
      uri: originalUri,
      frontmatter: { status: "ready", priority: "p2", dependencies: [] },
    };

    const config = {
      getRootUri: () => rootUri,
      backlogFolder: "backlog",
      completeFolder: "complete",
      cancelledFolder: "cancelled",
    } as never;
    const service = new StatusService(config);

    const dependencies = ["002", "001"];
    const unchanged = await service.setDependencies({ ...todo, dependencies }, ["001", "002"]);
    assert.strictEqual(unchanged, undefined);
    assert.deepStrictEqual(dependencies, ["002", "001"]);

    const newUri = await service.setDependencies(todo, ["001", "002"]);
    assert.ok(newUri);

    const updatedData = Buffer.from(await vscode.workspace.fs.readFile(newUri)).toString("utf8");
    assert.match(updatedData, /dependencies: \["001", "002"\]/);
  });

  test("status service updates and clears group metadata", async () => {
    const rootUri = vscode.Uri.file(path.join(os.tmpdir(), "agendo-group-tests"));
    await vscode.workspace.fs.createDirectory(rootUri);
    const originalUri = vscode.Uri.joinPath(rootUri, "061-ready-p2-grouped-task.md");
    const initialContent = [
      "---",
      "status: ready",
      "priority: p2",
      "group: my-initiative",
      "---",
      "",
      "# Grouped Task",
      "",
      "Body.",
    ].join("\n");
    await vscode.workspace.fs.writeFile(originalUri, Buffer.from(initialContent, "utf8"));

    const todo: Todo = {
      id: "061",
      status: "ready",
      priority: "p2",
      title: "Grouped Task",
      description: "grouped-task",
      tags: [],
      dependencies: [],
      group: "my-initiative",
      key: undefined,
      children: [],
      epic: false,
      folder: "",
      fileName: "061-ready-p2-grouped-task.md",
      uri: originalUri,
      frontmatter: { status: "ready", priority: "p2", group: "my-initiative" },
    };

    const config = {
      getRootUri: () => rootUri,
      backlogFolder: "backlog",
      completeFolder: "complete",
      cancelledFolder: "cancelled",
    } as never;
    const service = new StatusService(config);

    const updatedUri = await service.setGroup(todo, "new-group");
    if (!updatedUri) {
      assert.fail("Expected group update to return a URI");
    }
    const updatedData = Buffer.from(await vscode.workspace.fs.readFile(updatedUri)).toString(
      "utf8",
    );
    assert.match(updatedData, /group: new-group/);

    const clearedUri = await service.setGroup({ ...todo, group: "new-group" }, undefined);
    if (!clearedUri) {
      assert.fail("Expected group removal to return a URI");
    }
    const clearedData = Buffer.from(await vscode.workspace.fs.readFile(clearedUri)).toString(
      "utf8",
    );
    assert.ok(!clearedData.includes("group:"));
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
