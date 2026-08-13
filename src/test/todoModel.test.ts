import * as assert from "node:assert";
import * as vscode from "vscode";
import {
  buildFileName,
  isTodoFileName,
  parseFrontmatter,
  parseTodo,
  splitFrontmatter,
} from "../todos/todoModel";
import { getTreeNodeKey } from "../todos/todoTreeProvider";

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
    assert.strictEqual(getTreeNodeKey({ kind: "todo", todo: undefined as never }), undefined);
  });
});
