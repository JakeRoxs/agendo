import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

const importModule = new Function("url", "return import(url)") as (url: string) => Promise<any>;

suite("Standalone canvas safety guards", () => {
  let root: string;
  let module: any;
  let todoFile: string;

  setup(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "agendo-canvas-safety-"));
    const dir = path.join(root, "docs", "todos");
    fs.mkdirSync(dir, { recursive: true });
    module = await importModule(
      pathToFileURL(path.resolve(__dirname, "../../resources/canvas/agendo-work-session/todos.mjs"))
        .href,
    );
    todoFile = path.join(dir, "001-pending-p2-first.md");
    fs.writeFileSync(
      todoFile,
      "---\nstatus: pending\npriority: p2\ngroup: team\ndependencies: []\n---\n# First\n\n## Acceptance Criteria\n\n- [ ] Done\n",
    );
  });

  teardown(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function writeTodo(
    id: string,
    status: string,
    priority: string,
    slug: string,
    content: string,
    subdir?: string,
  ) {
    const base = subdir ? path.join(root, subdir) : path.join(root, "docs", "todos");
    fs.mkdirSync(base, { recursive: true });
    const file = path.join(base, `${id}-${status}-${priority}-${slug}.md`);
    fs.writeFileSync(file, content);
    return file;
  }

  test("duplicate same-status files block ambiguous write", () => {
    writeTodo("002", "pending", "p2", "a", "# A\n");
    writeTodo("002", "pending", "p2", "b", "# B\n");
    assert.throws(
      () => module.setTodoPriority("002", "p1", root),
      (e: any) => e.code === "invalid_input" && /ambiguous/i.test(e.message),
    );
    // Neither file was modified
    assert.match(
      fs.readFileSync(path.join(root, "docs", "todos", "002-pending-p2-a.md"), "utf8"),
      /# A/,
    );
    assert.match(
      fs.readFileSync(path.join(root, "docs", "todos", "002-pending-p2-b.md"), "utf8"),
      /# B/,
    );
  });

  test("duplicate across folders block ambiguous write", () => {
    writeTodo("003", "pending", "p2", "main", "# Main\n");
    writeTodo("003", "completed", "p2", "main", "# Done\n", "docs/todos/completed");
    assert.throws(
      () => module.setTodoStatus("003", "ready", root),
      (e: any) => e.code === "invalid_input" && /ambiguous/i.test(e.message),
    );
  });

  test("dependency with duplicate terminal candidate is unsatisfied", () => {
    writeTodo("004", "pending", "p2", "dep-blocker-a", "# A\n");
    writeTodo("004", "completed", "p2", "dep-blocker-b", "# B\n", "docs/todos/completed");
    writeTodo("005", "pending", "p2", "dependent", "---\ndependencies: [004]\n---\n# Dependent\n");
    const relations = module.getRelations("005", root);
    assert.strictEqual(relations.blocked, true);
    const dep = relations.dependencies.find((d: any) => d.id === "004");
    assert.strictEqual(dep.satisfied, false);
    assert.strictEqual(dep.ambiguous, true);
  });

  test("setTodoStatus to ready rejects unresolved dependencies", () => {
    writeTodo("006", "pending", "p2", "blocker", "# Blocker\n");
    writeTodo("007", "pending", "p2", "dependent", "---\ndependencies: [006]\n---\n# Dependent\n");
    assert.throws(
      () => module.setTodoStatus("007", "ready", root),
      (e: any) => e.code === "invalid_input" && /unresolved dependencies/i.test(e.message),
    );
    // File still pending
    assert.ok(fs.existsSync(path.join(root, "docs", "todos", "007-pending-p2-dependent.md")));
  });

  test("cancelled dependency satisfies ready transition", () => {
    writeTodo(
      "008",
      "cancelled",
      "p2",
      "cancelled-blocker",
      "# Cancelled\n",
      "docs/todos/cancelled",
    );
    writeTodo("009", "pending", "p2", "dependent", "---\ndependencies: [008]\n---\n# Dependent\n");
    const result = module.setTodoStatus("009", "ready", root);
    assert.strictEqual(result.success, true);
    assert.ok(fs.existsSync(path.join(root, "docs", "todos", "009-ready-p2-dependent.md")));
  });

  test("malformed frontmatter with missing closing delimiter blocks writes", () => {
    const file = writeTodo(
      "010",
      "pending",
      "p2",
      "malformed",
      "---\nstatus: pending\n# No closing\n",
    );
    assert.throws(
      () => module.setTodoStatus("010", "ready", root),
      (e: any) => e.code === "invalid_input" && /malformed frontmatter/i.test(e.message),
    );
    const content = fs.readFileSync(file, "utf8");
    assert.match(content, /# No closing/);
  });

  test("group value injection is rejected", () => {
    // Multiline group
    assert.throws(
      () => module.setTodoGroup("001", "line1\nline2", root),
      (e: any) => e.code === "invalid_input" && /single line/i.test(e.message),
    );
    // Oversized group
    assert.throws(
      () => module.setTodoGroup("001", "x".repeat(201), root),
      (e: any) => e.code === "invalid_input" && /at most 200/i.test(e.message),
    );
    // No writes occurred
    const content = fs.readFileSync(todoFile, "utf8");
    assert.match(content, /group: team/);
  });

  test("group with special characters roundtrips safely", () => {
    const special = "team: shared #1";
    const result = module.setTodoGroup("001", special, root);
    assert.strictEqual(result.success, true);
    const loaded = module.loadTodo("001", root);
    assert.strictEqual(loaded.group, special);
    // Verify the file content has it quoted
    const content = fs.readFileSync(todoFile, "utf8");
    assert.match(content, /group: "team: shared #1"/);
  });

  test("no-frontmatter status change creates frontmatter mirror", () => {
    writeTodo("011", "pending", "p2", "no-fm", "# No Frontmatter\n");
    const result = module.setTodoStatus("011", "ready", root);
    assert.strictEqual(result.success, true);
    const loaded = module.loadTodo("011", root);
    assert.strictEqual(loaded.status, "ready");
    const fileContent = fs.readFileSync(result.filePath, "utf8");
    assert.match(fileContent, /status: ready/);
    assert.match(fileContent, /---/);
  });

  test("no-frontmatter priority change creates frontmatter mirror", () => {
    writeTodo("012", "pending", "p2", "no-fm-priority", "# No FM Priority\n");
    const result = module.setTodoPriority("012", "p1", root);
    assert.strictEqual(result.success, true);
    const loaded = module.loadTodo("012", root);
    assert.strictEqual(loaded.priority, "p1");
    const fileContent = fs.readFileSync(result.filePath, "utf8");
    assert.match(fileContent, /priority: p1/);
    assert.match(fileContent, /---/);
  });

  test("clearing group with no frontmatter does not create meaningless block", () => {
    writeTodo("013", "pending", "p2", "no-group", "# No Group\n");
    const result = module.setTodoGroup("013", "", root);
    assert.strictEqual(result.success, true);
    const content = fs.readFileSync(result.filePath, "utf8");
    assert.doesNotMatch(content, /^---/);
    assert.doesNotMatch(content, /group:/);
  });

  test("single file is not considered ambiguous", () => {
    const result = module.setTodoPriority("001", "p1", root);
    assert.strictEqual(result.success, true);
    assert.ok(fs.existsSync(path.join(root, "docs", "todos", "001-pending-p1-first.md")));
  });

  test("dependency duplicate terminal blocks ready even if first-found is terminal", () => {
    // First found is terminal (complete) but there's also a duplicate active
    writeTodo("014", "completed", "p2", "blocker-done", "# Done\n", "docs/todos/completed");
    writeTodo("014", "pending", "p2", "blocker-active", "# Active\n");
    writeTodo("015", "pending", "p2", "dependent", "---\ndependencies: [014]\n---\n# Dependent\n");
    assert.throws(
      () => module.setTodoStatus("015", "ready", root),
      (e: any) => e.code === "invalid_input" && /unresolved dependencies/i.test(e.message),
    );
  });

  test("block-style dependencies cannot bypass the ready guard", () => {
    fs.writeFileSync(todoFile, '---\ndependencies:\n  - "999"\n---\n# First\n');
    assert.throws(() => module.setTodoStatus("001", "ready", root), /unresolved dependencies/);
    assert.ok(fs.existsSync(todoFile));
  });

  test("cancellation preserves block tags and adds its tag even with no frontmatter", () => {
    fs.writeFileSync(todoFile, "---\ntags:\n  - existing\n---\n# First\n");
    const cancelled = module.setTodoStatus("001", "cancelled", root);
    assert.match(fs.readFileSync(cancelled.filePath, "utf8"), /tags: \[existing, cancelled\]/);
    writeTodo("020", "pending", "p2", "bare", "# Bare\n");
    const bare = module.setTodoStatus("020", "cancelled", root);
    assert.match(fs.readFileSync(bare.filePath, "utf8"), /tags: \[cancelled\]/);
  });

  test("literal quote characters roundtrip in groups and line/control injection is refused", () => {
    const group = '"quoted" team: shared';
    module.setTodoGroup("001", group, root);
    assert.strictEqual(module.loadTodo("001", root).group, group);
    const before = fs.readFileSync(todoFile, "utf8");
    for (const invalid of ["bad\rgroup", "bad\0group", "\nwrapped\n"]) {
      assert.throws(() => module.setTodoGroup("001", invalid, root), /single line/);
    }
    assert.strictEqual(fs.readFileSync(todoFile, "utf8"), before);
  });

  test("repeated configured folder paths do not fabricate dependency ambiguity", () => {
    fs.writeFileSync(
      path.join(path.dirname(todoFile), ".agendo-config.json"),
      JSON.stringify({ completeFolder: "completed", cancelledFolder: "completed" }),
    );
    writeTodo("002", "completed", "p2", "done", "# Done\n", "docs/todos/completed");
    fs.writeFileSync(todoFile, '---\ndependencies: ["002"]\n---\n# First\n');
    assert.strictEqual(module.getRelations("001", root).blocked, false);
    assert.strictEqual(
      module.findTodoFile("002", root),
      path.join(root, "docs/todos/completed/002-completed-p2-done.md"),
    );
  });

  test("clearing a group on malformed frontmatter is refused without rewriting", () => {
    const before = "---\ngroup: team\n# Missing closing marker\n";
    fs.writeFileSync(todoFile, before);
    assert.throws(() => module.setTodoGroup("001", "", root), /Malformed frontmatter/);
    assert.strictEqual(fs.readFileSync(todoFile, "utf8"), before);
  });
});
