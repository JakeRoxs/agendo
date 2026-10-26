import * as assert from "node:assert";
import * as vscode from "vscode";
import { createCanvasHostActions } from "../todos/canvasHostActions";
import type { Todo } from "../todos/todoModel";

suite("canvasHostActions", () => {
  const restores: Array<() => void> = [];

  function mock(target: object, key: string, value: unknown): void {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { configurable: true, value });
    restores.push(() => {
      if (descriptor) {
        Object.defineProperty(target, key, descriptor);
      }
    });
  }

  teardown(() => {
    for (const restore of restores.reverse()) {
      restore();
    }
    restores.length = 0;
  });

  function makeTodo(id: string, overrides: Partial<Todo> = {}): Todo {
    const uri = vscode.Uri.file(`/tmp/${id}.md`);
    return {
      id,
      status: "pending",
      priority: "p3",
      title: `Title ${id}`,
      description: `desc-${id}`,
      tags: [],
      dependencies: [],
      children: [],
      epic: false,
      folder: "",
      fileName: `${id}-pending-p3-desc-${id}.md`,
      uri,
      frontmatter: {},
      ...overrides,
    };
  }

  function makeRepository(todos: Todo[]) {
    const refreshCalls: Array<void> = [];
    return {
      getTodos: () => todos,
      refresh: async () => {
        refreshCalls.push(undefined);
      },
      refreshCalls,
    };
  }

  function makeStatusService() {
    const setStatusCalls: Array<{ todo: Todo; newStatus: string }> = [];
    const setPriorityCalls: Array<{ todo: Todo; newPriority: string }> = [];
    const setGroupCalls: Array<{ todo: Todo; newGroup: string | undefined }> = [];
    return {
      setStatus: async (todo: Todo, newStatus: string) => {
        setStatusCalls.push({ todo, newStatus });
        return todo.uri;
      },
      setPriority: async (todo: Todo, newPriority: string) => {
        setPriorityCalls.push({ todo, newPriority });
        return todo.uri;
      },
      setGroup: async (todo: Todo, newGroup: string | undefined) => {
        setGroupCalls.push({ todo, newGroup });
        return todo.uri;
      },
      setStatusCalls,
      setPriorityCalls,
      setGroupCalls,
    };
  }

  function makeLinkService() {
    const warnCalls: Array<{ oldName: string; newUri: vscode.Uri }> = [];
    return {
      warnOnBrokenReferences: async (oldName: string, newUri: vscode.Uri) => {
        warnCalls.push({ oldName, newUri });
      },
      warnCalls,
    };
  }

  function createActions(todos: Todo[], links?: ReturnType<typeof makeLinkService>) {
    const repo = makeRepository(todos);
    const status = makeStatusService();
    const actions = createCanvasHostActions({
      repository: repo as never,
      status: status as never,
      links: links as never,
    });
    return { actions, repo, status };
  }

  setup(() => {
    mock(vscode.workspace, "isTrusted", true);
    mock(vscode.workspace, "textDocuments", []);
  });

  test("setStatus on trusted workspace routes to StatusService", async () => {
    const todo = makeTodo("001");
    const { actions, status, repo } = createActions([todo]);

    await actions.setStatus("001", "ready");

    assert.strictEqual(status.setStatusCalls.length, 1);
    assert.strictEqual(status.setStatusCalls[0].newStatus, "ready");
    assert.strictEqual(repo.refreshCalls.length, 2);
  });

  test("setPriority on trusted workspace routes to StatusService", async () => {
    const todo = makeTodo("002");
    const { actions, status, repo } = createActions([todo]);

    await actions.setPriority("002", "p1");

    assert.strictEqual(status.setPriorityCalls.length, 1);
    assert.strictEqual(status.setPriorityCalls[0].newPriority, "p1");
    assert.strictEqual(repo.refreshCalls.length, 2);
  });

  test("setGroup on trusted workspace routes to StatusService", async () => {
    const todo = makeTodo("003");
    const { actions, status, repo } = createActions([todo]);

    await actions.setGroup("003", "my-group");

    assert.strictEqual(status.setGroupCalls.length, 1);
    assert.strictEqual(status.setGroupCalls[0].newGroup, "my-group");
    assert.strictEqual(repo.refreshCalls.length, 2);
  });

  test("untrusted workspace rejects all operations", async () => {
    const todo = makeTodo("004");
    const { actions } = createActions([todo]);
    mock(vscode.workspace, "isTrusted", false);

    await assert.rejects(() => actions.setStatus("004", "ready"), /trusted/i);
    await assert.rejects(() => actions.setPriority("004", "p1"), /trusted/i);
    await assert.rejects(() => actions.setGroup("004", "group"), /trusted/i);
    await assert.rejects(() => actions.assertWritable("004"), /trusted/i);
  });

  test("missing todo is rejected", async () => {
    const { actions } = createActions([]);
    await assert.rejects(() => actions.setStatus("999", "ready"), /not found/i);
    await assert.rejects(() => actions.setPriority("999", "p1"), /not found/i);
    await assert.rejects(() => actions.setGroup("999", "group"), /not found/i);
    await assert.rejects(() => actions.assertWritable("999"), /not found/i);
  });

  test("invalid ID format is rejected", async () => {
    const todo = makeTodo("001");
    const { actions } = createActions([todo]);
    await assert.rejects(() => actions.setStatus("1", "ready"), /invalid/i);
    await assert.rejects(() => actions.setStatus("abc", "ready"), /invalid/i);
  });

  test("invalid status is rejected", async () => {
    const todo = makeTodo("005");
    const { actions, status } = createActions([todo]);
    await assert.rejects(() => actions.setStatus("005", "unknown"), /invalid status/i);
    assert.strictEqual(status.setStatusCalls.length, 0);
  });

  test("invalid priority is rejected", async () => {
    const todo = makeTodo("006");
    const { actions, status } = createActions([todo]);
    await assert.rejects(() => actions.setPriority("006", "p9"), /invalid priority/i);
    assert.strictEqual(status.setPriorityCalls.length, 0);
  });

  test("invalid group types are rejected", async () => {
    const todo = makeTodo("007");
    const { actions, status } = createActions([todo]);
    await assert.rejects(() => actions.setGroup("007", 123), /must be a string/i);
    assert.strictEqual(status.setGroupCalls.length, 0);
  });

  test("multi-line group is rejected", async () => {
    const todo = makeTodo("008");
    const { actions } = createActions([todo]);
    await assert.rejects(() => actions.setGroup("008", "line1\nline2"), /single line/i);
  });

  test("oversized group is rejected", async () => {
    const todo = makeTodo("009");
    const { actions } = createActions([todo]);
    await assert.rejects(() => actions.setGroup("009", "x".repeat(201)), /at most 200/i);
  });

  test("empty group clears the group field", async () => {
    const todo = makeTodo("010", { group: "existing" });
    const { actions, status } = createActions([todo]);

    await actions.setGroup("010", "");

    assert.strictEqual(status.setGroupCalls.length, 1);
    assert.strictEqual(status.setGroupCalls[0].newGroup, undefined);
  });

  test("whitespace-only group is treated as clear", async () => {
    const todo = makeTodo("011", { group: "existing" });
    const { actions, status } = createActions([todo]);

    await actions.setGroup("011", "   ");

    assert.strictEqual(status.setGroupCalls.length, 1);
    assert.strictEqual(status.setGroupCalls[0].newGroup, undefined);
  });

  test("dirty document blocks writes", async () => {
    const todo = makeTodo("012");
    const dirtyDoc = { uri: todo.uri, isDirty: true };
    mock(vscode.workspace, "textDocuments", [dirtyDoc as never]);
    const { actions, status } = createActions([todo]);

    await assert.rejects(() => actions.setStatus("012", "ready"), /unsaved changes/i);
    assert.strictEqual(status.setStatusCalls.length, 0);
  });

  test("dirty document does not block clean documents", async () => {
    const todo = makeTodo("013");
    const otherDoc = { uri: vscode.Uri.file("/tmp/other.md"), isDirty: true };
    mock(vscode.workspace, "textDocuments", [otherDoc as never]);
    const { actions, status } = createActions([todo]);

    await actions.setStatus("013", "ready");
    assert.strictEqual(status.setStatusCalls.length, 1);
  });

  test("duplicate todo IDs are rejected as ambiguous", async () => {
    const todoA = makeTodo("014", { uri: vscode.Uri.file("/tmp/a.md") });
    const todoB = makeTodo("014", { uri: vscode.Uri.file("/tmp/b.md") });
    const { actions } = createActions([todoA, todoB]);

    await assert.rejects(() => actions.setStatus("014", "ready"), /ambiguous/i);
  });

  test("scanning todo IDs with prefix are accepted", async () => {
    const todo = makeTodo("cql-001");
    const { actions, status } = createActions([todo]);

    await actions.setStatus("cql-001", "complete");
    assert.strictEqual(status.setStatusCalls.length, 1);
  });

  test("link warnings are called when a todo is moved", async () => {
    const todo = makeTodo("015");
    const links = makeLinkService();
    const repo = makeRepository([todo]);
    const status = makeStatusService();
    const actions = createCanvasHostActions({
      repository: repo as never,
      status: status as never,
      links: links as never,
    });

    await actions.setStatus("015", "complete");

    assert.strictEqual(links.warnCalls.length, 1);
    assert.strictEqual(links.warnCalls[0].oldName, todo.fileName);
  });

  test("refresh is called before and after write operations", async () => {
    const todo = makeTodo("016");
    const { actions, repo } = createActions([todo]);

    await actions.setStatus("016", "ready");

    assert.strictEqual(repo.refreshCalls.length, 2);
  });

  test("refresh happens even when write fails", async () => {
    const todo = makeTodo("017");
    const repo = makeRepository([todo]);
    const status = makeStatusService();
    const failingStatus = {
      ...status,
      setStatus: async () => {
        throw new Error("write failed");
      },
    };
    const actions = createCanvasHostActions({
      repository: repo as never,
      status: failingStatus as never,
    });

    await assert.rejects(() => actions.setStatus("017", "ready"), /write failed/i);
    assert.strictEqual(repo.refreshCalls.length, 2);
  });

  test("assertWritable succeeds for clean todos", async () => {
    const todo = makeTodo("018");
    const { actions } = createActions([todo]);

    await actions.assertWritable("018");
  });

  test("assertWritable rejects for dirty todos", async () => {
    const todo = makeTodo("019");
    const dirtyDoc = { uri: todo.uri, isDirty: true };
    mock(vscode.workspace, "textDocuments", [dirtyDoc as never]);
    const { actions } = createActions([todo]);

    await assert.rejects(() => actions.assertWritable("019"), /unsaved changes/i);
  });
});
