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

  test("ignores empty tags array (no tag filter applied)", () => {
    const todos = [makeTodo("001", "completed", Date.now(), undefined, [])];
    const packet = buildAccomplishmentsPacket(todos, { tags: [] });
    assert.strictEqual(packet.matched, 1);
    assert.strictEqual(packet.included.length, 1);
  });

  test("requires all tags when multiple tags are requested", () => {
    const todos = [
      makeTodo("001", "completed", Date.now(), undefined, ["bug", "critical"]),
      makeTodo("002", "completed", Date.now(), undefined, ["bug"]),
    ];
    const packet = buildAccomplishmentsPacket(todos, { tags: ["bug", "critical"] });
    assert.strictEqual(packet.matched, 1);
    assert.strictEqual(packet.included[0].id, "001");
  });

  test("filters by sonarqube source only", () => {
    const todos = [
      makeTodo("cql-001", "completed", Date.now()),
      makeTodo("sq-001", "completed", Date.now()),
      makeTodo("001", "completed", Date.now()),
    ];
    const packet = buildAccomplishmentsPacket(todos, { source: "sonarqube" });
    assert.strictEqual(packet.matched, 1);
    assert.strictEqual(packet.included[0].id, "sq-001");
  });

  test("sorts by completion date descending then id for determinism", () => {
    const now = Date.now();
    const todos = [
      makeTodo("002", "completed", now - 1000),
      makeTodo("001", "completed", now),
      makeTodo("003", "completed", now - 1000),
    ];
    const packet = buildAccomplishmentsPacket(todos, {});
    assert.strictEqual(packet.included[0].id, "001");
    assert.strictEqual(packet.included[1].id, "002");
    assert.strictEqual(packet.included[2].id, "003");
  });

  test("omits todos beyond max count", () => {
    const todos = Array.from({ length: 30 }, (_, i) =>
      makeTodo(String(i + 1).padStart(3, "0"), "completed", Date.now()),
    );
    const packet = buildAccomplishmentsPacket(todos, {});
    assert.strictEqual(packet.matched, 30);
    assert.strictEqual(packet.included.length, 25);
    assert.strictEqual(packet.omittedCount, 5);
  });

  test("preserves date boundaries and filter header ordering", () => {
    const date = "2026-10-27";
    const todo = makeTodo("sq-001", "completed", Date.parse(date), "reports", ["bug"]);
    const packet = buildAccomplishmentsPacket([todo, makeTodo("sq-002", "completed")], {
      since: date,
      until: new Date(date),
      group: "reports",
      tags: ["bug"],
      source: "sonarqube",
    });
    assert.deepStrictEqual(packet.included, [todo]);
    assert.ok(
      packet.text.includes(
        "Matched: 1 completed todos\nIncluded: 1 todos in this packet\n" +
          "Filter: since 2026-10-27\nFilter: until 2026-10-27\n" +
          "Filter: group reports\nFilter: tags bug\nFilter: source sonarqube\n\n",
      ),
    );
  });

  test("skips oversized outcomes while retaining later smaller todos", () => {
    const oversized = { ...makeTodo("001", "completed"), summary: "x".repeat(50_000) };
    const small = makeTodo("002", "completed");
    const packet = buildAccomplishmentsPacket([oversized, small], {});
    assert.deepStrictEqual(packet.included, [small]);
    assert.strictEqual(packet.omittedCount, 1);
    assert.ok(packet.text.includes("Omitted: 1 todos due to size/limits (not included)"));
  });

  test("excludes cancelled, backlogged, pending, and unfinished todos by default", () => {
    const todos = [
      makeTodo("001", "completed", Date.now()),
      makeTodo("002", "cancelled", Date.now()),
      makeTodo("003", "backlogged", Date.now()),
      makeTodo("004", "pending", Date.now()),
      makeTodo("005", "in-progress", Date.now()),
      makeTodo("006", "ready", Date.now()),
    ];
    const packet = buildAccomplishmentsPacket(todos, {});
    assert.strictEqual(packet.matched, 1);
    assert.strictEqual(packet.included.length, 1);
    assert.strictEqual(packet.included[0].id, "001");
    assert.ok(!packet.text.includes("002"));
    assert.ok(!packet.text.includes("003"));
    assert.ok(!packet.text.includes("004"));
    assert.ok(!packet.text.includes("005"));
    assert.ok(!packet.text.includes("006"));
  });

  test("treats since and until as inclusive date boundaries", () => {
    const day = Date.parse("2026-10-27T00:00:00Z");
    const todos = [
      makeTodo("001", "completed", day),
      makeTodo("002", "completed", day + 86400000), // 2026-10-28
      makeTodo("003", "completed", day - 86400000), // 2026-10-26
    ];
    const packet = buildAccomplishmentsPacket(todos, {
      since: "2026-10-27",
      until: "2026-10-27",
    });
    assert.strictEqual(packet.matched, 1);
    assert.strictEqual(packet.included[0].id, "001");
  });

  test("reports undated records as undated", () => {
    const todos = [makeTodo("001", "completed", undefined)];
    const packet = buildAccomplishmentsPacket(todos, {});
    assert.ok(packet.text.includes("undated"));
    assert.ok(packet.text.includes("001"));
  });

  test("includes source path and link coverage for each included todo", () => {
    const todos = [makeTodo("sq-001", "completed", Date.now())];
    const packet = buildAccomplishmentsPacket(todos, {});
    assert.ok(packet.text.includes("sq-001"));
    assert.ok(packet.text.includes("/fake/sq-001.md"));
    assert.ok(packet.text.includes("Source:"));
    assert.ok(packet.text.includes("untrusted evidence"));
  });

  test("produces deterministic batches for same-date todos", () => {
    const now = Date.now();
    const todos = [
      makeTodo("003", "completed", now),
      makeTodo("001", "completed", now),
      makeTodo("002", "completed", now),
    ];
    const packet = buildAccomplishmentsPacket(todos, {});
    assert.deepStrictEqual(packet.included.map((t) => t.id), ["001", "002", "003"]);
    // Re-running yields identical order.
    const packet2 = buildAccomplishmentsPacket(todos, {});
    assert.deepStrictEqual(packet2.included.map((t) => t.id), ["001", "002", "003"]);
  });

  test("applies size limit and reports omitted count for large selections", () => {
    const todos = Array.from({ length: 40 }, (_, i) =>
      makeTodo(String(i + 1).padStart(3, "0"), "completed", Date.now()),
    );
    const packet = buildAccomplishmentsPacket(todos, {});
    assert.strictEqual(packet.matched, 40);
    assert.strictEqual(packet.included.length, 25);
    assert.strictEqual(packet.omittedCount, 15);
    assert.ok(packet.text.includes("Omitted: 15 todos due to size/limits (not included)"));
  });

  test("header reports matched, included, and omitted counts", () => {
    const todos = [
      makeTodo("001", "completed", Date.now()),
      makeTodo("002", "completed", Date.now()),
      makeTodo("003", "pending", Date.now()),
    ];
    const packet = buildAccomplishmentsPacket(todos, {});
    assert.ok(packet.text.includes("Matched: 2 completed todos"));
    assert.ok(packet.text.includes("Included: 2 todos in this packet"));
    assert.ok(!packet.text.includes("Omitted"));
  });

  test("omitted count appears when size limit truncates selection", () => {
    const todos = Array.from({ length: 30 }, (_, i) =>
      makeTodo(String(i + 1).padStart(3, "0"), "completed", Date.now()),
    );
    const packet = buildAccomplishmentsPacket(todos, {});
    assert.ok(packet.text.includes("Omitted: 5 todos due to size/limits (not included)"));
  });
});
