import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import * as vscode from "vscode";
import { registerCommands } from "../commandRegistration";
import { Command } from "../commands";
import {
  fetchCodeQL,
  fetchSonarQube,
  importScanningFindings,
  type ScanningFinding,
  scanningPriority,
  updateScanningEvidence,
  validateSonarUrl,
} from "../todos/codeScanningService";
import { ConfigService } from "../todos/configService";
import { readText } from "../todos/fileSystem";
import { LinkService } from "../todos/linkService";
import { StatusService } from "../todos/statusService";
import { buildFileName, isTodoFileName, parseTodo } from "../todos/todoModel";
import { TodoRepository } from "../todos/todoRepository";

class ScanningConfig extends ConfigService {
  constructor(private readonly uri: vscode.Uri) {
    super();
  }
  override getRootUri() {
    return this.uri;
  }
  override get completeFolder() {
    return "done";
  }
  override get cancelledFolder() {
    return "dropped";
  }
  override get backlogFolder() {
    return "later";
  }
  override async writeConfigFile() {}
  override async applyGitignore() {}
}

const finding: ScanningFinding = {
  id: "42",
  rule: "js/example",
  severity: "warning",
  message: "Review this finding",
  path: "src/example.ts",
  line: 10,
  url: "https://github.com/owner/repo/security/code-scanning/42",
};

suite("native code scanning", () => {
  let root: vscode.Uri;
  let config: ScanningConfig;
  let repository: TodoRepository;

  setup(async () => {
    root = vscode.Uri.file(await fs.mkdtemp(path.join(os.tmpdir(), "agendo-scanning-")));
    config = new ScanningConfig(root);
    repository = new TodoRepository(config);
  });
  teardown(async () => {
    repository.dispose();
    await fs.rm(root.fsPath, { recursive: true, force: true });
  });

  test("scanner IDs round trip independently of regular IDs", () => {
    for (const id of ["001", "cql-001", "sq-001", "cql-1000"]) {
      const name = buildFileName(id, "pending", "p2", "example");
      assert.ok(isTodoFileName(name));
      assert.strictEqual(parseTodo(vscode.Uri.joinPath(root, name), "# Example", "")?.id, id);
    }
    assert.ok(!isTodoFileName("other-001-pending-p2-example.md"));
    assert.ok(!isTodoFileName("cql-01-pending-p2-example.md"));
  });

  test("import command catches refresh failures and holds its lock until refresh finishes", async () => {
    const originalRegister = vscode.commands.registerCommand;
    const originalWarning = vscode.window.showWarningMessage;
    const originalError = vscode.window.showErrorMessage;
    const callbacks = new Map<string, () => Promise<void>>();
    const errors: string[] = [];
    let refreshCount = 0;
    let rejectRefresh: (reason: Error) => void = () => {};
    const refresh = new Promise<void>((_resolve, reject) => {
      rejectRefresh = reject;
    });
    const subscriptions: vscode.Disposable[] = [];
    Object.defineProperty(vscode.commands, "registerCommand", {
      configurable: true,
      value: (id: string, callback: () => Promise<void>) => {
        callbacks.set(id, callback);
        return new vscode.Disposable(() => {});
      },
    });
    Object.defineProperty(vscode.window, "showWarningMessage", {
      configurable: true,
      value: async () => undefined,
    });
    Object.defineProperty(vscode.window, "showErrorMessage", {
      configurable: true,
      value: async (message: string) => {
        errors.push(message);
      },
    });
    try {
      registerCommands(
        { subscriptions } as never,
        {
          config: { getWorkspaceFolder: () => undefined },
          repository: {
            refresh: () => {
              refreshCount++;
              return refresh;
            },
          },
        } as never,
      );
      const command = callbacks.get(Command.ImportCodeScanning);
      assert.ok(command);
      const first = command();
      await Promise.resolve();
      await command();
      assert.strictEqual(refreshCount, 1);
      rejectRefresh(new Error("Refresh failed"));
      await first;
      assert.ok(errors[0].includes("Refresh failed"));
      await command();
      assert.strictEqual(refreshCount, 2);
      assert.strictEqual(errors.length, 2);
    } finally {
      Object.defineProperty(vscode.commands, "registerCommand", {
        configurable: true,
        value: originalRegister,
      });
      Object.defineProperty(vscode.window, "showWarningMessage", {
        configurable: true,
        value: originalWarning,
      });
      Object.defineProperty(vscode.window, "showErrorMessage", {
        configurable: true,
        value: originalError,
      });
      for (const subscription of subscriptions) {
        subscription.dispose();
      }
    }
  });

  test("native imports use separate source folders, sequences, and highest group severity", async () => {
    await vscode.workspace.fs.writeFile(
      vscode.Uri.joinPath(root, "050-pending-p3-regular.md"),
      Buffer.from("# Regular"),
    );
    const result = await importScanningFindings(config, repository, "codeql", "owner/repo", [
      finding,
      { ...finding, id: "43", severity: "critical" },
    ]);
    assert.deepStrictEqual(result, { created: 1, updated: 0 });
    assert.ok(
      repository
        .getTodos()
        .some(
          (todo) =>
            todo.fileName === "cql-001-pending-p1-js-example.md" &&
            todo.folder === "code-scanning/codeql",
        ),
    );
    await importScanningFindings(config, repository, "sonarqube", "server#project", [finding]);
    assert.strictEqual(repository.getMaxId(), 50);
    assert.strictEqual(repository.getMaxId("codeql"), 1);
    assert.strictEqual(repository.getMaxId("sonarqube"), 1);
    await importScanningFindings(config, repository, "codeql", "owner/repo", [
      { ...finding, rule: "js/second" },
    ]);
    assert.strictEqual(repository.getMaxId("codeql"), 2);
  });

  test("reimport preserves edits, terminal lifecycle, and identity after moves", async () => {
    await importScanningFindings(config, repository, "codeql", "owner/repo", [finding]);
    const status = new StatusService(config, repository);
    const completed = await status.setStatus(repository.getTodos()[0], "complete");
    assert.ok(completed?.path.includes("/code-scanning/codeql/done/"));
    await repository.refresh();
    const prioritized = await status.setPriority(repository.getTodos()[0], "p3");
    assert.ok(prioritized);
    await vscode.workspace.fs.writeFile(
      prioritized,
      Buffer.from(`${await readText(prioritized)}\nMy investigation notes\n`),
    );
    const result = await importScanningFindings(config, repository, "codeql", "owner/repo", [
      { ...finding, message: "Updated evidence" },
    ]);
    assert.deepStrictEqual(result, { created: 0, updated: 1 });
    const todo = repository.getTodos()[0];
    assert.strictEqual(todo.status, "complete");
    assert.strictEqual(todo.priority, "p3");
    assert.strictEqual(todo.folder, "code-scanning/codeql/done");
    const content = await readText(todo.uri);
    assert.ok(content.includes("My investigation notes"));
    assert.ok(content.includes("Updated evidence"));
    assert.deepStrictEqual(
      await importScanningFindings(config, repository, "codeql", "owner/repo", [
        { ...finding, message: "Updated evidence" },
      ]),
      { created: 0, updated: 0 },
    );
    await importScanningFindings(config, repository, "codeql", "owner/repo", []);
    assert.strictEqual(repository.getTodos().length, 1);
    const reopened = await status.setStatus(todo, "pending");
    assert.ok(reopened?.path.endsWith("/code-scanning/codeql/cql-001-pending-p3-js-example.md"));
  });

  test("all scanner lifecycle folders are discovered, linked, and retain the source on transition", async () => {
    await importScanningFindings(config, repository, "sonarqube", "server#project", [finding]);
    const status = new StatusService(config, repository);
    for (const [state, folder] of [
      ["backlogged", "later"],
      ["cancelled", "dropped"],
      ["ready", ""],
    ] as const) {
      const uri = await status.setStatus(repository.getTodos()[0], state);
      assert.ok(uri);
      await repository.refresh();
      assert.strictEqual(
        repository.getTodos()[0].folder,
        ["code-scanning/sonarqube", folder].filter(Boolean).join("/"),
      );
    }
    const todo = repository.getTodos()[0];
    await vscode.workspace.fs.writeFile(
      todo.uri,
      Buffer.from(`${await readText(todo.uri)}\nSee missing.md\n`),
    );
    assert.strictEqual(
      (
        await new LinkService(config).findReferencesToName(
          "missing.md",
          vscode.Uri.joinPath(root, "absent.md"),
        )
      ).length,
      1,
    );
    const dependencyUri = await status.setDependencies(todo, ["001", "cql-001"]);
    assert.ok(dependencyUri);
    await repository.refresh();
    assert.deepStrictEqual(repository.getTodos()[0].dependencies, ["001", "cql-001"]);
    assert.deepStrictEqual(repository.getDependencyGraph().blockedBy.get("sq-001"), [
      "001",
      "cql-001",
    ]);
  });

  test("identity includes source repository or project, not just rule name", async () => {
    await importScanningFindings(config, repository, "codeql", "owner/one", [finding]);
    await importScanningFindings(config, repository, "codeql", "owner/two", [finding]);
    assert.strictEqual(repository.getTodos().length, 2);
  });

  test("missing evidence markers are protected instead of overwriting user content", () => {
    assert.throws(() => updateScanningEvidence("# My notes", [finding]), /markers are missing/);
  });

  test("dirty editors are not overwritten by reimports", async () => {
    await importScanningFindings(config, repository, "codeql", "owner/repo", [finding]);
    const todo = repository.getTodos()[0];
    const document = await vscode.workspace.openTextDocument(todo.uri);
    const edit = new vscode.WorkspaceEdit();
    edit.insert(todo.uri, new vscode.Position(0, 0), "Unsaved note\n");
    await vscode.workspace.applyEdit(edit);
    try {
      assert.ok(document.isDirty);
      await assert.rejects(
        importScanningFindings(config, repository, "codeql", "owner/repo", [finding]),
        /Save todo cql-001/,
      );
      assert.ok(document.getText().startsWith("Unsaved note"));
    } finally {
      await document.save();
    }
  });

  test("invalid findings fail before creating any todos", async () => {
    await assert.rejects(
      importScanningFindings(config, repository, "codeql", "owner/repo", [
        finding,
        { ...finding, rule: "" },
      ]),
      /invalid finding/,
    );
    assert.strictEqual(repository.getTodos().length, 0);
    assert.deepStrictEqual(await fs.readdir(root.fsPath), []);
  });

  test("CodeQL adapter slurps all pages and uses stable rule IDs and security severity", async () => {
    const calls: string[][] = [];
    const scan = await fetchCodeQL(root.fsPath, async (args, options) => {
      calls.push(args);
      assert.strictEqual(options.cwd, root.fsPath);
      if (args[0] === "repo") {
        return { stdout: "owner/repo\n" };
      }
      const alert = {
        number: 1,
        rule: { id: "js/rule", severity: "warning", security_severity_level: "high" },
        most_recent_instance: {
          location: { path: "src/example.ts", start_line: 2 },
          message: { text: "Issue" },
        },
      };
      return { stdout: JSON.stringify([[alert], [{ ...alert, number: 2 }]]) };
    });
    assert.strictEqual(scan.scope, "owner/repo");
    assert.strictEqual(scan.findings.length, 2);
    assert.strictEqual(scan.findings[0].rule, "js/rule");
    assert.strictEqual(scan.findings[0].severity, "high");
    assert.ok(calls[1].includes("--slurp"));
    assert.ok(calls[1][1].includes("tool_name=CodeQL"));
  });

  test("CodeQL adapter rejects unexpected pagination payloads", async () => {
    await assert.rejects(
      fetchCodeQL(root.fsPath, async (args) => ({
        stdout: args[0] === "repo" ? "owner/repo" : "{}",
      })),
      /Unexpected GitHub/,
    );
  });

  test("severity mappings and SonarQube URL validation", () => {
    assert.strictEqual(scanningPriority("BLOCKER"), "p1");
    assert.strictEqual(scanningPriority("MINOR"), "p3");
    assert.strictEqual(scanningPriority("MAJOR"), "p2");
    assert.strictEqual(
      validateSonarUrl("https://sonar.example/context").toString(),
      "https://sonar.example/context/",
    );
    assert.doesNotThrow(() => validateSonarUrl("http://localhost:9000"));
    for (const url of [
      "http://sonar.example",
      "https://user:secret@sonar.example",
      "file:///tmp/sonar",
      "https://sonar.example?token=secret",
    ]) {
      assert.throws(() => validateSonarUrl(url));
    }
  });

  test("SonarQube pagination encodes project keys and preserves component paths", async () => {
    const original = globalThis.fetch;
    const requests: URL[] = [];
    globalThis.fetch = (async (url, options) => {
      requests.push(new URL(String(url)));
      assert.strictEqual(options?.redirect, "error");
      const key = String(requests.length);
      return new Response(
        JSON.stringify({
          issues: [
            {
              key,
              rule: "ts:S1",
              severity: "MAJOR",
              message: "Issue",
              component: "org:project:src/example.ts",
            },
          ],
          paging: { total: 2 },
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    try {
      const result = await fetchSonarQube(
        "https://sonar.example/context",
        "org:project",
        "test-token",
      );
      assert.strictEqual(result.findings.length, 2);
      assert.strictEqual(result.findings[0].path, "src/example.ts");
      assert.strictEqual(requests[0].pathname, "/context/api/issues/search");
      assert.strictEqual(requests[1].searchParams.get("p"), "2");
      assert.strictEqual(requests[0].searchParams.get("componentKeys"), "org:project");
    } finally {
      globalThis.fetch = original;
    }
  });

  test("SonarQube errors and incomplete pagination fail instead of importing partial evidence", async () => {
    const original = globalThis.fetch;
    try {
      globalThis.fetch = (async () =>
        new Response("unauthorized", { status: 401 })) as typeof fetch;
      await assert.rejects(
        fetchSonarQube("https://sonar.example", "project", "test-token"),
        /HTTP 401/,
      );
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ issues: [], paging: { total: 1 } }))) as typeof fetch;
      await assert.rejects(
        fetchSonarQube("https://sonar.example", "project", "test-token"),
        /incomplete/,
      );
    } finally {
      globalThis.fetch = original;
    }
  });

  test("canvas discovers scanner IDs and keeps custom source lifecycle folders", async () => {
    const workspace = path.join(root.fsPath, "workspace");
    const todoRoot = path.join(workspace, "docs", "todos");
    const sourceDir = path.join(todoRoot, "code-scanning", "codeql");
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.writeFile(
      path.join(todoRoot, ".agendo-config.json"),
      JSON.stringify({ completeFolder: "done" }),
    );
    await fs.writeFile(
      path.join(sourceDir, "cql-001-pending-p2-example.md"),
      "---\nstatus: pending\nissue_id: cql-001\n---\n# Example\n",
    );
    const load = new Function("url", "return import(url)") as (url: string) => Promise<any>;
    const canvas = await load(
      pathToFileURL(path.resolve(__dirname, "../../resources/canvas/agendo-work-session/todos.mjs"))
        .href,
    );
    assert.ok(canvas.listTodoSummaries(workspace).has("cql-001"));
    canvas.setTodoStatus("cql-001", "complete", workspace);
    assert.ok(
      canvas
        .findTodoFile("cql-001", workspace)
        .endsWith("code-scanning/codeql/done/cql-001-complete-p2-example.md"),
    );
    canvas.setTodoStatus("cql-001", "ready", workspace);
    assert.strictEqual(canvas.loadTodo("cql-001", workspace).status, "ready");
  });

  test("canvas shows explicit source badges in the header, dependencies, and history", async () => {
    const load = new Function("url", "return import(url)") as (url: string) => Promise<any>;
    const { renderCanvas } = await load(
      pathToFileURL(path.resolve(__dirname, "../../resources/canvas/agendo-work-session/page.mjs"))
        .href,
    );
    const recent = [
      { id: "001", title: "Regular", status: "pending" },
      { id: "cql-001", title: "CodeQL finding", status: "ready" },
      { id: "sq-001", title: "SonarQube finding", status: "in-progress" },
    ];
    const relations = {
      blocked: true,
      dependencies: [
        ...recent.map((item) => ({ ...item, priority: "p2", satisfied: false })),
        { id: "sq-999", missing: true, satisfied: false },
      ],
      dependents: [],
    };
    for (const [id, key, label] of [
      ["001", "todo", "todo"],
      ["cql-001", "codeql", "cql"],
      ["sq-001", "sonarqube", "sq"],
    ]) {
      const html = renderCanvas(
        {
          id,
          title: "<Example>",
          status: "pending",
          priority: "p2",
          criteria: [],
          triage: [],
          workLog: [],
        },
        relations,
        {
          canBack: true,
          canForward: false,
          recent: recent.map((item) => ({ ...item, current: item.id === id })),
        },
        { edit: true },
      );
      const header = /<div class="meta">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "";
      assert.ok(header.includes(`badge-source source-${key}`));
      assert.ok(header.includes(`aria-label="Source: ${label}"`));
      assert.ok(header.includes("status-pending"));
      assert.ok(html.includes("&lt;Example&gt;"));
      for (const item of recent) {
        assert.ok(html.includes(`data-open="${item.id}"`));
      }
      assert.ok(html.includes("todo · #001 Regular"));
      assert.ok(html.includes("cql · #cql-001 CodeQL finding"));
      assert.ok(html.includes("sq · #sq-001 SonarQube finding"));
      assert.ok(html.includes('class="canvas-toolbar"'));
      assert.ok(html.includes('data-edit title="Edit todo file"'));
      assert.ok(html.includes("<span>Edit</span>"));
      assert.ok(html.includes('<svg viewBox="0 0 24 24"'));
      assert.ok(!html.includes("&#9998;"));
    }
    const withoutEdit = renderCanvas(
      {
        id: "001",
        title: "Example",
        status: "pending",
        priority: "p2",
        criteria: [],
        triage: [],
        workLog: [],
      },
      null,
      null,
    );
    assert.ok(!withoutEdit.includes("data-edit"));
    assert.ok(!withoutEdit.includes('class="canvas-toolbar"'));
  });

  test("canvas edit button disables during a request and recovers after failure or success", async () => {
    const script = await fs.readFile(
      path.resolve(__dirname, "../../resources/canvas/agendo-work-session/assets/page.js"),
      "utf8",
    );
    let onEdit: (event: { currentTarget: { disabled: boolean } }) => Promise<void> = async () => {};
    const button = {
      disabled: false,
      addEventListener: (_event: string, callback: typeof onEdit) => {
        onEdit = callback;
      },
    };
    const message = { textContent: "" };
    let fail = true;
    runInNewContext(script, {
      document: {
        body: { dataset: { todoId: "cql-001", status: "pending", percent: "0" } },
        getElementById: (id: string) => (id === "status-message" ? message : null),
        querySelectorAll: () => [],
        querySelector: (selector: string) => (selector === "[data-edit]" ? button : null),
      },
      sessionStorage: { getItem: () => null, setItem: () => {} },
      setInterval: () => {},
      fetch: async () => ({ ok: !fail, text: async () => "Editor unavailable" }),
    });
    const failedRequest = onEdit({ currentTarget: button });
    assert.strictEqual(button.disabled, true);
    await failedRequest;
    assert.strictEqual(button.disabled, false);
    assert.strictEqual(message.textContent, "Could not open editor: Editor unavailable");
    fail = false;
    const successfulRequest = onEdit({ currentTarget: button });
    assert.strictEqual(button.disabled, true);
    await successfulRequest;
    assert.strictEqual(button.disabled, false);
    assert.strictEqual(message.textContent, "");
  });
});
