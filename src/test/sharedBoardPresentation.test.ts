import * as assert from "node:assert";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { Script } from "node:vm";
import * as vscode from "vscode";
import { BoardViewProvider } from "../todos/boardViewProvider";
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
    refresh: async () => {},
  } as unknown as TodoRepository;
}

function extractScript(html: string): string {
  const match = /<script[^>]*>([\s\S]*?)<\/script>/.exec(html);
  assert.ok(match, "Expected a <script> block in HTML");
  return match[1];
}

const BOARD_HTML_PATH = path.join(
  __dirname,
  "../../resources/canvas/agendo-work-session/board.html",
);

const importBoard = new Function("url", "return import(url)") as (url: string) => Promise<{
  renderBoardCanvas: (scope: string, nav: unknown, nonce: string, csp: string) => string;
}>;

suite("shared board presentation", () => {
  const regularTodo = fixture("001", "");
  const codeqlTodo = fixture("cql-001", "code-scanning/codeql");
  const sonarTodo = fixture("sq-001", "code-scanning/sonarqube");
  const allTodos = [regularTodo, codeqlTodo, sonarTodo];

  test("shared board.html contains no VS Code-specific API calls", () => {
    const template = readFileSync(BOARD_HTML_PATH, "utf8");
    assert.ok(!template.includes("acquireVsCodeApi"), "board.html must not call acquireVsCodeApi");
    assert.ok(
      !template.includes("vscode.postMessage"),
      "board.html must not call vscode.postMessage",
    );
    assert.ok(
      !template.includes("window.addEventListener('message'"),
      "board.html must not listen for window message events",
    );
    assert.ok(
      !template.includes('window.addEventListener("message"'),
      "board.html must not listen for window message events",
    );
  });

  test("shared board.html uses only host bridge for communication", () => {
    const template = readFileSync(BOARD_HTML_PATH, "utf8");
    assert.ok(
      template.includes("globalThis.agendoBoardHost"),
      "board.html must reference the host bridge",
    );
    assert.ok(template.includes("host.postMessage("), "board.html must use host.postMessage");
    assert.ok(template.includes("host.onMessage("), "board.html must use host.onMessage");
  });

  test("shared board.html contains all required placeholder tokens", () => {
    const template = readFileSync(BOARD_HTML_PATH, "utf8");
    assert.ok(template.includes("__AGENDO_BOARD_CSP__"), "Missing CSP placeholder");
    assert.ok(template.includes("__AGENDO_BOARD_NONCE__"), "Missing nonce placeholder");
    assert.ok(template.includes("__AGENDO_BOARD_NAV__"), "Missing navigation placeholder");
    assert.ok(template.includes("__AGENDO_BOARD_HOST__"), "Missing host bootstrap placeholder");
  });

  test("shared board.html preserves control, card field, DnD, and status ordering features", () => {
    const template = readFileSync(BOARD_HTML_PATH, "utf8");
    assert.ok(template.includes("hideStatus"), "Missing hideStatus handler");
    assert.ok(template.includes("showStatus"), "Missing showStatus handler");
    assert.ok(template.includes("reorderStatuses"), "Missing reorderStatuses handler");
    assert.ok(template.includes("setStatus"), "Missing setStatus handler");
    assert.ok(template.includes("setPriority"), "Missing setPriority handler");
    assert.ok(template.includes("dragstart"), "Missing dragstart handler");
    assert.ok(template.includes("dragover"), "Missing dragover handler");
    assert.ok(template.includes("drop"), "Missing drop handler");
    assert.ok(template.includes("pending"), "Missing pending status");
    assert.ok(template.includes("in-progress"), "Missing in-progress status");
    assert.ok(template.includes("ready"), "Missing ready status");
    assert.ok(template.includes("backlogged"), "Missing backlogged status");
    assert.ok(template.includes("complete"), "Missing complete status");
    assert.ok(template.includes("cancelled"), "Missing cancelled status");
    assert.ok(template.includes("source-section"), "Missing source section rendering");
    assert.ok(template.includes("terminalCardLimit"), "Missing terminal card limit");
    assert.ok(template.includes("wipLimit"), "Missing WIP limit");
  });

  test("shared board.html contains all board settings controls", () => {
    const template = readFileSync(BOARD_HTML_PATH, "utf8");
    assert.ok(template.includes("setBoardSort"), "Missing sort control");
    assert.ok(template.includes("setCardDensity"), "Missing density control");
    assert.ok(template.includes("setHideEmptyColumns"), "Missing hide empty columns control");
    assert.ok(template.includes("setMetadataLabels"), "Missing metadata labels control");
    assert.ok(template.includes("setTagLimit"), "Missing tag limit control");
    assert.ok(template.includes("setTitleWrapping"), "Missing title wrapping control");
    assert.ok(template.includes("setCardAccent"), "Missing card accent control");
    assert.ok(template.includes("setColumnWidth"), "Missing column width control");
    assert.ok(template.includes("setGrouping"), "Missing grouping control");
    assert.ok(template.includes("applyPreset"), "Missing preset control");
    assert.ok(template.includes("resetBoardSettings"), "Missing reset control");
  });

  test("shared board.html contains card field visibility controls", () => {
    const template = readFileSync(BOARD_HTML_PATH, "utf8");
    assert.ok(template.includes("setCardFieldVisibility"), "Missing card field visibility handler");
    assert.ok(template.includes("reorderCardFields"), "Missing card field reorder handler");
    assert.ok(template.includes("setting-row"), "Missing card field setting rows");
  });

  test("shared board.html script syntax compiles", () => {
    const template = readFileSync(BOARD_HTML_PATH, "utf8");
    const script = extractScript(template);
    assert.doesNotThrow(() => new Script(script), "board.html script must compile");
  });

  test("native provider getHtml injects VS Code bootstrap with acquireVsCodeApi", async () => {
    const state = memoryState();
    const repo = makeRepository(allTodos);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state);
    const originalPanel = vscode.window.createWebviewPanel;
    let capturedHtml = "";
    Object.defineProperty(vscode.window, "createWebviewPanel", {
      configurable: true,
      value: () => ({
        webview: {
          cspSource: "test",
          get html() {
            return capturedHtml;
          },
          set html(value: string) {
            capturedHtml = value;
          },
          postMessage: async () => true,
          onDidReceiveMessage: () => new vscode.Disposable(() => {}),
        },
        onDidDispose: () => new vscode.Disposable(() => {}),
        reveal: () => {},
        dispose: () => {},
      }),
    });
    try {
      board.open();
      assert.ok(capturedHtml.length > 0, "Expected HTML to be set on webview panel");
      assert.ok(
        capturedHtml.includes("acquireVsCodeApi"),
        "Native HTML must include acquireVsCodeApi in bootstrap",
      );
      assert.ok(
        capturedHtml.includes("globalThis.agendoBoardHost"),
        "Native HTML must set the host bridge",
      );
      const script = extractScript(capturedHtml);
      assert.doesNotThrow(() => new Script(script), "Native HTML script must compile");
      assert.ok(script.includes("workSession.disabled = Boolean(todo.collision)"));
      assert.ok(script.includes("columnElement.parentElement.children"));
      assert.ok(capturedHtml.includes(".board.source-sections { display: block"));
    } finally {
      board.dispose();
      Object.defineProperty(vscode.window, "createWebviewPanel", {
        configurable: true,
        value: originalPanel,
      });
    }
  });

  test("HTTP renderBoardCanvas produces board with navigation and no acquireVsCodeApi", async () => {
    const mod = await importBoard(
      pathToFileURL(path.join(path.dirname(BOARD_HTML_PATH), "board.mjs")).href,
    );
    const nav = {
      recent: [
        {
          kind: "board",
          scope: "todos",
          title: "Todos Board",
          current: true,
        },
      ],
      canBack: false,
      canForward: false,
      returnTo: undefined,
    };
    const nonce = "test-nonce-123";
    const csp = "default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-test-nonce-123';";
    const html = mod.renderBoardCanvas("todos", nav, nonce, csp);

    assert.ok(!html.includes("acquireVsCodeApi"), "HTTP HTML must not include acquireVsCodeApi");
    assert.ok(html.includes("globalThis.agendoBoardHost"), "HTTP HTML must set the host bridge");
    assert.ok(html.includes("X-Agendo-Canvas"), "HTTP HTML must include canvas auth header");
    assert.ok(html.includes("/board-snapshot"), "HTTP HTML must fetch board snapshots");
    assert.ok(html.includes("/board-message"), "HTTP HTML must post board messages");
    assert.ok(
      html.includes('<div class="workspace-navigation">'),
      "HTTP HTML must include navigation",
    );

    const script = extractScript(html);
    assert.doesNotThrow(() => new Script(script), "HTTP HTML script must compile");

    const scriptTagMatch = /<script nonce="([^"]+)">/.exec(html);
    assert.ok(scriptTagMatch, "Expected nonce attribute on script tag");
    assert.strictEqual(scriptTagMatch[1], nonce, "Script nonce must match provided nonce");

    assert.ok(script.includes("workSession.disabled = Boolean(todo.collision)"));
    assert.ok(script.includes("columnElement.parentElement.children"));
    assert.ok(html.includes(".board.source-sections { display: block"));
  });

  test("HTTP renderBoardCanvas for code-scanning scope", async () => {
    const mod = await importBoard(
      pathToFileURL(path.join(path.dirname(BOARD_HTML_PATH), "board.mjs")).href,
    );
    const nav = {
      recent: [
        {
          kind: "board",
          scope: "code-scanning",
          title: "Code Scanning Board",
          current: true,
        },
      ],
      canBack: false,
      canForward: false,
      returnTo: undefined,
    };
    const nonce = "scanning-nonce";
    const csp = "default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-scanning-nonce';";
    const html = mod.renderBoardCanvas("code-scanning", nav, nonce, csp);
    assert.ok(html.includes("code-scanning"), "HTML must reference the scanning scope");
    const scriptTagMatch = /<script nonce="([^"]+)">/.exec(html);
    assert.ok(scriptTagMatch);
    assert.strictEqual(scriptTagMatch[1], nonce);
  });

  test("provider getSnapshot returns default snapshot without panel", () => {
    const state = memoryState();
    const repo = makeRepository(allTodos);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state);
    const snapshot = board.getSnapshot();
    assert.strictEqual(snapshot.scope, "todos");
    assert.strictEqual(snapshot.columns.length, 6);
    assert.strictEqual(snapshot.sort, "default");
    assert.strictEqual(snapshot.cardDensity, "comfortable");
    assert.strictEqual(snapshot.terminalCardLimit, "all");
    assert.strictEqual(snapshot.hideEmptyColumns, false);
    assert.strictEqual(snapshot.showMetadataLabels, false);
    board.dispose();
  });

  test("provider handleCanvasMessage rejects invalid messages", async () => {
    const state = memoryState();
    const repo = makeRepository(allTodos);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state);
    try {
      await assert.rejects(
        () => board.handleCanvasMessage(null),
        /Expected a board message object/,
      );
      await assert.rejects(
        () => board.handleCanvasMessage("not an object"),
        /Expected a board message object/,
      );
      await assert.rejects(() => board.handleCanvasMessage([]), /Expected a board message object/);
      await assert.rejects(
        () => board.handleCanvasMessage({ noType: "value" }),
        /Expected a board message object/,
      );
      await assert.rejects(
        () => board.handleCanvasMessage({ type: "unknownAction" }),
        /Unsupported board action/,
      );
    } finally {
      board.dispose();
    }
  });

  test("provider handleCanvasMessage accepts ready message", async () => {
    const state = memoryState();
    const repo = makeRepository(allTodos);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state);
    try {
      await board.handleCanvasMessage({ type: "ready" });
    } finally {
      board.dispose();
    }
  });

  test("provider sort preference affects snapshot", async () => {
    const state = memoryState();
    const repo = makeRepository(allTodos);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state);
    try {
      await board.handleCanvasMessage({ type: "setBoardSort", sort: "priority" });
      const snapshot = board.getSnapshot();
      assert.strictEqual(snapshot.sort, "priority");
    } finally {
      board.dispose();
    }
  });

  test("provider hideStatus preference affects snapshot columns", async () => {
    const state = memoryState();
    const repo = makeRepository(allTodos);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state);
    try {
      await board.handleCanvasMessage({ type: "hideStatus", status: "cancelled" });
      const snapshot = board.getSnapshot();
      assert.deepStrictEqual(snapshot.hiddenStatuses, ["cancelled"]);
      const statuses = snapshot.columns.map((c) => c.status);
      assert.ok(!statuses.includes("cancelled"), "Cancelled column must be hidden");
    } finally {
      board.dispose();
    }
  });

  test("provider hideEmptyColumns preference affects snapshot", async () => {
    const state = memoryState();
    const repo = makeRepository([regularTodo]);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state);
    try {
      await board.handleCanvasMessage({
        type: "setHideEmptyColumns",
        enabled: true,
      });
      const snapshot = board.getSnapshot();
      assert.strictEqual(snapshot.hideEmptyColumns, true);
      assert.strictEqual(snapshot.columns.length, 1, "Only non-empty column should remain");
      assert.strictEqual(snapshot.columns[0].status, "pending");
    } finally {
      board.dispose();
    }
  });

  test("provider terminalCardLimit affects snapshot", async () => {
    const completedTodos = Array.from({ length: 15 }, (_, i) => {
      const id = String(100 + i).padStart(3, "0");
      return {
        ...fixture(id, ""),
        status: "complete" as const,
      };
    });
    const state = memoryState();
    const repo = makeRepository([...allTodos, ...completedTodos]);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state);
    try {
      await board.handleCanvasMessage({
        type: "setTerminalCardLimit",
        terminalCardLimit: "10",
      });
      const snapshot = board.getSnapshot();
      const completeColumn = snapshot.columns.find((c) => c.status === "complete");
      assert.ok(completeColumn);
      assert.strictEqual(completeColumn.todos.length, 10, "Limited to 10 cards");
      assert.strictEqual(completeColumn.totalCount, 15, "Total count preserved");
    } finally {
      board.dispose();
    }
  });

  test("separate board providers have isolated preferences", async () => {
    const state = memoryState();
    const repo = makeRepository(allTodos);
    const filter1 = new FilterService(memoryState());
    const filter2 = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const regular = new BoardViewProvider(repo, filter1, status, state);
    const scanning = new BoardViewProvider(repo, filter2, status, state, "code-scanning");
    try {
      await regular.handleCanvasMessage({ type: "setBoardSort", sort: "priority" });
      await regular.handleCanvasMessage({ type: "hideStatus", status: "cancelled" });
      await scanning.handleCanvasMessage({ type: "setBoardSort", sort: "title" });

      const regularSnapshot = regular.getSnapshot();
      const scanningSnapshot = scanning.getSnapshot();
      assert.strictEqual(regularSnapshot.sort, "priority");
      assert.strictEqual(scanningSnapshot.sort, "title");
      assert.strictEqual(regularSnapshot.hiddenStatuses.length, 1);
      assert.strictEqual(scanningSnapshot.hiddenStatuses.length, 0);
      assert.strictEqual(scanningSnapshot.scope, "code-scanning");
      assert.strictEqual(regularSnapshot.scope, "todos");
    } finally {
      regular.dispose();
      scanning.dispose();
    }
  });

  test("scanning board snapshot contains source sections", async () => {
    const state = memoryState();
    const repo = makeRepository(allTodos);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state, "code-scanning");
    try {
      const snapshot = board.getSnapshot();
      assert.strictEqual(snapshot.scope, "code-scanning");
      assert.ok(snapshot.sections);
      assert.strictEqual(snapshot.sections.length, 2);
      assert.strictEqual(snapshot.sections[0].source, "codeql");
      assert.strictEqual(snapshot.sections[0].label, "CodeQL");
      assert.strictEqual(snapshot.sections[1].source, "sonarqube");
      assert.strictEqual(snapshot.sections[1].label, "SonarQube");
    } finally {
      board.dispose();
    }
  });

  test("provider showStatus restores hidden column", async () => {
    const state = memoryState();
    const repo = makeRepository(allTodos);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state);
    try {
      await board.handleCanvasMessage({ type: "hideStatus", status: "backlogged" });
      let snapshot = board.getSnapshot();
      const statuses1 = snapshot.columns.map((c) => c.status);
      assert.ok(!statuses1.includes("backlogged"));

      await board.handleCanvasMessage({ type: "showStatus", status: "backlogged" });
      snapshot = board.getSnapshot();
      const statuses2 = snapshot.columns.map((c) => c.status);
      assert.ok(statuses2.includes("backlogged"), "Backlogged column must be restored");
      assert.strictEqual(snapshot.hiddenStatuses.length, 0);
    } finally {
      board.dispose();
    }
  });

  test("provider reorderStatuses changes column order in snapshot", async () => {
    const state = memoryState();
    const repo = makeRepository(allTodos);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state);
    try {
      await board.handleCanvasMessage({
        type: "reorderStatuses",
        statuses: ["complete", "pending", "in-progress", "ready", "backlogged", "cancelled"],
      });
      const snapshot = board.getSnapshot();
      const statuses = snapshot.columns.map((c) => c.status);
      assert.strictEqual(statuses[0], "complete");
      assert.strictEqual(statuses[1], "pending");
    } finally {
      board.dispose();
    }
  });

  test("provider setCardDensity affects snapshot", async () => {
    const state = memoryState();
    const repo = makeRepository(allTodos);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state);
    try {
      await board.handleCanvasMessage({ type: "setCardDensity", density: "compact" });
      const snapshot = board.getSnapshot();
      assert.strictEqual(snapshot.cardDensity, "compact");
    } finally {
      board.dispose();
    }
  });

  test("provider setWipLimit affects snapshot", async () => {
    const state = memoryState();
    const repo = makeRepository(allTodos);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state);
    try {
      await board.handleCanvasMessage({ type: "setWipLimit", status: "pending", limit: 3 });
      const snapshot = board.getSnapshot();
      const pendingColumn = snapshot.columns.find((c) => c.status === "pending");
      assert.ok(pendingColumn);
      assert.strictEqual(pendingColumn.wipLimit, 3);
    } finally {
      board.dispose();
    }
  });

  test("provider resetBoardSettings clears preferences", async () => {
    const state = memoryState();
    const repo = makeRepository(allTodos);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state);
    try {
      await board.handleCanvasMessage({ type: "setBoardSort", sort: "priority" });
      await board.handleCanvasMessage({ type: "setCardDensity", density: "compact" });
      await board.handleCanvasMessage({ type: "hideStatus", status: "cancelled" });
      await board.handleCanvasMessage({ type: "resetBoardSettings" });
      const snapshot = board.getSnapshot();
      assert.strictEqual(snapshot.sort, "default");
      assert.strictEqual(snapshot.cardDensity, "comfortable");
      assert.strictEqual(snapshot.hiddenStatuses.length, 0);
    } finally {
      board.dispose();
    }
  });

  test("both native and HTTP board documents contain identical shared features", async () => {
    const state = memoryState();
    const repo = makeRepository(allTodos);
    const filter = new FilterService(memoryState());
    const status = {} as unknown as StatusService;
    const board = new BoardViewProvider(repo, filter, status, state);
    const originalPanel = vscode.window.createWebviewPanel;
    let nativeHtml = "";
    Object.defineProperty(vscode.window, "createWebviewPanel", {
      configurable: true,
      value: () => ({
        webview: {
          cspSource: "test",
          get html() {
            return nativeHtml;
          },
          set html(value: string) {
            nativeHtml = value;
          },
          postMessage: async () => true,
          onDidReceiveMessage: () => new vscode.Disposable(() => {}),
        },
        onDidDispose: () => new vscode.Disposable(() => {}),
        reveal: () => {},
        dispose: () => {},
      }),
    });
    try {
      board.open();
    } finally {
      board.dispose();
      Object.defineProperty(vscode.window, "createWebviewPanel", {
        configurable: true,
        value: originalPanel,
      });
    }

    const mod = await importBoard(
      pathToFileURL(path.join(path.dirname(BOARD_HTML_PATH), "board.mjs")).href,
    );
    const nav = {
      recent: [
        {
          kind: "board",
          scope: "todos",
          title: "Todos Board",
          current: true,
        },
      ],
      canBack: false,
      canForward: false,
      returnTo: undefined,
    };
    const httpHtml = mod.renderBoardCanvas("todos", nav, "nonce", "script-src 'nonce-nonce';");

    const sharedFeatureStrings = [
      "workSession.disabled = Boolean(todo.collision)",
      "columnElement.parentElement.children",
      'host.postMessage({ type: "openCanvas"',
      'host.postMessage({ type: "setStatus"',
      'host.postMessage({ type: "hideStatus"',
      'host.postMessage({ type: "reorderStatuses"',
      'host.postMessage({ type: "ready" })',
      'host.postMessage({ type: "open"',
      'host.postMessage({ type: "delete"',
      'host.postMessage({ type: "focusCollision"',
      'host.postMessage({ type: "resetBoardSettings" })',
      "setBoardSort",
      "setCardDensity",
      "setTerminalCardLimit",
      "setHideEmptyColumns",
      "applyPreset",
      "host.onMessage(",
      ".board.source-sections { display: block",
      "accent-priority-p1",
      "accent-status-complete",
      "card-busy",
    ];
    for (const feature of sharedFeatureStrings) {
      assert.ok(nativeHtml.includes(feature), `Native HTML missing shared feature: ${feature}`);
      assert.ok(httpHtml.includes(feature), `HTTP HTML missing shared feature: ${feature}`);
    }

    const nativeScript = extractScript(nativeHtml);
    const httpScript = extractScript(httpHtml);
    assert.doesNotThrow(() => new Script(nativeScript));
    assert.doesNotThrow(() => new Script(httpScript));
  });

  test("shared browser script renders snapshots and emits actions through a non-VS-Code host", () => {
    class Element {
      children: Element[] = [];
      parentElement?: Element;
      textContent = "";
      className = "";
      dataset: Record<string, string> = {};
      attributes = new Map<string, string>();
      listeners = new Map<string, () => void>();
      style = { setProperty: () => {} };
      classList = { add: () => {}, remove: () => {}, toggle: () => {} };
      append(...elements: Element[]) {
        for (const element of elements) {
          element.parentElement = this;
          this.children.push(element);
        }
      }
      replaceChildren(...elements: Element[]) {
        this.children = [];
        this.append(...elements);
      }
      setAttribute(key: string, value: string) {
        this.attributes.set(key, value);
      }
      addEventListener(event: string, listener: () => void) {
        this.listeners.set(event, listener);
      }
    }
    const elements = { toolbar: new Element(), settings: new Element(), board: new Element() };
    const walk = (element: Element): Element[] => [element, ...element.children.flatMap(walk)];
    const sent: unknown[] = [];
    let receive!: (message: unknown) => void;
    let state: unknown = {};
    const host = {
      postMessage: (message: unknown) => sent.push(message),
      onMessage: (listener: (message: unknown) => void) => {
        receive = listener;
      },
      getState: () => state,
      setState: (value: unknown) => {
        state = value;
      },
    };
    const script = extractScript(readFileSync(BOARD_HTML_PATH, "utf8")).replace(
      "__AGENDO_BOARD_HOST__",
      "",
    );
    new Script(script).runInNewContext({
      globalThis: { agendoBoardHost: host },
      document: {
        getElementById: (id: keyof typeof elements) => elements[id],
        createElement: () => new Element(),
      },
    });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(sent)), [{ type: "ready" }]);
    const provider = new BoardViewProvider(
      makeRepository(allTodos),
      new FilterService(memoryState()),
      {} as StatusService,
      memoryState(),
    );
    const scanning = new BoardViewProvider(
      makeRepository(allTodos),
      new FilterService(memoryState()),
      {} as StatusService,
      memoryState(),
      "code-scanning",
    );
    try {
      receive({ type: "snapshot", snapshot: provider.getSnapshot() });
      assert.strictEqual(elements.board.children.length, 6);
      assert.ok(walk(elements.board).some((element) => element.textContent === "Example 001"));
      const action = walk(elements.board).find((element) => element.textContent === "Work session");
      assert.ok(action);
      action.listeners.get("click")?.();
      assert.deepStrictEqual(JSON.parse(JSON.stringify(sent[sent.length - 1])), {
        type: "openCanvas",
        todoId: "001",
      });
      const toggle = elements.toolbar.children.find(
        (element) => element.textContent === "Card settings",
      );
      assert.ok(toggle);
      toggle.listeners.get("click")?.();
      assert.deepStrictEqual(JSON.parse(JSON.stringify(state)), { settingsOpen: true });
      receive({ type: "snapshot", snapshot: scanning.getSnapshot() });
      assert.strictEqual(elements.board.children.length, 2);
      assert.ok(walk(elements.board).some((element) => element.textContent === "CodeQL"));
      assert.ok(walk(elements.board).some((element) => element.textContent === "SonarQube"));
    } finally {
      provider.dispose();
      scanning.dispose();
    }
  });

  test("HTTP board actions retain metadata labels and individual card-field visibility", async () => {
    const board = new BoardViewProvider(
      makeRepository(allTodos),
      new FilterService(memoryState()),
      {} as StatusService,
      memoryState(),
    );
    try {
      await board.handleCanvasMessage({ type: "setMetadataLabels", enabled: true });
      await board.handleCanvasMessage({
        type: "setCardFieldVisibility",
        field: "tags",
        visible: false,
      });
      const snapshot = board.getSnapshot();
      assert.strictEqual(snapshot.showMetadataLabels, true);
      assert.strictEqual(
        snapshot.cardFields.find((preference) => preference.field === "tags")?.visible,
        false,
      );
    } finally {
      board.dispose();
    }
  });

  test("board deletion is confirmed by the native host rather than an iframe browser dialog", async () => {
    let deleted = 0;
    let choice: string | undefined;
    const original = Object.getOwnPropertyDescriptor(vscode.window, "showWarningMessage");
    Object.defineProperty(vscode.window, "showWarningMessage", {
      configurable: true,
      value: async () => choice,
    });
    const board = new BoardViewProvider(
      makeRepository(allTodos),
      new FilterService(memoryState()),
      {
        deleteTodo: async () => {
          deleted++;
        },
      } as unknown as StatusService,
      memoryState(),
    );
    try {
      await board.handleCanvasMessage({ type: "delete", todoId: "001" });
      assert.strictEqual(deleted, 0);
      choice = "Delete";
      await board.handleCanvasMessage({ type: "delete", todoId: "001" });
      assert.strictEqual(deleted, 1);
      assert.doesNotMatch(readFileSync(BOARD_HTML_PATH, "utf8"), /\bconfirm\(/);
    } finally {
      board.dispose();
      if (original) Object.defineProperty(vscode.window, "showWarningMessage", original);
    }
  });
});
