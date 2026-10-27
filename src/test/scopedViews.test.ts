import * as assert from "node:assert";
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { registerCommands } from "../commandRegistration";
import { Command } from "../commands";
import { FilterService } from "../todos/filterService";
import {
  buildFileName,
  getTodoSource,
  matchesTodoScope,
  parseTodo,
  type Todo,
} from "../todos/todoModel";
import type { TodoRepository } from "../todos/todoRepository";
import { getTreeNodeKey, TodoTreeProvider } from "../todos/todoTreeProvider";
import { TreeStateService } from "../todos/treeStateService";

function memoryState(): vscode.Memento {
  const values = new Map<string, unknown>();
  return {
    keys: () => [...values.keys()],
    get: <T>(key: string, fallback?: T) => (values.get(key) ?? fallback) as T,
    update: async (key: string, value: unknown) => {
      values.set(key, value);
    },
  };
}

function fixture(id: string, folder: string, group?: string): Todo {
  const name = buildFileName(id, "pending", "p2", "example");
  const todo = parseTodo(
    vscode.Uri.file(`/tmp/${name}`),
    `---\ngroup: ${group ?? ""}\n---\n# Example ${id}`,
    folder,
  );
  assert.ok(todo);
  return todo;
}

suite("separate todo and code-scanning views", () => {
  const todos = [
    fixture("001", ""),
    fixture("cql-001", "code-scanning/codeql", "CodeQL"),
    fixture("sq-001", "code-scanning/sonarqube", "SonarQube"),
  ];
  const repository = {
    getTodos: () => todos,
    getDependencyGraph: () => ({ blockedBy: new Map(), blocking: new Map() }),
    onDidChange: () => new vscode.Disposable(() => {}),
  } as unknown as TodoRepository;

  test("manifest places Code Scanning between Todos and Skill with its own toolbar commands", async () => {
    const manifest = JSON.parse(
      await readFile(path.resolve(__dirname, "../../package.json"), "utf8"),
    );
    assert.deepStrictEqual(
      manifest.contributes.views["agendo-container"].map((view: { id: string }) => view.id),
      ["agendo.todos", "agendo.codeScanning", "agendo.skillStatus"],
    );
    const contributed = new Set(
      manifest.contributes.commands.map((command: { command: string }) => command.command),
    );
    for (const id of Object.values(Command).filter((id) => id.startsWith("agendo.codeScanning."))) {
      assert.ok(contributed.has(id), `Missing command contribution for ${id}`);
    }
    for (const command of manifest.contributes.menus["view/title"].filter(
      (entry: { command: string }) => entry.command.startsWith("agendo.codeScanning."),
    )) {
      assert.ok(command.when.includes("view == agendo.codeScanning"));
      assert.ok(!command.when.includes("view == agendo.todos"));
    }
  });

  test("source classification follows scanner folders or prefixed IDs, not arbitrary tags", () => {
    assert.strictEqual(getTodoSource(todos[0]), undefined);
    assert.strictEqual(getTodoSource(todos[1]), "codeql");
    assert.strictEqual(getTodoSource(todos[2]), "sonarqube");
    assert.strictEqual(getTodoSource({ ...todos[1], folder: "" }), "codeql");
    assert.strictEqual(getTodoSource({ ...todos[0], tags: ["codeql"] }), undefined);
    assert.ok(matchesTodoScope(todos[0], "todos"));
    assert.ok(!matchesTodoScope(todos[1], "todos"));
    assert.ok(matchesTodoScope(todos[2], "code-scanning"));
  });

  test("regular tree excludes scanner todos; scanning tree groups source before normal status and priority", () => {
    const state = memoryState();
    const normal = new TodoTreeProvider(
      repository,
      new FilterService(state),
      new TreeStateService(state),
    );
    const scanning = new TodoTreeProvider(
      repository,
      new FilterService(state, "scanning.filter"),
      new TreeStateService(state, "scanning.tree"),
      undefined,
      "code-scanning",
    );
    assert.deepStrictEqual(
      normal.getChildren().map((node) => normal.getTreeItem(node).label),
      ["Pending (1)"],
    );
    const sources = scanning.getChildren();
    assert.deepStrictEqual(
      sources.map((node) => scanning.getTreeItem(node).label),
      ["CodeQL (1)", "SonarQube (1)"],
    );
    for (const source of sources) {
      const statuses = scanning.getChildren(source);
      assert.strictEqual(statuses.length, 1);
      const priorities = scanning.getChildren(statuses[0]);
      assert.strictEqual(priorities[0].kind, "priority");
      const leaves = scanning.getChildren(priorities[0]);
      assert.strictEqual(leaves.length, 1);
      assert.strictEqual(leaves[0].kind, "todo");
      if (source.kind === "source" && leaves[0].kind === "todo") {
        assert.strictEqual(getTodoSource(leaves[0].todo), source.source);
      }
    }
    assert.notStrictEqual(
      getTreeNodeKey(scanning.getChildren(sources[0])[0]),
      getTreeNodeKey(scanning.getChildren(sources[1])[0]),
    );
  });

  test("custom scanner groups remain available below status", () => {
    const custom = fixture("cql-002", "code-scanning/codeql", "Authentication");
    const scoped = { ...repository, getTodos: () => [custom] } as TodoRepository;
    const state = memoryState();
    const scanning = new TodoTreeProvider(
      scoped,
      new FilterService(state),
      new TreeStateService(state),
      undefined,
      "code-scanning",
    );
    const status = scanning.getChildren(scanning.getChildren()[0])[0];
    const group = scanning.getChildren(status)[0];
    assert.strictEqual(group.kind, "group");
    assert.strictEqual(scanning.getTreeItem(group).label, "Group: Authentication (1)");
  });

  test("filters and collapsed state persist independently, including source filtering", async () => {
    const state = memoryState();
    const normalFilter = new FilterService(state);
    const scanFilter = new FilterService(state, "agendo.codeScanning.filter");
    const normalState = new TreeStateService(state);
    const scanState = new TreeStateService(state, "agendo.codeScanning.tree.collapsed");
    await scanFilter.set({ sources: ["sonarqube"], text: "sq-001" });
    assert.ok(scanFilter.isActive);
    assert.deepStrictEqual(normalFilter.current, {});
    assert.strictEqual(scanFilter.matches(todos[1]), false);
    assert.strictEqual(scanFilter.matches(todos[2]), true);
    const scanning = new TodoTreeProvider(
      repository,
      scanFilter,
      scanState,
      undefined,
      "code-scanning",
    );
    assert.deepStrictEqual(
      scanning.getChildren().map((node) => scanning.getTreeItem(node).label),
      ["SonarQube (1)"],
    );
    await scanState.collapse("source:sonarqube");
    assert.ok(!normalState.isCollapsed("source:sonarqube"));
    assert.ok(
      new TreeStateService(state, "agendo.codeScanning.tree.collapsed").isCollapsed(
        "source:sonarqube",
      ),
    );
    assert.deepStrictEqual(
      new FilterService(state, "agendo.codeScanning.filter").current,
      scanFilter.current,
    );
    await normalFilter.set({ statuses: ["completed"] });
    await scanFilter.clear();
    assert.deepStrictEqual(normalFilter.current, { statuses: ["completed"] });
  });

  test("source filters handle regular todos, multiple sources, and empty selection", async () => {
    const filter = new FilterService(memoryState());
    await filter.set({ sources: ["sonarqube"] });
    assert.deepStrictEqual(todos.map((todo) => filter.matches(todo)), [false, false, true]);
    await filter.set({ sources: ["codeql", "sonarqube"] });
    assert.deepStrictEqual(todos.map((todo) => filter.matches(todo)), [false, true, true]);
    await filter.set({ sources: [] });
    assert.deepStrictEqual(todos.map((todo) => filter.matches(todo)), [true, true, true]);
  });

  test("cross-source blockers do not hide scanner todos in dependency mode", () => {
    const finding = { ...todos[1], dependencies: ["001"] };
    const state = memoryState();
    const scoped = {
      ...repository,
      getTodos: () => [todos[0], finding],
      getDependencyGraph: () => ({
        blockedBy: new Map([[finding.id, ["001"]]]),
        blocking: new Map([["001", [finding.id]]]),
      }),
    } as unknown as TodoRepository;
    const scanning = new TodoTreeProvider(
      scoped,
      new FilterService(state),
      new TreeStateService(state),
      undefined,
      "code-scanning",
    );
    const original = vscode.workspace.getConfiguration;
    Object.defineProperty(vscode.workspace, "getConfiguration", {
      configurable: true,
      value: (section: string) => ({
        get: (key: string) => (key === "showDependencyNodes" ? true : original(section).get(key)),
      }),
    });
    try {
      const source = scanning.getChildren()[0];
      const status = scanning.getChildren(source)[0];
      const priority = scanning.getChildren(status)[0];
      const children = scanning.getChildren(priority);
      assert.strictEqual(children.length, 1);
      assert.strictEqual(children[0].kind, "todo");
    } finally {
      Object.defineProperty(vscode.workspace, "getConfiguration", {
        configurable: true,
        value: original,
      });
    }
  });

  test("dependency chains render every scanner todo once", () => {
    const chain = [
      fixture("cql-101", "code-scanning/codeql"),
      fixture("cql-102", "code-scanning/codeql"),
      fixture("cql-103", "code-scanning/codeql"),
    ];
    const state = memoryState();
    const scoped = {
      ...repository,
      getTodos: () => chain,
      getDependencyGraph: () => ({
        blockedBy: new Map([
          ["cql-101", ["cql-102"]],
          ["cql-102", ["cql-103"]],
        ]),
        blocking: new Map(),
      }),
    } as unknown as TodoRepository;
    const scanning = new TodoTreeProvider(
      scoped,
      new FilterService(state),
      new TreeStateService(state),
      undefined,
      "code-scanning",
    );
    const original = vscode.workspace.getConfiguration;
    Object.defineProperty(vscode.workspace, "getConfiguration", {
      configurable: true,
      value: (section: string) => ({
        get: (key: string) => (key === "showDependencyNodes" ? true : original(section).get(key)),
      }),
    });
    try {
      const ids: string[] = [];
      const visit = (nodes: ReturnType<TodoTreeProvider["getChildren"]>) => {
        for (const node of nodes) {
          if (node.kind === "todo" || node.kind === "dependency") {
            ids.push(node.todo.id);
          }
          visit(scanning.getChildren(node));
        }
      };
      visit(scanning.getChildren());
      assert.deepStrictEqual(
        ids.sort(),
        chain.map((todo) => todo.id),
      );
    } finally {
      Object.defineProperty(vscode.workspace, "getConfiguration", {
        configurable: true,
        value: original,
      });
    }
  });

  test("dependency nodes group dependents under their blocker and leave unblocked todos as leaves", () => {
    const blocker = fixture("sq-101", "code-scanning/sonarqube");
    const depA = fixture("sq-102", "code-scanning/sonarqube");
    const depB = fixture("sq-103", "code-scanning/sonarqube");
    const independent = fixture("sq-104", "code-scanning/sonarqube");
    const scoped = {
      ...repository,
      getTodos: () => [blocker, depA, depB, independent],
      getDependencyGraph: () => ({
        blockedBy: new Map([
          [depA.id, [blocker.id]],
          [depB.id, [blocker.id]],
        ]),
        blocking: new Map([[blocker.id, [depA.id, depB.id]]]),
      }),
    } as unknown as TodoRepository;
    const state = memoryState();
    const scanning = new TodoTreeProvider(
      scoped,
      new FilterService(state),
      new TreeStateService(state),
      undefined,
      "code-scanning",
    );
    const original = vscode.workspace.getConfiguration;
    Object.defineProperty(vscode.workspace, "getConfiguration", {
      configurable: true,
      value: (section: string) => ({
        get: (key: string) => (key === "showDependencyNodes" ? true : original(section).get(key)),
      }),
    });
    try {
      const source = scanning.getChildren()[0];
      const status = scanning.getChildren(source)[0];
      const priority = scanning.getChildren(status)[0];
      const children = scanning.getChildren(priority);
      const dependency = children.find((n) => n.kind === "dependency");
      assert.ok(dependency, "expected a dependency node");
      assert.strictEqual(dependency.todo.id, blocker.id);
      assert.strictEqual(dependency.dependents.length, 2);
      const leaves = children.filter((n) => n.kind === "todo");
      assert.strictEqual(leaves.length, 1);
      assert.strictEqual(leaves[0].todo.id, independent.id);
    } finally {
      Object.defineProperty(vscode.workspace, "getConfiguration", {
        configurable: true,
        value: original,
      });
    }
  });

  test("scanning controls mutate only scanning state and contexts", async () => {
    const callbacks = new Map<string, (...args: any[]) => any>();
    const originalRegister = vscode.commands.registerCommand;
    const originalExecute = vscode.commands.executeCommand;
    const originalInput = vscode.window.showInputBox;
    const contexts: string[] = [];
    const state = memoryState();
    const regular = new FilterService(state);
    const scanning = new FilterService(state, "agendo.codeScanning.filter");
    const subscriptions: vscode.Disposable[] = [];
    Object.defineProperty(vscode.commands, "registerCommand", {
      configurable: true,
      value: (id: string, callback: (...args: any[]) => any) => {
        callbacks.set(id, callback);
        return new vscode.Disposable(() => {});
      },
    });
    Object.defineProperty(vscode.commands, "executeCommand", {
      configurable: true,
      value: async (_command: string, context: string) => {
        contexts.push(context);
      },
    });
    Object.defineProperty(vscode.window, "showInputBox", {
      configurable: true,
      value: async () => "sq-001",
    });
    try {
      registerCommands(
        { subscriptions } as never,
        {
          filter: regular,
          treeProvider: { refresh: () => {} },
          boardViewProvider: { refresh: () => {} },
          scanning: {
            filter: scanning,
            treeProvider: { refresh: () => {} },
            boardViewProvider: { refresh: () => {} },
          },
        } as never,
      );
      await callbacks.get(Command.CodeScanningSearch)?.();
      assert.deepStrictEqual(scanning.current, { text: "sq-001" });
      assert.deepStrictEqual(regular.current, {});
      assert.ok(contexts.every((key) => key.startsWith("agendo.codeScanning.")));
      await callbacks.get(Command.CodeScanningClearFilters)?.();
      assert.deepStrictEqual(scanning.current, {});
      assert.deepStrictEqual(regular.current, {});
    } finally {
      Object.defineProperty(vscode.commands, "registerCommand", {
        configurable: true,
        value: originalRegister,
      });
      Object.defineProperty(vscode.commands, "executeCommand", {
        configurable: true,
        value: originalExecute,
      });
      Object.defineProperty(vscode.window, "showInputBox", {
        configurable: true,
        value: originalInput,
      });
      for (const subscription of subscriptions) {
        subscription.dispose();
      }
    }
  });
});
