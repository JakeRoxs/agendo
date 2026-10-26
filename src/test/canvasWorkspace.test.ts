import * as assert from "node:assert";
import * as fs from "node:fs";
import type { Server } from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import * as vscode from "vscode";
import { ConfigService } from "../todos/configService";
import { StatusService } from "../todos/statusService";
import { parseTodo } from "../todos/todoModel";
import { boardReturnTarget } from "../todos/workspaceNavigation";

const importModule = new Function("url", "return import(url)") as (url: string) => Promise<any>;

suite("Shared workspace host boundary", () => {
  let root: string;
  let module: any;
  const servers: Server[] = [];
  const todoFile = () => path.join(root, "docs", "todos", "001-pending-p2-first.md");

  setup(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "agendo-workspace-"));
    const dir = path.dirname(todoFile());
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      todoFile(),
      "---\nstatus: pending\npriority: p2\ngroup: team\n---\n# First\n\n## Acceptance Criteria\n\n- [ ] Done\n",
    );
    fs.writeFileSync(
      path.join(dir, "002-ready-p1-second.md"),
      "---\nstatus: ready\npriority: p1\ngroup: team\n---\n# Second\n",
    );
    module = await importModule(
      pathToFileURL(
        path.resolve(__dirname, "../../resources/canvas/agendo-work-session/server.mjs"),
      ).href,
    );
  });
  teardown(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeAllConnections();
          }),
      ),
    );
    fs.rmSync(root, { recursive: true, force: true });
  });

  async function start(actions = {}) {
    const entry = module.createInstanceServer(root, actions);
    await module.listen(entry);
    servers.push(entry.server);
    module.navigate(entry, "001");
    return entry;
  }

  async function post(entry: any, route: string, body: unknown, guarded = true) {
    return fetch(new URL(route, entry.url), {
      method: "POST",
      headers: guarded ? { "X-Agendo-Canvas": "1" } : {},
      body: JSON.stringify(body),
    });
  }

  test("typed todo/group navigation supports back, forward and recent views without fake todo IDs", async () => {
    const entry = await start();
    assert.strictEqual(
      (await post(entry, "/open", { view: { kind: "group", groupName: "team" } })).status,
      200,
    );
    assert.deepStrictEqual(entry.view, { kind: "group", groupName: "team" });
    assert.strictEqual(entry.todoId, undefined);
    assert.strictEqual((await post(entry, "/open", { todoId: "002" })).status, 200);
    assert.strictEqual((await post(entry, "/nav", { direction: "back" })).status, 200);
    assert.strictEqual(entry.groupName, "team");
    let html = await (await fetch(entry.url)).text();
    assert.match(html, /Group: team/);
    assert.doesNotMatch(html, /data-edit/);
    await post(entry, "/nav", { direction: "back" });
    assert.strictEqual(entry.todoId, "001");
    assert.strictEqual(entry.groupName, undefined);
    await post(entry, "/nav", { direction: "forward" });
    assert.strictEqual(entry.groupName, "team");
    await post(entry, "/open", { todoId: "001" });
    html = await (await fetch(entry.url)).text();
    assert.match(html, /data-open-group="team"/);
    assert.strictEqual(entry.history.length, 3);
    assert.strictEqual((await post(entry, "/nav", { direction: "forward" })).status, 400);
    assert.strictEqual((await post(entry, "/open", { todoId: "group:team" })).status, 400);
  });

  test("board return is capability-checked and uses host-owned scope, not caller payload", async () => {
    const scopes: string[] = [];
    const entry = await start({
      returnToBoard: async (scope: string) => {
        scopes.push(scope);
      },
    });
    module.navigate(entry, "001", { kind: "board", scope: "code-scanning" });
    const html = await (await fetch(entry.url)).text();
    assert.match(html, /Return to Code Scanning Board/);
    assert.strictEqual((await post(entry, "/return-board", { scope: "todos" }, false)).status, 403);
    assert.strictEqual((await post(entry, "/return-board", { scope: "todos" })).status, 200);
    assert.deepStrictEqual(scopes, ["code-scanning"]);
    assert.strictEqual(entry.todoId, "001");
    module.navigate(entry, "001", null);
    assert.doesNotMatch(await (await fetch(entry.url)).text(), /data-return-board/);
  });

  test("standalone host retains todo access without inventing VS Code board capabilities", async () => {
    const entry = await start();
    module.navigate(entry, "001", { kind: "board", scope: "todos" });
    const html = await (await fetch(entry.url)).text();
    assert.match(html, /First/);
    assert.doesNotMatch(html, /data-return-board/);
    assert.strictEqual((await post(entry, "/return-board", {})).status, 400);
  });

  test("native lifecycle operations replace, rather than accompany, direct server file writes", async () => {
    const calls: unknown[] = [];
    const original = fs.readFileSync(todoFile(), "utf8");
    const entry = await start({
      setStatus: async (id: string, value: unknown) => {
        calls.push(["status", id, value]);
      },
      setPriority: async (id: string, value: unknown) => {
        calls.push(["priority", id, value]);
      },
      setGroup: async (id: string, value: unknown) => {
        calls.push(["group", id, value]);
      },
    });
    for (const [route, body] of [
      ["/status", { status: "completed" }],
      ["/priority", { priority: "p1" }],
      ["/group", { group: "other" }],
    ] as const) {
      assert.strictEqual((await post(entry, route, body)).status, 200);
    }
    assert.deepStrictEqual(calls, [
      ["status", "001", "completed"],
      ["priority", "001", "p1"],
      ["group", "001", "other"],
    ]);
    assert.strictEqual(fs.readFileSync(todoFile(), "utf8"), original);
  });

  test("native guard refusal prevents checklist and lifecycle fallback writes", async () => {
    const entry = await start({
      assertWritable: async () => {
        throw new Error("Unsaved editor changes");
      },
      setStatus: async () => {
        throw new Error("Workspace untrusted");
      },
    });
    assert.strictEqual((await post(entry, "/toggle", { index: 0, met: true })).status, 500);
    assert.strictEqual((await post(entry, "/status", { status: "completed" })).status, 500);
    assert.match(fs.readFileSync(todoFile(), "utf8"), /- \[ \] Done/);
    assert.strictEqual((await post(entry, "/open", null)).status, 400);
  });

  test("board return target contract rejects arbitrary commands and scopes", () => {
    assert.deepStrictEqual(
      boardReturnTarget({ kind: "board", scope: "todos", command: "anything" }),
      { kind: "board", scope: "todos" },
    );
    assert.strictEqual(boardReturnTarget({ kind: "board", scope: "unknown" }), undefined);
    assert.strictEqual(boardReturnTarget({ kind: "todo", todoId: "001" }), undefined);
  });

  test("explicit canvas navigation forwards return context without changing the normal view preference", async () => {
    const config = new ConfigService();
    const previous = config.viewMode;
    const opened: unknown[] = [];
    config.setCanvasOpener(async (uri, returnTo) => {
      opened.push([uri.toString(), returnTo]);
      return true;
    });
    const uri = vscode.Uri.file(todoFile());
    await config.openInCanvas(uri, { kind: "board", scope: "todos" });
    assert.deepStrictEqual(opened, [[uri.toString(), { kind: "board", scope: "todos" }]]);
    assert.strictEqual(config.viewMode, previous);
  });

  test("native group updates preserve special characters and create missing frontmatter", async () => {
    fs.writeFileSync(todoFile(), "# First\n");
    const uri = vscode.Uri.file(todoFile());
    const todo = parseTodo(uri, "# First\n", "");
    assert.ok(todo);
    const service = new StatusService({
      getRootUri: () => vscode.Uri.file(path.dirname(todoFile())),
    } as never);
    await service.setGroup(todo, "team: shared #1");
    const parsed = parseTodo(uri, fs.readFileSync(todoFile(), "utf8"), "");
    assert.strictEqual(parsed?.group, "team: shared #1");
  });

  test("a navigation request cannot retarget a checklist write while its native guard is pending", async () => {
    let entered!: () => void;
    const guardEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let release!: () => void;
    const allowed = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entry = await start({
      assertWritable: async (id: string) => {
        assert.strictEqual(id, "001");
        entered();
        await allowed;
      },
    });
    const toggle = post(entry, "/toggle", { index: 0, met: true });
    await guardEntered;
    await post(entry, "/open", { todoId: "002" });
    release();
    assert.strictEqual((await toggle).status, 200);
    assert.match(fs.readFileSync(todoFile(), "utf8"), /- \[x\] Done/);
    assert.strictEqual(entry.todoId, "002");
  });

  test("shared board/todo/group round trips keep board scopes and dispatch host-owned actions", async () => {
    const calls: unknown[] = [];
    const entry = await start({
      getBoardSnapshot: async (scope: string) => ({ scope, columns: [], hiddenStatuses: [] }),
      handleBoardMessage: async (scope: string, message: unknown) => {
        calls.push([scope, message]);
      },
    });
    module.navigate(entry, "001", { kind: "board", scope: "code-scanning" });
    assert.strictEqual((await post(entry, "/return-board", {})).status, 200);
    assert.deepStrictEqual(entry.view, { kind: "board", scope: "code-scanning" });
    const response = await fetch(entry.url);
    const html = await response.text();
    assert.match(html, /id="board"/);
    assert.doesNotMatch(html, /acquireVsCodeApi|__AGENDO_BOARD_/);
    const nonce = html.match(/<script nonce="([a-f0-9]+)"/);
    assert.ok(nonce);
    assert.match(
      response.headers.get("Content-Security-Policy") ?? "",
      new RegExp(`nonce-${nonce[1]}`),
    );
    assert.strictEqual(
      (
        (await (await fetch(new URL("/board-snapshot?scope=todos", entry.url))).json()) as {
          scope: string;
        }
      ).scope,
      "code-scanning",
    );
    assert.strictEqual(
      (
        await post(
          entry,
          "/board-message",
          { type: "setBoardSort", sort: "title", scope: "todos" },
          false,
        )
      ).status,
      403,
    );
    assert.strictEqual(
      (await post(entry, "/board-message", { type: "setBoardSort", sort: "title", scope: "todos" }))
        .status,
      200,
    );
    assert.deepStrictEqual(calls, [
      ["code-scanning", { type: "setBoardSort", sort: "title", scope: "todos" }],
    ]);
    await post(entry, "/open", { view: { kind: "group", groupName: "team" } });
    await post(entry, "/open", { todoId: "002" });
    const todoPage = await (await fetch(entry.url)).text();
    assert.match(todoPage, /data-open-board="code-scanning"/);
    await post(entry, "/nav", { direction: "back" });
    assert.strictEqual(entry.groupName, "team");
    await post(entry, "/nav", { direction: "back" });
    assert.deepStrictEqual(entry.view, { kind: "board", scope: "code-scanning" });
    await post(entry, "/open", { view: { kind: "board", scope: "todos" } });
    assert.strictEqual(
      ((await (await fetch(new URL("/board-snapshot", entry.url))).json()) as { scope: string })
        .scope,
      "todos",
    );
  });

  test("board capabilities require both snapshot and action support and are unavailable in standalone hosts", async () => {
    const entry = await start();
    assert.strictEqual(
      (await post(entry, "/open", { view: { kind: "board", scope: "todos" } })).status,
      400,
    );
    assert.strictEqual((await fetch(new URL("/board-snapshot", entry.url))).status, 400);
    assert.strictEqual((await post(entry, "/board-message", { type: "ready" })).status, 400);
    assert.strictEqual(entry.todoId, "001");
    const readonly = await start({ getBoardSnapshot: async () => ({ columns: [] }) });
    assert.strictEqual(
      (await post(readonly, "/open", { view: { kind: "board", scope: "todos" } })).status,
      400,
    );
    assert.strictEqual(
      (await post(entry, "/open", { view: { kind: "board", scope: "invalid" } })).status,
      400,
    );
  });

  test("group labels cannot substitute shared board template tokens or inject markup", async () => {
    const entry = await start({
      getBoardSnapshot: async () => ({ scope: "todos", columns: [] }),
      handleBoardMessage: async () => {},
    });
    await post(entry, "/open", {
      view: { kind: "group", groupName: "$&__AGENDO_BOARD_HOST__<unsafe>" },
    });
    await post(entry, "/open", { view: { kind: "board", scope: "todos" } });
    const html = await (await fetch(entry.url)).text();
    assert.match(html, /__AGENDO_BOARD_HOST__&lt;unsafe&gt;/);
    assert.doesNotMatch(html, /<unsafe>/);
    assert.strictEqual(html.match(/globalThis\.agendoBoardHost =/g)?.length, 1);
  });
});
