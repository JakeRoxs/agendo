import * as assert from "assert";
import * as vscode from "vscode";
import {
    buildFileName,
    isTodoFileName,
    parseFrontmatter,
    parseTodo,
    splitFrontmatter,
} from "../todos/todoModel";

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
            "060-backlogged-p3-my-todo.md"
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
        assert.strictEqual(todo!.id, "060");
        assert.strictEqual(todo!.status, "ready");
        assert.strictEqual(todo!.priority, "p2");
        assert.strictEqual(todo!.title, "Do The Thing");
        assert.deepStrictEqual(todo!.tags, ["alpha"]);
    });
});
