import * as assert from "node:assert";
import * as vscode from "vscode";
import { buildAccomplishmentsPacket } from "../todos/accomplishmentsService";
import type { Todo } from "../todos/todoModel";

function makeTodo(
  id: string,
  status: string,
  updatedAt?: number,
  group?: string,
  tags?: string[],
): Todo {
  return {
    id,
    status: status as Todo["status"],
    priority: "p2",
    title: `Test ${id}`,
    description: "test",
    tags: tags ?? [],
    dependencies: [],
    children: [],
    epic: false,
    group,
    folder: "",
    fileName: `${id}-completed-p2-test.md`,
    uri: vscode.Uri.file(`/fake/${id}.md`),
    updatedAt,
    createdAt: updatedAt ? updatedAt - 1000 : undefined,
    frontmatter: {},
    resumeContext: { currentState: "Completed successfully" },
  };
}

suite("Accomplishments Service", () => {
  test("builds packet from all completed todos", () => {
    const todos = [
      makeTodo("001", "completed", Date.now()),
      makeTodo("002", "completed", Date.now() - 1000),
      makeTodo("003", "pending"),
    ];
    const packet = buildAccomplishmentsPacket(todos, {});
    assert.strictEqual(packet.matched, 2);
    assert.strictEqual(packet.included.length, 2);
    assert.strictEqual(packet.omittedCount, 0);
    assert.ok(packet.text.includes("001"));
    assert.ok(packet.text.includes("002"));
    assert.ok(!packet.text.includes("003"));
  });

  test("filters by since date", () => {
    const now = Date.now();
    const todos = [
      makeTodo("001", "completed", now),
      makeTodo("002", "completed", now - 86400000), // 1 day ago
      makeTodo("003", "completed", now - 172800000), // 2 days ago
    ];
    const packet = buildAccomplishmentsPacket(todos, {
      since: new Date(now - 43200000), // 12 hours ago
    });
    assert.strictEqual(packet.matched, 1);
    assert.strictEqual(packet.included.length, 1);
    assert.strictEqual(packet.included[0].id, "001");
  });

  test("filters by until date", () => {
    const now = Date.now();
    const todos = [makeTodo("001", "completed", now), makeTodo("002", "completed", now - 86400000)];
    const packet = buildAccomplishmentsPacket(todos, {
      until: new Date(now - 43200000),
    });
    assert.strictEqual(packet.matched, 1);
    assert.strictEqual(packet.included[0].id, "002");
  });

  test("filters by group", () => {
    const todos = [
      makeTodo("001", "completed", Date.now(), "scanner-workflow"),
      makeTodo("002", "completed", Date.now(), "reporting"),
      makeTodo("003", "completed", Date.now(), "scanner-workflow"),
    ];
    const packet = buildAccomplishmentsPacket(todos, { group: "scanner-workflow" });
    assert.strictEqual(packet.matched, 2);
    assert.ok(packet.included.every((todo) => todo.group === "scanner-workflow"));
  });

  test("filters by tags", () => {
    const todos = [
      makeTodo("001", "completed", Date.now(), undefined, ["bug", "critical"]),
      makeTodo("002", "completed", Date.now(), undefined, ["bug"]),
      makeTodo("003", "completed", Date.now(), undefined, ["feature"]),
    ];
    const packet = buildAccomplishmentsPacket(todos, { tags: ["bug"] });
    assert.strictEqual(packet.matched, 2);
    assert.ok(packet.included.every((todo) => todo.tags.includes("bug")));
  });

  test("filters by scanner source", () => {
    const todos = [
      { ...makeTodo("cql-001", "completed", Date.now()), id: "cql-001", title: "CQL test" },
      { ...makeTodo("sq-001", "completed", Date.now()), id: "sq-001", title: "SQ test" },
      makeTodo("001", "completed", Date.now()),
    ];
    const packet = buildAccomplishmentsPacket(todos, { source: "codeql" });
    assert.strictEqual(packet.matched, 1);
    assert.strictEqual(packet.included[0].id, "cql-001");
  });

  test("handles empty todos", () => {
    const packet = buildAccomplishmentsPacket([], {});
    assert.strictEqual(packet.matched, 0);
    assert.strictEqual(packet.included.length, 0);
    assert.ok(packet.text.includes("No completed todos matched"));
  });

  test("includes filter info in packet text", () => {
    const todos = [makeTodo("001", "completed", Date.now(), "scanner-workflow")];
    const packet = buildAccomplishmentsPacket(todos, { group: "scanner-workflow" });
    assert.ok(packet.text.includes("Filter: group scanner-workflow"));
  });

  test("marks undated todos", () => {
    const todos = [makeTodo("001", "completed", undefined)];
    const packet = buildAccomplishmentsPacket(todos, {});
    assert.ok(packet.text.includes("undated"));
  });
});
