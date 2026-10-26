import * as assert from "node:assert";
import { Script } from "node:vm";
import * as vscode from "vscode";
import { Command } from "../commands";
import { BoardViewProvider, buildBoardSnapshot } from "../todos/boardViewProvider";
import { FilterService } from "../todos/filterService";
import type { StatusService } from "../todos/statusService";
import { buildFileName, parseTodo, type Todo } from "../todos/todoModel";
import type { TodoRepository } from "../todos/todoRepository";

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

function fixture(id: string, folder: string): Todo {
  const name = buildFileName(id, "pending", "p2", "example");
  const todo = parseTodo(vscode.Uri.file(`/tmp/${name}`), `---\n---\n# Example ${id}`, folder);
  assert.ok(todo);
  return todo;
}

function makeRepository(todos: Todo[]): TodoRepository {
  return {
    getTodos: () => todos,
    getDependencyGraph: () => ({ blockedBy: new Map(), blocking: new Map() }),
    onDidChange: () => new vscode.Disposable(() => {}),
  } as unknown as TodoRepository;
}

function extractScript(html: string): string | undefined {
  return /<script[^>]*>([\s\S]*?)<\/script>/i.exec(html)?.[1];
}

suite("board view scope", () => {
  const regularTodo = fixture("001", "");
  const codeqlTodo = fixture("cql-001", "code-scanning/codeql");
  const sonarTodo = fixture("sq-001", "code-scanning/sonarqube");
  const allTodos = [regularTodo, codeqlTodo, sonarTodo];

  test("regular board excludes scanner todos", () => {
    const filter = new FilterService(memoryState());
    const repo = makeRepository(allTodos);
    const snapshot = buildBoardSnapshot(
      repo.getTodos(),
      repo.getDependencyGraph(),
      filter,
      "todos",
    );
    const visibleIds = snapshot.columns.flatMap((c) => c.todos.map((t) => t.id));
    assert.deepStrictEqual(visibleIds, ["001"]);
    assert.strictEqual(snapshot.scope, "todos");
    assert.strictEqual(snapshot.sections, undefined);
  });

  test("scanning board includes only scanner todos grouped by source", () => {
    const filter = new FilterService(memoryState());
    const repo = makeRepository(allTodos);
    const snapshot = buildBoardSnapshot(
      repo.getTodos(),
      repo.getDependencyGraph(),
      filter,
      "code-scanning",
    );
    assert.strictEqual(snapshot.scope, "code-scanning");
    assert.ok(snapshot.sections);
    assert.strictEqual(snapshot.sections.length, 2);
    assert.strictEqual(snapshot.sections[0].source, "codeql");
    assert.strictEqual(snapshot.sections[0].label, "CodeQL");
    assert.strictEqual(snapshot.sections[1].source, "sonarqube");
    assert.strictEqual(snapshot.sections[1].label, "SonarQube");
    const codeqlIds = snapshot.sections[0].columns.flatMap((c) => c.todos.map((t) => t.id));
    const sonarIds = snapshot.sections[1].columns.flatMap((c) => c.todos.map((t) => t.id));
    assert.deepStrictEqual(codeqlIds, ["cql-001"]);
    assert.deepStrictEqual(sonarIds, ["sq-001"]);
  });

  test("scanning board sections contain all status columns", () => {
    const filter = new FilterService(memoryState());
    const repo = makeRepository(allTodos);
    const snapshot = buildBoardSnapshot(
      repo.getTodos(),
      repo.getDependencyGraph(),
      filter,
      "code-scanning",
    );
    assert.ok(snapshot.sections);
    for (const section of snapshot.sections) {
      assert.strictEqual(section.columns.length, 6);
      const statuses = section.columns.map((c) => c.status);
      assert.deepStrictEqual(statuses, [
        "pending",
        "in-progress",
        "ready",
        "backlogged",
        "complete",
        "cancelled",
      ]);
    }
  });

  test("regular board snapshot is unchanged when no scanner todos exist", () => {
    const filter = new FilterService(memoryState());
    const repo = makeRepository([regularTodo]);
    const snapshot = buildBoardSnapshot(
      repo.getTodos(),
      repo.getDependencyGraph(),
      filter,
      "todos",
    );
    assert.strictEqual(snapshot.scope, "todos");
    assert.strictEqual(snapshot.sections, undefined);
    const visibleIds = snapshot.columns.flatMap((c) => c.todos.map((t) => t.id));
    assert.deepStrictEqual(visibleIds, ["001"]);
  });

  test("scanning board with no scanner todos has empty sections", () => {
    const filter = new FilterService(memoryState());
    const repo = makeRepository([regularTodo]);
    const snapshot = buildBoardSnapshot(
      repo.getTodos(),
      repo.getDependencyGraph(),
      filter,
      "code-scanning",
    );
    assert.ok(snapshot.sections);
    assert.strictEqual(snapshot.sections.length, 2);
    for (const section of snapshot.sections) {
      assert.strictEqual(
        section.columns.reduce((sum, c) => sum + c.totalCount, 0),
        0,
      );
    }
  });

  test("board provider uses separate state keys for scanning scope", () => {
    const state = memoryState();
    const repo = makeRepository(allTodos);
    const filter = new FilterService(memoryState());
    const scanningFilter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;

    const regularBoard = new BoardViewProvider(repo, filter, status, state);
    const scanningBoard = new BoardViewProvider(
      repo,
      scanningFilter,
      status,
      state,
      "code-scanning",
    );

    // Trigger snapshot sends (which read state)
    (regularBoard as unknown as { sendSnapshot: () => void }).sendSnapshot();
    (scanningBoard as unknown as { sendSnapshot: () => void }).sendSnapshot();

    // Each board resolves the same preference into its own namespace.
    // Since no panel exists, sendSnapshot is a no-op, but the key resolver should still work
    const regularKeys = state.keys();
    assert.deepStrictEqual(regularKeys, []);
    // Without a panel, no state updates happen on read; test the keyFor method directly
    const regularKeyFor = (regularBoard as unknown as { keyFor: (k: string) => string }).keyFor(
      "agendo.board.sort",
    );
    const scanningKeyFor = (scanningBoard as unknown as { keyFor: (k: string) => string }).keyFor(
      "agendo.board.sort",
    );
    assert.strictEqual(regularKeyFor, "agendo.board.sort");
    assert.strictEqual(scanningKeyFor, "agendo.codeScanning.board.sort");
    assert.notStrictEqual(regularKeyFor, scanningKeyFor);
  });

  test("board provider exposes refresh method", () => {
    const state = memoryState();
    const repo = makeRepository(allTodos);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state);
    assert.strictEqual(typeof board.refresh, "function");
    // Should not throw when no panel exists
    board.refresh();
  });

  test("scanning board refresh does not throw", () => {
    const state = memoryState();
    const repo = makeRepository(allTodos);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state, "code-scanning");
    assert.strictEqual(typeof board.refresh, "function");
    board.refresh();
  });

  test("board provider default scope is todos", () => {
    const state = memoryState();
    const repo = makeRepository(allTodos);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state);
    const scope = (board as unknown as { scope: string }).scope;
    assert.strictEqual(scope, "todos");
  });

  test("scanning board provider has code-scanning scope", () => {
    const state = memoryState();
    const repo = makeRepository(allTodos);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state, "code-scanning");
    const scope = (board as unknown as { scope: string }).scope;
    assert.strictEqual(scope, "code-scanning");
  });

  test("scanning source filter hides the unselected source section", async () => {
    const filter = new FilterService(memoryState());
    await filter.set({ sources: ["sonarqube"] });
    const repo = makeRepository(allTodos);
    const snapshot = buildBoardSnapshot(
      allTodos,
      repo.getDependencyGraph(),
      filter,
      "code-scanning",
    );
    assert.deepStrictEqual(
      snapshot.sections?.map((section) => section.source),
      ["sonarqube"],
    );
  });

  test("openCanvas dispatches OpenCanvas with board return target for regular board", async () => {
    const state = memoryState();
    const repo = makeRepository([regularTodo]);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state);
    const executeCalls: Array<{ id: string; args: unknown[] }> = [];
    const originalExecute = vscode.commands.executeCommand;
    Object.defineProperty(vscode.commands, "executeCommand", {
      configurable: true,
      value: async (id: string, ...args: unknown[]) => {
        executeCalls.push({ id, args });
      },
    });
    try {
      const controls = board as unknown as {
        handleMessage: (message: Record<string, unknown>) => Promise<void>;
      };
      await controls.handleMessage({ type: "openCanvas", todoId: "001" });
      const openCanvasCall = executeCalls.find((c) => c.id === Command.OpenCanvas);
      assert.ok(openCanvasCall);
      assert.deepStrictEqual(openCanvasCall.args, [
        { todoId: "001", returnTo: { kind: "board", scope: "todos" } },
      ]);
    } finally {
      board.dispose();
      Object.defineProperty(vscode.commands, "executeCommand", {
        configurable: true,
        value: originalExecute,
      });
    }
  });

  test("openCanvas dispatches OpenCanvas with code-scanning return target for scanning board", async () => {
    const state = memoryState();
    const repo = makeRepository([codeqlTodo]);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state, "code-scanning");
    const executeCalls: Array<{ id: string; args: unknown[] }> = [];
    const originalExecute = vscode.commands.executeCommand;
    Object.defineProperty(vscode.commands, "executeCommand", {
      configurable: true,
      value: async (id: string, ...args: unknown[]) => {
        executeCalls.push({ id, args });
      },
    });
    try {
      const controls = board as unknown as {
        handleMessage: (message: Record<string, unknown>) => Promise<void>;
      };
      await controls.handleMessage({ type: "openCanvas", todoId: "cql-001" });
      const openCanvasCall = executeCalls.find((c) => c.id === Command.OpenCanvas);
      assert.ok(openCanvasCall);
      assert.deepStrictEqual(openCanvasCall.args, [
        {
          todoId: "cql-001",
          returnTo: { kind: "board", scope: "code-scanning" },
        },
      ]);
    } finally {
      board.dispose();
      Object.defineProperty(vscode.commands, "executeCommand", {
        configurable: true,
        value: originalExecute,
      });
    }
  });

  test("openCanvas does not modify view mode, filter, or board preferences", async () => {
    const state = memoryState();
    await state.update("agendo.board.sort", "title");
    await state.update("agendo.board.hiddenStatuses", ["cancelled"]);
    const repo = makeRepository([regularTodo]);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state);
    const originalExecute = vscode.commands.executeCommand;
    Object.defineProperty(vscode.commands, "executeCommand", {
      configurable: true,
      value: async () => {},
    });
    try {
      const controls = board as unknown as {
        handleMessage: (message: Record<string, unknown>) => Promise<void>;
      };
      await controls.handleMessage({ type: "openCanvas", todoId: "001" });
      assert.strictEqual(state.get("agendo.board.sort"), "title");
      assert.deepStrictEqual(state.get("agendo.board.hiddenStatuses"), ["cancelled"]);
    } finally {
      board.dispose();
      Object.defineProperty(vscode.commands, "executeCommand", {
        configurable: true,
        value: originalExecute,
      });
    }
  });

  test("existing open message still dispatches OpenPreview", async () => {
    const state = memoryState();
    const repo = makeRepository([regularTodo]);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state);
    const executeCalls: Array<{ id: string; args: unknown[] }> = [];
    const originalExecute = vscode.commands.executeCommand;
    Object.defineProperty(vscode.commands, "executeCommand", {
      configurable: true,
      value: async (id: string, ...args: unknown[]) => {
        executeCalls.push({ id, args });
      },
    });
    try {
      const controls = board as unknown as {
        handleMessage: (message: Record<string, unknown>) => Promise<void>;
      };
      await controls.handleMessage({ type: "open", todoId: "001" });
      const openPreviewCall = executeCalls.find((c) => c.id === Command.OpenPreview);
      assert.ok(openPreviewCall);
      const previewArg = openPreviewCall.args[0] as {
        kind: string;
        todo: { id: string };
      };
      assert.strictEqual(previewArg.kind, "todo");
      assert.strictEqual(previewArg.todo.id, "001");
      const openCanvasCall = executeCalls.find((c) => c.id === Command.OpenCanvas);
      assert.strictEqual(openCanvasCall, undefined);
    } finally {
      board.dispose();
      Object.defineProperty(vscode.commands, "executeCommand", {
        configurable: true,
        value: originalExecute,
      });
    }
  });

  test("openCanvas rejects cross-scope selection from regular board", async () => {
    const state = memoryState();
    const repo = makeRepository([regularTodo, codeqlTodo]);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state);
    const executeCalls: Array<{ id: string; args: unknown[] }> = [];
    const originalExecute = vscode.commands.executeCommand;
    Object.defineProperty(vscode.commands, "executeCommand", {
      configurable: true,
      value: async (id: string, ...args: unknown[]) => {
        executeCalls.push({ id, args });
      },
    });
    try {
      const controls = board as unknown as {
        handleMessage: (message: Record<string, unknown>) => Promise<void>;
      };
      await controls.handleMessage({ type: "openCanvas", todoId: "cql-001" });
      const openCanvasCall = executeCalls.find((c) => c.id === Command.OpenCanvas);
      assert.strictEqual(openCanvasCall, undefined);
    } finally {
      board.dispose();
      Object.defineProperty(vscode.commands, "executeCommand", {
        configurable: true,
        value: originalExecute,
      });
    }
  });

  test("openCanvas rejects cross-scope selection from scanning board", async () => {
    const state = memoryState();
    const repo = makeRepository([regularTodo, codeqlTodo]);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state, "code-scanning");
    const executeCalls: Array<{ id: string; args: unknown[] }> = [];
    const originalExecute = vscode.commands.executeCommand;
    Object.defineProperty(vscode.commands, "executeCommand", {
      configurable: true,
      value: async (id: string, ...args: unknown[]) => {
        executeCalls.push({ id, args });
      },
    });
    try {
      const controls = board as unknown as {
        handleMessage: (message: Record<string, unknown>) => Promise<void>;
      };
      await controls.handleMessage({ type: "openCanvas", todoId: "001" });
      const openCanvasCall = executeCalls.find((c) => c.id === Command.OpenCanvas);
      assert.strictEqual(openCanvasCall, undefined);
    } finally {
      board.dispose();
      Object.defineProperty(vscode.commands, "executeCommand", {
        configurable: true,
        value: originalExecute,
      });
    }
  });

  test("openCanvas ignores ambiguous duplicate todo IDs", async () => {
    const state = memoryState();
    const duplicate = {
      ...codeqlTodo,
      folder: "code-scanning/codeql/dup",
      fileName: "dup-cql-001-pending-p2-example.md",
      uri: vscode.Uri.file("/tmp/dup-cql-001-pending-p2-example.md"),
    };
    const repo = makeRepository([codeqlTodo, duplicate]);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state, "code-scanning");
    const executeCalls: Array<{ id: string; args: unknown[] }> = [];
    const originalExecute = vscode.commands.executeCommand;
    const originalShowWarning = vscode.window.showWarningMessage;
    const warnings: string[] = [];
    Object.defineProperty(vscode.commands, "executeCommand", {
      configurable: true,
      value: async (id: string, ...args: unknown[]) => {
        executeCalls.push({ id, args });
      },
    });
    Object.defineProperty(vscode.window, "showWarningMessage", {
      configurable: true,
      value: async (message: string) => {
        warnings.push(message);
        return undefined;
      },
    });
    try {
      const controls = board as unknown as {
        handleMessage: (message: Record<string, unknown>) => Promise<void>;
      };
      await controls.handleMessage({ type: "openCanvas", todoId: "cql-001" });
      const openCanvasCall = executeCalls.find((c) => c.id === Command.OpenCanvas);
      assert.strictEqual(openCanvasCall, undefined);
      assert.ok(warnings.some((w) => w.includes("cql-001")));
    } finally {
      board.dispose();
      Object.defineProperty(vscode.commands, "executeCommand", {
        configurable: true,
        value: originalExecute,
      });
      Object.defineProperty(vscode.window, "showWarningMessage", {
        configurable: true,
        value: originalShowWarning,
      });
    }
  });

  test("opening board panel again reveals original without resetting HTML or state", async () => {
    const state = memoryState();
    await state.update("agendo.board.sort", "priority");
    const repo = makeRepository([regularTodo]);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state);
    const originalPanel = vscode.window.createWebviewPanel;
    let createCount = 0;
    let revealCount = 0;
    let htmlSets = 0;
    let capturedHtml = "";
    Object.defineProperty(vscode.window, "createWebviewPanel", {
      configurable: true,
      value: () => {
        createCount++;
        return {
          webview: {
            cspSource: "test",
            get html() {
              return capturedHtml;
            },
            set html(value: string) {
              htmlSets++;
              capturedHtml = value;
            },
            postMessage: async () => true,
            onDidReceiveMessage: () => new vscode.Disposable(() => {}),
          },
          onDidDispose: () => new vscode.Disposable(() => {}),
          reveal: () => {
            revealCount++;
          },
          dispose: () => {},
        };
      },
    });
    try {
      board.open();
      assert.strictEqual(createCount, 1);
      assert.strictEqual(htmlSets, 1);
      assert.strictEqual(revealCount, 0);
      const firstHtml = capturedHtml;
      board.open();
      assert.strictEqual(createCount, 1);
      assert.strictEqual(htmlSets, 1);
      assert.strictEqual(revealCount, 1);
      assert.strictEqual(capturedHtml, firstHtml);
      assert.strictEqual(state.get("agendo.board.sort"), "priority");
    } finally {
      board.dispose();
      Object.defineProperty(vscode.window, "createWebviewPanel", {
        configurable: true,
        value: originalPanel,
      });
    }
  });

  test("webview script renders work session button disabled for colliding todos", async () => {
    const originalPanel = vscode.window.createWebviewPanel;
    const panels = new Map<string, { html: string }>();
    Object.defineProperty(vscode.window, "createWebviewPanel", {
      configurable: true,
      value: (id: string) => {
        const captured = { html: "" };
        panels.set(id, captured);
        return {
          webview: {
            cspSource: "test",
            get html() {
              return captured.html;
            },
            set html(value: string) {
              captured.html = value;
            },
            postMessage: async () => true,
            onDidReceiveMessage: () => new vscode.Disposable(() => {}),
          },
          onDidDispose: () => new vscode.Disposable(() => {}),
          reveal: () => {},
          dispose: () => {},
        };
      },
    });
    try {
      const state = memoryState();
      const repo = makeRepository(allTodos);
      const board = new BoardViewProvider(
        repo,
        new FilterService(memoryState()),
        {} as unknown as StatusService,
        state,
      );
      board.open();
      const html = panels.get("agendo.board")?.html ?? "";
      const script = extractScript(html);
      assert.ok(script);
      assert.doesNotThrow(() => new Script(script));
      assert.ok(script.includes("workSession.disabled = Boolean(todo.collision)"));
      assert.ok(script.includes('host.postMessage({ type: "openCanvas", todoId: todo.id })'));
      board.dispose();
    } finally {
      Object.defineProperty(vscode.window, "createWebviewPanel", {
        configurable: true,
        value: originalPanel,
      });
    }
  });

  test("webview script extraction accepts uppercase script tags", () => {
    assert.strictEqual(extractScript("<SCRIPT>test()</SCRIPT>"), "test()");
  });

  test("boards coexist with isolated preferences, source-local limits, and scoped command validation", async () => {
    const originalPanel = vscode.window.createWebviewPanel;
    const originalExecute = vscode.commands.executeCommand;
    const panels = new Map<string, { html: string; snapshots: any[] }>();
    const commands: string[] = [];
    const completed = ["cql", "sq"].flatMap((prefix) =>
      Array.from({ length: 12 }, (_, index) => ({
        ...fixture(
          `${prefix}-${index + 100}`,
          `code-scanning/${prefix === "cql" ? "codeql" : "sonarqube"}`,
        ),
        status: "complete" as const,
      })),
    );
    const collision = {
      ...codeqlTodo,
      status: "cancelled" as const,
      folder: "code-scanning/codeql/cancelled",
      fileName: codeqlTodo.fileName.replace("-pending-", "-cancelled-"),
      uri: codeqlTodo.uri.with({
        path: codeqlTodo.uri.path.replace("-pending-", "-cancelled-"),
      }),
    };
    const repo = makeRepository([...allTodos, ...completed, collision]);
    let statusChanges = 0;
    const status = {
      setStatus: async () => {
        statusChanges++;
      },
    } as unknown as StatusService;
    const state = memoryState();
    const regular = new BoardViewProvider(repo, new FilterService(state), status, state);
    const scanningFilter = new FilterService(state, "scanning.filter");
    const scanning = new BoardViewProvider(repo, scanningFilter, status, state, "code-scanning");
    Object.defineProperty(vscode.window, "createWebviewPanel", {
      configurable: true,
      value: (id: string) => {
        const captured = { html: "", snapshots: [] as any[] };
        panels.set(id, captured);
        return {
          webview: {
            cspSource: "test",
            get html() {
              return captured.html;
            },
            set html(value: string) {
              captured.html = value;
            },
            postMessage: async (message: any) => {
              if (message.type === "snapshot") {
                captured.snapshots.push(message.snapshot);
              }
              return true;
            },
            onDidReceiveMessage: () => new vscode.Disposable(() => {}),
          },
          onDidDispose: () => new vscode.Disposable(() => {}),
          reveal: () => {},
          dispose: () => {},
        };
      },
    });
    Object.defineProperty(vscode.commands, "executeCommand", {
      configurable: true,
      value: async (id: string) => {
        commands.push(id);
      },
    });
    try {
      regular.open();
      scanning.open();
      assert.deepStrictEqual([...panels.keys()], ["agendo.board", "agendo.codeScanning.board"]);
      const controls = scanning as unknown as {
        handleMessage: (message: Record<string, unknown>) => Promise<void>;
      };
      await controls.handleMessage({ type: "setBoardSort", sort: "title" });
      await controls.handleMessage({
        type: "setTerminalCardLimit",
        terminalCardLimit: "10",
      });
      await controls.handleMessage({ type: "hideStatus", status: "cancelled" });
      await controls.handleMessage({
        type: "setHideEmptyColumns",
        enabled: true,
      });
      await controls.handleMessage({
        type: "setMetadataLabels",
        enabled: true,
      });
      assert.strictEqual(state.get("agendo.codeScanning.board.sort"), "title");
      assert.strictEqual(state.get("agendo.board.sort"), undefined);
      const snapshots = panels.get("agendo.codeScanning.board")?.snapshots ?? [];
      const snapshot = snapshots[snapshots.length - 1];
      assert.ok(snapshot);
      assert.strictEqual(snapshot.hideEmptyColumns, true);
      assert.strictEqual(snapshot.showMetadataLabels, true);
      regular.refresh();
      const regularSnapshots = panels.get("agendo.board")?.snapshots ?? [];
      assert.strictEqual(regularSnapshots[regularSnapshots.length - 1].hideEmptyColumns, false);
      assert.strictEqual(regularSnapshots[regularSnapshots.length - 1].showMetadataLabels, false);
      for (const section of snapshot.sections) {
        assert.ok(!section.columns.some((column: any) => column.status === "cancelled"));
        const terminal = section.columns.find((column: any) => column.status === "complete");
        assert.strictEqual(terminal.todos.length, 10);
        assert.strictEqual(terminal.totalCount, 12);
      }
      await scanningFilter.set({
        collision: { id: "cql-001", source: "codeql" },
      });
      scanning.refresh();
      const focused = snapshots[snapshots.length - 1];
      assert.strictEqual(focused.terminalCardLimit, "all");
      assert.deepStrictEqual(focused.hiddenStatuses, []);
      assert.ok(focused.sections[0].columns.some((column: any) => column.status === "cancelled"));
      assert.strictEqual(
        focused.sections[0].columns.flatMap((column: any) => column.todos).length,
        2,
      );
      assert.deepStrictEqual(state.get("agendo.codeScanning.board.hiddenStatuses"), ["cancelled"]);
      await scanningFilter.clear();
      scanning.refresh();
      const restored = snapshots[snapshots.length - 1];
      assert.strictEqual(restored.terminalCardLimit, "10");
      assert.deepStrictEqual(restored.hiddenStatuses, ["cancelled"]);
      await controls.handleMessage({
        type: "focusCollision",
        todoId: "cql-001",
        collisionSource: "codeql",
      });
      await controls.handleMessage({
        type: "focusCollision",
        todoId: "cql-001",
        collisionSource: "todo",
      });
      await controls.handleMessage({
        type: "scopedCommand",
        command: "agendo.codeScanning.refresh",
      });
      await controls.handleMessage({
        type: "scopedCommand",
        command: "agendo.refresh",
      });
      await controls.handleMessage({
        type: "scopedCommand",
        command: "workbench.action.closeWindow",
      });
      assert.deepStrictEqual(commands, ["agendo.focusCollision", "agendo.codeScanning.refresh"]);
      await controls.handleMessage({
        type: "setStatus",
        todoId: "001",
        status: "complete",
      });
      assert.strictEqual(statusChanges, 0);
      const html = panels.get("agendo.codeScanning.board")?.html ?? "";
      const script = extractScript(html);
      assert.ok(script);
      assert.doesNotThrow(() => new Script(script));
      assert.ok(script.includes("columnElement.parentElement.children"));
      assert.ok(html.includes(".board.source-sections { display: block"));
    } finally {
      regular.dispose();
      scanning.dispose();
      Object.defineProperty(vscode.window, "createWebviewPanel", {
        configurable: true,
        value: originalPanel,
      });
      Object.defineProperty(vscode.commands, "executeCommand", {
        configurable: true,
        value: originalExecute,
      });
    }
  });
});
