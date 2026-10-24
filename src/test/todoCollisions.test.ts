import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { registerCommands } from "../commandRegistration";
import { Command } from "../commands";
import { BoardViewProvider, buildBoardSnapshot } from "../todos/boardViewProvider";
import { ConfigService } from "../todos/configService";
import { FilterService } from "../todos/filterService";
import type { StatusService } from "../todos/statusService";
import { buildCollisionReconcileContext, findTodoCollisions } from "../todos/todoCollisions";
import { buildFileName, parseTodo, type TodoStatus } from "../todos/todoModel";
import { TodoRepository } from "../todos/todoRepository";
import { TodoTreeProvider } from "../todos/todoTreeProvider";
import { TreeStateService } from "../todos/treeStateService";

function state(): vscode.Memento {
  return {
    keys: () => [],
    get: <T>(_key: string, fallback?: T) => fallback as T,
    update: async () => {},
  };
}

function fixture(id: string, status: TodoStatus, folder = "", slug = "example") {
  const fileName = buildFileName(id, status, "p2", slug);
  const todo = parseTodo(
    vscode.Uri.file(`/tmp/agendo-collision-test/${folder}/${fileName}`),
    `# Same title`,
    folder,
  );
  assert.ok(todo);
  return todo;
}

suite("todo ID collision diagnostics", () => {
  const active = fixture("003", "in-progress");
  const cancelled = fixture("003", "cancelled", "cancelled");

  test("detects ID reuse across lifecycle folders without confusing source sequences or repeated scans of one file", () => {
    const cql = fixture("cql-003", "pending", "code-scanning/codeql");
    const sq = fixture("sq-003", "pending", "code-scanning/sonarqube");
    assert.strictEqual(findTodoCollisions([active, cql, sq]).length, 0);
    assert.strictEqual(findTodoCollisions([active, active]).length, 0);
    const collisions = findTodoCollisions([
      active,
      cancelled,
      cql,
      sq,
      fixture("sq-003", "complete", "code-scanning/sonarqube/complete"),
    ]);
    assert.strictEqual(collisions.length, 2);
    assert.deepStrictEqual(collisions.map((item) => item.source).sort(), ["sonarqube", "todo"]);
    assert.ok(collisions.every((item) => item.todos.length === 2));
  });

  test("tree warning lists hidden conflicting records and clears when the repository snapshot changes", async () => {
    let todos = [active, cancelled];
    const repo = {
      getTodos: () => todos,
      getDependencyGraph: () => ({ blockedBy: new Map(), blocking: new Map() }),
      onDidChange: () => new vscode.Disposable(() => {}),
    } as unknown as TodoRepository;
    const filter = new FilterService(state());
    await filter.set({ statuses: ["in-progress"] });
    const tree = new TodoTreeProvider(repo, filter, new TreeStateService(state()));
    const status = tree.getChildren()[0];
    const priority = tree.getChildren(status)[0];
    const leaves = tree.getChildren(priority);
    assert.strictEqual(leaves.length, 1);
    const item = tree.getTreeItem(leaves[0]);
    assert.strictEqual(item.command?.command, Command.OpenPreview);
    assert.ok(item.contextValue?.includes("Collision"));
    assert.ok(String(item.description).includes("duplicate ID"));
    const tooltip = (item.tooltip as vscode.MarkdownString).value;
    assert.ok(tooltip.includes(active.fileName));
    assert.ok(tooltip.includes(cancelled.fileName));
    assert.ok(tooltip.includes("Copy ID Collision Reconciliation Context"));
    assert.notStrictEqual(item.id, tree.getTreeItem({ kind: "todo", todo: cancelled }).id);
    todos = [active];
    assert.ok(
      !tree.getTreeItem({ kind: "todo", todo: active }).contextValue?.includes("Collision"),
    );
  });

  test("same-status records remain individually identifiable even with matching titles", () => {
    const first = fixture("cql-003", "pending", "code-scanning/codeql", "first");
    const second = fixture("cql-003", "pending", "code-scanning/codeql", "second");
    const repo = {
      getTodos: () => [first, second],
      getDependencyGraph: () => ({ blockedBy: new Map(), blocking: new Map() }),
      onDidChange: () => new vscode.Disposable(() => {}),
    } as unknown as TodoRepository;
    const tree = new TodoTreeProvider(
      repo,
      new FilterService(state()),
      new TreeStateService(state()),
      undefined,
      "code-scanning",
    );
    const source = tree.getChildren()[0];
    const status = tree.getChildren(source)[0];
    const priority = tree.getChildren(status)[0];
    const children = tree.getChildren(priority);
    assert.strictEqual(children.length, 2);
    const items = children.map((child) => tree.getTreeItem(child));
    assert.ok(items.every((item) => item.contextValue?.includes("Collision")));
    assert.notStrictEqual(items[0].id, items[1].id);
  });

  test("reconciliation prompt preserves evidence and requires approval rather than selecting a winner", () => {
    const prompt = buildCollisionReconcileContext(
      findTodoCollisions([active, cancelled]),
      "custom/todos",
    );
    assert.ok(prompt.includes("agendo/SKILL.md"));
    assert.ok(prompt.includes("reconcile.md"));
    assert.ok(prompt.includes("obtain approval"));
    assert.ok(prompt.includes("Do not assume a completed or cancelled record is authoritative"));
    const json = /```json\n([\s\S]*?)\n```/.exec(prompt)?.[1];
    assert.ok(json);
    const evidence = JSON.parse(json);
    assert.deepStrictEqual(
      evidence[0].files.map((file: { status: string }) => file.status),
      ["in-progress", "cancelled"],
    );
    assert.ok(
      evidence[0].files.every((file: { path: string }) => file.path.startsWith("custom/todos/")),
    );
  });

  test("copy command refreshes diagnostics and copies only the selected collision or all collisions from the palette", async () => {
    const callbacks = new Map<string, (...args: any[]) => any>();
    const originalRegister = vscode.commands.registerCommand;
    const originalWrite = vscode.env.clipboard.writeText;
    const originalInfo = vscode.window.showInformationMessage;
    const copied: string[] = [];
    const subscriptions: vscode.Disposable[] = [];
    let refreshed = 0;
    const todos = [
      active,
      cancelled,
      fixture("sq-003", "pending", "code-scanning/sonarqube"),
      fixture("sq-003", "complete", "code-scanning/sonarqube/complete"),
    ];
    Object.defineProperty(vscode.commands, "registerCommand", {
      configurable: true,
      value: (id: string, callback: (...args: any[]) => any) => {
        callbacks.set(id, callback);
        return new vscode.Disposable(() => {});
      },
    });
    Object.defineProperty(vscode.env.clipboard, "writeText", {
      configurable: true,
      value: async (value: string) => {
        copied.push(value);
      },
    });
    Object.defineProperty(vscode.window, "showInformationMessage", {
      configurable: true,
      value: async () => undefined,
    });
    try {
      registerCommands(
        { subscriptions } as never,
        {
          config: { root: "docs/todos" },
          repository: {
            getTodos: () => todos,
            refresh: async () => {
              refreshed++;
            },
          },
        } as never,
      );
      const copy = callbacks.get(Command.CopyCollisionContext);
      assert.ok(copy);
      await copy({ kind: "todo", todo: active });
      assert.ok(copied[0].includes(cancelled.fileName));
      assert.ok(!copied[0].includes("sq-003"));
      await copy({ todoId: "sq-003" });
      assert.ok(copied[1].includes("sq-003"));
      assert.ok(!copied[1].includes(active.fileName));
      await copy();
      assert.ok(copied[2].includes(active.fileName) && copied[2].includes("sq-003"));
      await copy({ todoId: "999" });
      assert.strictEqual(copied.length, 3);
      assert.strictEqual(refreshed, 4);
    } finally {
      Object.defineProperty(vscode.commands, "registerCommand", {
        configurable: true,
        value: originalRegister,
      });
      Object.defineProperty(vscode.env.clipboard, "writeText", {
        configurable: true,
        value: originalWrite,
      });
      Object.defineProperty(vscode.window, "showInformationMessage", {
        configurable: true,
        value: originalInfo,
      });
      for (const subscription of subscriptions) {
        subscription.dispose();
      }
    }
  });

  test("warning actions focus both conflicting files without changing the other view's filter", async () => {
    const callbacks = new Map<string, (...args: any[]) => any>();
    const originalRegister = vscode.commands.registerCommand;
    const originalExecute = vscode.commands.executeCommand;
    const subscriptions: vscode.Disposable[] = [];
    const regular = new FilterService(state());
    const scanning = new FilterService(state());
    await regular.set({ statuses: ["in-progress"], text: "hidden" });
    await scanning.set({ text: "unrelated" });
    const scanner = fixture("cql-003", "pending", "code-scanning/codeql");
    const scannerCancelled = fixture("cql-003", "cancelled", "code-scanning/codeql/cancelled");
    const all = [active, cancelled, scanner, scannerCancelled];
    let regularRefreshes = 0;
    let scanningRefreshes = 0;
    Object.defineProperty(vscode.commands, "registerCommand", {
      configurable: true,
      value: (id: string, callback: (...args: any[]) => any) => {
        callbacks.set(id, callback);
        return new vscode.Disposable(() => {});
      },
    });
    Object.defineProperty(vscode.commands, "executeCommand", {
      configurable: true,
      value: async () => undefined,
    });
    try {
      registerCommands(
        { subscriptions } as never,
        {
          repository: { getTodos: () => all, refresh: async () => {} },
          filter: regular,
          treeProvider: {
            refresh: () => {
              regularRefreshes++;
            },
          },
          boardViewProvider: {
            refresh: () => {
              regularRefreshes++;
            },
          },
          scanning: {
            filter: scanning,
            treeProvider: {
              refresh: () => {
                scanningRefreshes++;
              },
            },
            boardViewProvider: {
              refresh: () => {
                scanningRefreshes++;
              },
            },
          },
        } as never,
      );
      const focus = callbacks.get(Command.FocusCollision);
      assert.ok(focus);
      await focus({ kind: "todo", todo: active });
      assert.deepStrictEqual(regular.current, { collision: { id: "003", source: "todo" } });
      assert.ok(regular.matches(active) && regular.matches(cancelled));
      assert.ok(!regular.matches(scanner));
      assert.ok(regular.isActive);
      assert.deepStrictEqual(scanning.current, { text: "unrelated" });
      assert.strictEqual(regularRefreshes, 2);
      await focus({ todoId: "cql-003", collisionSource: "codeql" });
      assert.ok(scanning.matches(scanner) && scanning.matches(scannerCancelled));
      assert.ok(!scanning.matches(active));
      assert.strictEqual(scanningRefreshes, 2);
      assert.deepStrictEqual(regular.current, { collision: { id: "003", source: "todo" } });
      await callbacks.get(Command.ClearFilters)?.();
      assert.deepStrictEqual(regular.current, {});
      assert.ok("collision" in scanning.current);
    } finally {
      Object.defineProperty(vscode.commands, "registerCommand", {
        configurable: true,
        value: originalRegister,
      });
      Object.defineProperty(vscode.commands, "executeCommand", {
        configurable: true,
        value: originalExecute,
      });
      for (const subscription of subscriptions) {
        subscription.dispose();
      }
    }
  });

  test("boards warn about hidden colliding records and refuse ambiguous ID-based mutations", async () => {
    const originalWarning = vscode.window.showWarningMessage;
    const warnings: string[] = [];
    let mutations = 0;
    const repo = {
      getTodos: () => [active, cancelled],
      getDependencyGraph: () => ({ blockedBy: new Map(), blocking: new Map() }),
      onDidChange: () => new vscode.Disposable(() => {}),
    } as unknown as TodoRepository;
    const filter = new FilterService(state());
    await filter.set({ statuses: ["in-progress"] });
    const snapshot = buildBoardSnapshot(repo.getTodos(), repo.getDependencyGraph(), filter);
    assert.ok(
      snapshot.columns.flatMap((column) => column.todos)[0].collision?.includes(cancelled.fileName),
    );
    const board = new BoardViewProvider(
      repo,
      filter,
      {
        setStatus: async () => {
          mutations++;
        },
      } as unknown as StatusService,
      state(),
    );
    Object.defineProperty(vscode.window, "showWarningMessage", {
      configurable: true,
      value: async (message: string) => {
        warnings.push(message);
      },
    });
    try {
      await (
        board as unknown as { handleMessage: (message: unknown) => Promise<void> }
      ).handleMessage({ type: "setStatus", todoId: "003", status: "complete" });
      assert.strictEqual(mutations, 0);
      assert.ok(warnings[0].includes("Duplicate todo ID 003"));
    } finally {
      board.dispose();
      Object.defineProperty(vscode.window, "showWarningMessage", {
        configurable: true,
        value: originalWarning,
      });
    }
  });

  test("repository keeps dependencies blocked when duplicate records include a terminal candidate", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-id-collisions-"));
    const config = new ConfigService();
    config.getRootUri = () => vscode.Uri.file(root);
    const repo = new TodoRepository(config);
    try {
      await fs.mkdir(path.join(root, "cancelled"));
      await fs.writeFile(path.join(root, active.fileName), "# Active");
      await fs.writeFile(path.join(root, "cancelled", cancelled.fileName), "# Cancelled");
      await fs.writeFile(
        path.join(root, "004-pending-p2-dependent.md"),
        "---\ndependencies: [003]\n---\n# Dependent",
      );
      await repo.refresh();
      assert.strictEqual(findTodoCollisions(repo.getTodos()).length, 1);
      assert.deepStrictEqual(repo.getDependencyGraph().blockedBy.get("004"), ["003"]);
      await fs.unlink(path.join(root, active.fileName));
      await repo.refresh();
      assert.strictEqual(findTodoCollisions(repo.getTodos()).length, 0);
      assert.deepStrictEqual(repo.getDependencyGraph().blockedBy.get("004"), []);
    } finally {
      repo.dispose();
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  test("Skill uses default visibility and less initial space than either todo section", async () => {
    const manifest = JSON.parse(
      await fs.readFile(path.resolve(__dirname, "../../package.json"), "utf8"),
    );
    const views = manifest.contributes.views["agendo-container"];
    const skill = views.find((view: { id: string }) => view.id === "agendo.skillStatus");
    assert.strictEqual(skill.visibility, undefined);
    assert.strictEqual(skill.initialSize, 1);
    assert.ok(
      views
        .filter((view: { id: string }) => view.id !== skill.id)
        .every((view: { initialSize: number }) => view.initialSize > skill.initialSize),
    );
    const focus = manifest.contributes.commands.find(
      (command: { command: string }) => command.command === Command.FocusCollision,
    );
    assert.strictEqual(focus.icon, "$(warning)");
    assert.ok(
      manifest.contributes.menus["view/item/context"].some(
        (entry: { command: string; group: string }) =>
          entry.command === Command.FocusCollision && entry.group === "inline@0",
      ),
    );
  });
});
