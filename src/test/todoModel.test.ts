import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { Command } from "../commands";
import { get, Settings, set, setDefault } from "../configuration";
import { activate, deactivate } from "../extension";
import { out, outputChannel, showOutputChannel } from "../output";
import { ConfigService } from "../todos/configService";
import { FilterService } from "../todos/filterService";
import { LinkService } from "../todos/linkService";
import { SkillManager } from "../todos/skillManager";
import { StatusService } from "../todos/statusService";
import {
  buildFileName,
  isTodoFileName,
  parseFrontmatter,
  parseTodo,
  splitFrontmatter,
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
      await vscode.workspace.fs.writeFile(
        vscode.Uri.joinPath(rootUri, "backlog", file),
        Buffer.from(
          `---\nstatus: ${file.includes("ready") ? "ready" : file.includes("pending") ? "pending" : "cancelled"}\npriority: ${file.includes("p1") ? "p1" : file.includes("p2") ? "p2" : "p3"}\n---\n# ${file}\n`,
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

    const created: string[] = [];
    const originalWatcher = vscode.workspace.createFileSystemWatcher;
    Object.defineProperty(vscode.workspace, "createFileSystemWatcher", {
      value: (pattern: unknown) => {
        created.push(String(pattern));
        return {
          onDidCreate: () => undefined,
          onDidChange: () => undefined,
          onDidDelete: () => undefined,
          dispose: () => undefined,
        } as never;
      },
      configurable: true,
    });

    try {
      repository.startWatching();
      assert.strictEqual(created.length, 1);
    } finally {
      repository.dispose();
      Object.defineProperty(vscode.workspace, "createFileSystemWatcher", {
        value: originalWatcher,
        configurable: true,
      });
    }
  });

  test("extension activates and executes command registration paths", async () => {
    const workspaceRoot = vscode.Uri.file(path.join(os.tmpdir(), "agendo-extension-tests"));
    const todoRoot = vscode.Uri.joinPath(workspaceRoot, "docs", "todos");
    await vscode.workspace.fs.createDirectory(todoRoot);

    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    const originalCreateTreeView = vscode.window.createTreeView;
    const originalRegisterCommand = vscode.commands.registerCommand;
    const originalOnDidChangeConfiguration = vscode.workspace.onDidChangeConfiguration;
    const originalCreateWatcher = vscode.workspace.createFileSystemWatcher;
    const originalShowInputBox = vscode.window.showInputBox;
    const originalShowQuickPick = vscode.window.showQuickPick;
    const originalExecuteCommand = vscode.commands.executeCommand;
    const originalGetConfiguration = vscode.workspace.getConfiguration;

    const registrations = new Map<string, (...args: any[]) => any>();
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
      value: () => ({
        onDidCollapseElement: () => ({ dispose() {} }),
        onDidExpandElement: () => ({ dispose() {} }),
        dispose() {},
      }),
      configurable: true,
    });
    Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", {
      value: () => ({ dispose() {} }),
      configurable: true,
    });
    Object.defineProperty(vscode.workspace, "createFileSystemWatcher", {
      value: () => ({
        onDidCreate: () => undefined,
        onDidChange: () => undefined,
        onDidDelete: () => undefined,
        dispose() {},
      }),
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
    Object.defineProperty(vscode.workspace, "getConfiguration", {
      value: () => ({
        get: () => undefined,
        update: async () => undefined,
      }),
      configurable: true,
    });
    Object.defineProperty(vscode.commands, "executeCommand", {
      value: async (command: string, ...args: unknown[]) => {
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
            const store = new Map<string, unknown>();
            return store.has(key) ? (store.get(key) as T) : fallback;
          },
          update: async () => undefined,
        },
        extensionUri: vscode.Uri.file(
          path.join(os.tmpdir(), "agendo-extension-tests", "extension"),
        ),
        subscriptions: [] as vscode.Disposable[],
      };
      await activate(context as never);

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
      await registrations.get(Command.Search)?.();

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
      await registrations.get(Command.CreateTodo)?.();
      await registrations.get(Command.ChooseRoot)?.();
      await registrations.get(Command.ToggleGitignore)?.();
      await registrations.get(Command.TogglePreview)?.();
      await registrations.get(Command.SetDefaultRoot)?.();
      await registrations.get(Command.SetDefaultPriority)?.();
      await registrations.get(Command.SetDefaultPreview)?.();
      await registrations.get(Command.EnableSkill)?.();
      await registrations.get(Command.UpdateSkill)?.();
      await registrations.get(Command.CollapseNode)?.({ id: "status:ready" });
      await registrations.get(Command.ExpandNode)?.({ id: "status:ready" });
      deactivate();

      assert.ok(registrations.has(Command.Refresh));
      assert.ok(registrations.has(Command.OpenPreview));
      assert.ok(registrations.has(Command.CollapseNode));
      assert.ok(registrations.has(Command.ExpandNode));
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
      Object.defineProperty(vscode.window, "showQuickPick", {
        value: originalShowQuickPick,
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
