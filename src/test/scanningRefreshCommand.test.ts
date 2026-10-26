import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { registerCommands } from "../commandRegistration";
import { Command } from "../commands";
import type { ScanningFinding } from "../todos/codeScanningService";
import { ConfigService } from "../todos/configService";
import { scanningIdentity } from "../todos/scanningSnapshot";
import { buildFileName } from "../todos/todoModel";
import { TodoRepository } from "../todos/todoRepository";

class TestConfig extends ConfigService {
  constructor(private readonly uri: vscode.Uri) {
    super();
  }
  override getRootUri() {
    return this.uri;
  }
  override async writeConfigFile() {}
  override async applyGitignore() {}
}

const codeqlFinding: ScanningFinding = {
  id: "100",
  rule: "js/test-rule",
  severity: "high",
  message: "Test finding",
  path: "src/test.ts",
  line: 5,
  url: "https://github.com/owner/repo/security/code-scanning/100",
};

const sonarFinding: ScanningFinding = {
  id: "AYE123",
  rule: "sonar:rule1",
  severity: "CRITICAL",
  message: "Sonar test finding",
  path: "src/main.ts",
  line: 10,
  url: "https://sonar.example.com/project/issues?id=project&issues=AYE123",
};

function mock(target: object, key: string, value: unknown, restore: Array<() => void> = []) {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, value });
  restore.push(() => {
    if (descriptor) Object.defineProperty(target, key, descriptor);
  });
}

suite("scanning refresh command", () => {
  let root: vscode.Uri;
  let config: TestConfig;
  let repository: TodoRepository;
  let restore: Array<() => void>;

  setup(async () => {
    root = vscode.Uri.file(await fs.mkdtemp(path.join(os.tmpdir(), "agendo-refresh-")));
    config = new TestConfig(root);
    repository = new TodoRepository(config);
    restore = [];
    mock(vscode.workspace, "isTrusted", true, restore);
  });

  teardown(async () => {
    repository.dispose();
    for (const fn of restore) fn();
    restore = [];
    await fs.rm(root.fsPath, { recursive: true, force: true });
  });

  async function createScanningTodo(
    source: "codeql" | "sonarqube",
    target: string,
    grouping: string,
    scope: string,
  ): Promise<{ todo: any; id: string }> {
    const sourceDir = path.join(root.fsPath, "code-scanning", source);
    await fs.mkdir(sourceDir, { recursive: true });
    const id = `${source === "codeql" ? "cql" : "sq"}-001`;
    const provenance = { source, scope, grouping: grouping as any, target };
    const identity = scanningIdentity(provenance);
    const fileName = buildFileName(id, "pending", "p1", "test");
    const filePath = path.join(sourceDir, fileName);
    const content = [
      "---",
      "status: pending",
      "priority: p1",
      `issue_id: "${id}"`,
      "tags: [code-scanning, codeql]",
      "dependencies: []",
      `scan_identity: ${identity}`,
      `scan_source: ${source}`,
      `scan_scope: ${JSON.stringify(scope)}`,
      `scan_grouping: ${grouping}`,
      `scan_target: ${JSON.stringify(target)}`,
      "---",
      `# Test ${id}`,
      "",
      "<!-- agendo:scan-evidence:start -->",
      "## Scanner Evidence",
      "<!-- agendo:scan-evidence:end -->",
      "",
    ].join("\n");
    await fs.writeFile(filePath, content);
    await repository.refresh();
    const todos = repository.getTodos();
    const todo = todos.find((t) => t.id === id);
    assert.ok(todo, `Todo ${id} not found after refresh`);
    return { todo, id };
  }

  test("resolves todo from TodoNode argument", async () => {
    const { id } = await createScanningTodo("codeql", "src/test.ts", "file", "owner/repo");
    const callbacks = new Map<string, (...args: any[]) => Promise<void>>();
    const subscriptions: vscode.Disposable[] = [];
    mock(
      vscode.commands,
      "registerCommand",
      (id: string, cb: (...args: any[]) => Promise<void>) => {
        callbacks.set(id, cb);
        return new vscode.Disposable(() => {});
      },
    );
    mock(vscode.window, "showErrorMessage", async () => undefined, restore);
    mock(vscode.window, "showInformationMessage", async () => undefined, restore);
    registerCommands(
      { subscriptions } as never,
      {
        config: { getWorkspaceFolder: () => ({ uri: root }) },
        repository: { getTodos: () => repository.getTodos(), refresh: () => repository.refresh() },
      } as never,
    );
    const handler = callbacks.get(Command.RefreshScanningTodo);
    assert.ok(handler, "RefreshScanningTodo not registered");
    const node = { kind: "todo", todo: { id, uri: vscode.Uri.joinPath(root, "x.md") } };
    await handler(node);
  });

  test("resolves todo from board todoId argument", async () => {
    const { id } = await createScanningTodo("codeql", "src/test.ts", "file", "owner/repo");
    const callbacks = new Map<string, (...args: any[]) => Promise<void>>();
    const subscriptions: vscode.Disposable[] = [];
    mock(
      vscode.commands,
      "registerCommand",
      (id: string, cb: (...args: any[]) => Promise<void>) => {
        callbacks.set(id, cb);
        return new vscode.Disposable(() => {});
      },
    );
    mock(vscode.window, "showErrorMessage", async () => undefined, restore);
    mock(vscode.window, "showInformationMessage", async () => undefined, restore);
    registerCommands(
      { subscriptions } as never,
      {
        config: { getWorkspaceFolder: () => ({ uri: root }) },
        repository: { getTodos: () => repository.getTodos(), refresh: () => repository.refresh() },
      } as never,
    );
    const handler = callbacks.get(Command.RefreshScanningTodo) as any;
    await handler({ todoId: id });
  });

  test("rejects non-scanner todo for refresh", async () => {
    const errors: string[] = [];
    mock(
      vscode.window,
      "showErrorMessage",
      async (msg: string) => {
        errors.push(msg);
      },
      restore,
    );
    const nonScanner = { id: "001", uri: vscode.Uri.joinPath(root, "001-pending-p1-x.md") };
    const callbacks = new Map<string, (...args: any[]) => Promise<void>>();
    const subscriptions: vscode.Disposable[] = [];
    mock(
      vscode.commands,
      "registerCommand",
      (id: string, cb: (...args: any[]) => Promise<void>) => {
        callbacks.set(id, cb);
        return new vscode.Disposable(() => {});
      },
    );
    registerCommands(
      { subscriptions } as never,
      {
        config: { getWorkspaceFolder: () => ({ uri: root }) },
        repository: { getTodos: () => repository.getTodos(), refresh: () => repository.refresh() },
      } as never,
    );
    const handler = callbacks.get(Command.RefreshScanningTodo) as any;
    await handler({ kind: "todo", todo: nonScanner });
    assert.ok(errors.some((e) => e.includes("not a scanner-imported todo")));
  });

  test("CodeQL scope mismatch rejects before importing", async () => {
    const { id } = await createScanningTodo("codeql", "src/test.ts", "file", "owner/repo");
    const errors: string[] = [];
    let importCalled = false;
    mock(
      vscode.window,
      "showErrorMessage",
      async (msg: string) => {
        errors.push(msg);
      },
      restore,
    );
    mock(
      vscode.window,
      "withProgress",
      async (_opts: unknown, work: () => Promise<void>) => work(),
      restore,
    );
    mock(
      require("../todos/codeScanningService"),
      "fetchCodeQL",
      async () => ({ scope: "other/repo", findings: [codeqlFinding] }),
      restore,
    );
    mock(
      require("../todos/codeScanningService"),
      "importScanningFindings",
      async () => {
        importCalled = true;
        return {
          created: 0,
          updated: 0,
          refreshed: 0,
          changes: { added: 0, changed: 0, unchanged: 0, notReturned: 0, uncompared: 0 },
          reviewRequired: [],
        };
      },
      restore,
    );
    const callbacks = new Map<string, (...args: any[]) => Promise<void>>();
    const subscriptions: vscode.Disposable[] = [];
    mock(
      vscode.commands,
      "registerCommand",
      (id: string, cb: (...args: any[]) => Promise<void>) => {
        callbacks.set(id, cb);
        return new vscode.Disposable(() => {});
      },
    );
    registerCommands(
      { subscriptions } as never,
      {
        config: { getWorkspaceFolder: () => ({ uri: root }) },
        repository: { getTodos: () => repository.getTodos(), refresh: () => repository.refresh() },
      } as never,
    );
    const handler = callbacks.get(Command.RefreshScanningTodo) as any;
    await handler({ kind: "todo", todo: repository.getTodos().find((t) => t.id === id) as any });
    assert.ok(
      errors.some((e) => e.includes("other/repo") && e.includes("owner/repo")),
      "Scope mismatch error not shown",
    );
    assert.strictEqual(importCalled, false, "Importer called despite scope mismatch");
  });

  test("CodeQL refresh preserves stored scope and grouping", async () => {
    const { id } = await createScanningTodo("codeql", "js/test-rule", "rule", "owner/repo");
    let capturedGrouping: string | undefined;
    let capturedScope: string | undefined;
    let capturedFindings: ScanningFinding[] | undefined;
    mock(
      require("../todos/codeScanningService"),
      "fetchCodeQL",
      async () => ({ scope: "owner/repo", findings: [codeqlFinding] }),
      restore,
    );
    mock(
      require("../todos/codeScanningService"),
      "importScanningFindings",
      async (
        _c: unknown,
        _r: unknown,
        _s: unknown,
        scope: string,
        findings: ScanningFinding[],
        grouping: string,
        options?: { target?: string },
      ) => {
        capturedScope = scope;
        capturedGrouping = grouping;
        capturedFindings = findings;
        assert.strictEqual(options?.target, "src/test.ts");
        return {
          created: 0,
          updated: 2,
          refreshed: 0,
          changes: { added: 0, changed: 1, unchanged: 0, notReturned: 0, uncompared: 0 },
          reviewRequired: [],
        };
      },
      restore,
    );
    mock(vscode.window, "showErrorMessage", async () => undefined, restore);
    mock(vscode.window, "showInformationMessage", async () => undefined, restore);
    mock(
      vscode.window,
      "withProgress",
      async (_opts: unknown, work: () => Promise<void>) => work(),
      restore,
    );
    const callbacks = new Map<string, (...args: any[]) => Promise<void>>();
    const subscriptions: vscode.Disposable[] = [];
    mock(
      vscode.commands,
      "registerCommand",
      (id: string, cb: (...args: any[]) => Promise<void>) => {
        callbacks.set(id, cb);
        return new vscode.Disposable(() => {});
      },
    );
    registerCommands(
      { subscriptions } as never,
      {
        config: { getWorkspaceFolder: () => ({ uri: root }) },
        repository: { getTodos: () => repository.getTodos(), refresh: () => repository.refresh() },
      } as never,
    );
    const handler = callbacks.get(Command.RefreshScanningTodo) as any;
    await handler({ kind: "todo", todo: repository.getTodos().find((t) => t.id === id) as any });
    assert.strictEqual(capturedScope, "owner/repo");
    assert.strictEqual(capturedGrouping, "rule");
    assert.strictEqual(capturedFindings?.length, 1);
  });

  test("CodeQL refresh handles empty file target", async () => {
    const { id } = await createScanningTodo("codeql", "", "file", "owner/repo");
    let capturedOptions: { target?: string } | undefined;
    mock(
      require("../todos/codeScanningService"),
      "fetchCodeQL",
      async () => ({
        scope: "owner/repo",
        findings: [{ ...codeqlFinding, path: "", line: undefined }],
      }),
      restore,
    );
    mock(
      require("../todos/codeScanningService"),
      "importScanningFindings",
      async (
        _c: unknown,
        _r: unknown,
        _s: unknown,
        _scope: string,
        _findings: ScanningFinding[],
        _grouping: string,
        _options?: { target?: string },
      ) => {
        capturedOptions = _options;
        return {
          created: 0,
          updated: 2,
          refreshed: 0,
          changes: { added: 0, changed: 1, unchanged: 0, notReturned: 0, uncompared: 0 },
          reviewRequired: [],
        };
      },
      restore,
    );
    mock(vscode.window, "showErrorMessage", async () => undefined, restore);
    mock(vscode.window, "showInformationMessage", async () => undefined, restore);
    mock(
      vscode.window,
      "withProgress",
      async (_opts: unknown, work: () => Promise<void>) => work(),
      restore,
    );
    const callbacks = new Map<string, (...args: any[]) => Promise<void>>();
    const subscriptions: vscode.Disposable[] = [];
    mock(
      vscode.commands,
      "registerCommand",
      (id: string, cb: (...args: any[]) => Promise<void>) => {
        callbacks.set(id, cb);
        return new vscode.Disposable(() => {});
      },
    );
    registerCommands(
      { subscriptions } as never,
      {
        config: { getWorkspaceFolder: () => ({ uri: root }) },
        repository: { getTodos: () => repository.getTodos(), refresh: () => repository.refresh() },
      } as never,
    );
    const handler = callbacks.get(Command.RefreshScanningTodo) as any;
    await handler({ kind: "todo", todo: repository.getTodos().find((t) => t.id === id) as any });
    assert.strictEqual(capturedOptions?.target, "");
  });

  test("CodeQL refresh handles finding no longer returned", async () => {
    const { id } = await createScanningTodo("codeql", "src/test.ts", "file", "owner/repo");
    const infoMessages: string[] = [];
    mock(
      require("../todos/codeScanningService"),
      "fetchCodeQL",
      async () => ({
        scope: "owner/repo",
        findings: [{ ...codeqlFinding, id: "999", path: "other.ts" }],
      }),
      restore,
    );
    mock(
      require("../todos/codeScanningService"),
      "importScanningFindings",
      async () => {
        assert.fail("importScanningFindings called for missing finding");
      },
      restore,
    );
    mock(vscode.window, "showErrorMessage", async () => undefined, restore);
    mock(
      vscode.window,
      "showInformationMessage",
      async (msg: string) => {
        infoMessages.push(msg);
      },
      restore,
    );
    mock(
      vscode.window,
      "withProgress",
      async (_opts: unknown, work: () => Promise<void>) => work(),
      restore,
    );
    const callbacks = new Map<string, (...args: any[]) => Promise<void>>();
    const subscriptions: vscode.Disposable[] = [];
    mock(
      vscode.commands,
      "registerCommand",
      (id: string, cb: (...args: any[]) => Promise<void>) => {
        callbacks.set(id, cb);
        return new vscode.Disposable(() => {});
      },
    );
    registerCommands(
      { subscriptions } as never,
      {
        config: { getWorkspaceFolder: () => ({ uri: root }) },
        repository: { getTodos: () => repository.getTodos(), refresh: () => repository.refresh() },
      } as never,
    );
    const handler = callbacks.get(Command.RefreshScanningTodo) as any;
    await handler({ kind: "todo", todo: repository.getTodos().find((t) => t.id === id) as any });
    assert.ok(
      infoMessages.some((m) => m.includes("no longer returned") && m.includes("src/test.ts")),
      "No-longer-returned message not shown",
    );
  });

  test("missing scan_scope shows re-import diagnostic", async () => {
    const sourceDir = path.join(root.fsPath, "code-scanning", "codeql");
    await fs.mkdir(sourceDir, { recursive: true });
    const filePath = path.join(sourceDir, "cql-001-pending-p1-test.md");
    const content = [
      "---",
      "status: pending",
      "priority: p1",
      'issue_id: "cql-001"',
      "tags: [code-scanning, codeql]",
      "dependencies: []",
      "scan_source: codeql",
      "scan_grouping: file",
      'scan_target: "src/test.ts"',
      "---",
      "# Test cql-001",
      "",
      "<!-- agendo:scan-evidence:start -->",
      "## Scanner Evidence",
      "<!-- agendo:scan-evidence:end -->",
      "",
    ].join("\n");
    await fs.writeFile(filePath, content);
    await repository.refresh();
    const errors: string[] = [];
    mock(
      vscode.window,
      "showErrorMessage",
      async (msg: string) => {
        errors.push(msg);
      },
      restore,
    );
    const callbacks = new Map<string, (...args: any[]) => Promise<void>>();
    const subscriptions: vscode.Disposable[] = [];
    mock(
      vscode.commands,
      "registerCommand",
      (id: string, cb: (...args: any[]) => Promise<void>) => {
        callbacks.set(id, cb);
        return new vscode.Disposable(() => {});
      },
    );
    registerCommands(
      { subscriptions } as never,
      {
        config: { getWorkspaceFolder: () => ({ uri: root }) },
        repository: { getTodos: () => repository.getTodos(), refresh: () => repository.refresh() },
      } as never,
    );
    const handler = callbacks.get(Command.RefreshScanningTodo) as any;
    await handler({
      kind: "todo",
      todo: repository.getTodos().find((t) => t.id === "cql-001") as any,
    });
    assert.ok(
      errors.some((e) => e.includes("provenance") || e.includes("re-import")),
      "No provenance diagnostic shown",
    );
  });

  test("untrusted workspace blocks refresh", async () => {
    mock(vscode.workspace, "isTrusted", false, restore);
    const warnings: string[] = [];
    mock(
      vscode.window,
      "showWarningMessage",
      async (msg: string) => {
        warnings.push(msg);
      },
      restore,
    );
    const { id } = await createScanningTodo("codeql", "src/test.ts", "file", "owner/repo");
    const callbacks = new Map<string, (...args: any[]) => Promise<void>>();
    const subscriptions: vscode.Disposable[] = [];
    mock(
      vscode.commands,
      "registerCommand",
      (id: string, cb: (...args: any[]) => Promise<void>) => {
        callbacks.set(id, cb);
        return new vscode.Disposable(() => {});
      },
    );
    registerCommands(
      { subscriptions } as never,
      {
        config: { getWorkspaceFolder: () => ({ uri: root }) },
        repository: { getTodos: () => repository.getTodos(), refresh: () => repository.refresh() },
      } as never,
    );
    const handler = callbacks.get(Command.RefreshScanningTodo) as any;
    await handler({ kind: "todo", todo: repository.getTodos().find((t) => t.id === id) as any });
    assert.ok(warnings.some((w) => w.includes("Trust this workspace")));
  });

  test("import and refresh share lock until repository refresh finishes", async () => {
    const errors: string[] = [];
    const warnings: string[] = [];
    mock(
      vscode.window,
      "showErrorMessage",
      async (msg: string) => {
        errors.push(msg);
      },
      restore,
    );
    mock(
      vscode.window,
      "showWarningMessage",
      async (msg: string) => {
        warnings.push(msg);
      },
      restore,
    );
    const callbacks = new Map<string, (...args: any[]) => Promise<void>>();
    const subscriptions: vscode.Disposable[] = [];
    let refreshCount = 0;
    let refreshResolve: (() => void) | undefined;
    const refreshPromise = new Promise<void>((resolve) => {
      refreshResolve = resolve;
    });
    mock(
      vscode.commands,
      "registerCommand",
      (id: string, cb: (...args: any[]) => Promise<void>) => {
        callbacks.set(id, cb);
        return new vscode.Disposable(() => {});
      },
    );
    registerCommands(
      { subscriptions } as never,
      {
        config: { getWorkspaceFolder: () => ({ uri: root }) },
        repository: {
          refresh: () => {
            refreshCount++;
            return refreshPromise;
          },
        },
      } as never,
    );
    const importHandler = callbacks.get(Command.ImportCodeScanning) as any;
    const refreshHandler = callbacks.get(Command.RefreshScanningTodo) as any;
    const first = importHandler();
    await Promise.resolve();
    await refreshHandler();
    assert.strictEqual(refreshCount, 1, "Second command ran while first held lock");
    refreshResolve?.();
    await first;
    refreshResolve = undefined;
  });

  test("Sonar refresh uses fixed server/project from provenance", async () => {
    const scope = "https://sonar.example.com/#project";
    const { id } = await createScanningTodo("sonarqube", "AYE123", "finding", scope);
    let capturedServer: string | undefined;
    let capturedProject: string | undefined;
    mock(
      require("../todos/codeScanningService"),
      "fetchSonarQube",
      async (server: string, project: string, _token: string) => {
        capturedServer = server;
        capturedProject = project;
        return { scope, findings: [sonarFinding] };
      },
      restore,
    );
    mock(
      vscode.window,
      "showQuickPick",
      async (items: Array<{ cli?: boolean }>) => {
        if (items[0]?.cli !== undefined) {
          return { cli: false };
        }
        return undefined;
      },
      restore,
    );
    mock(
      vscode.window,
      "showInputBox",
      async (opts: { prompt?: string; value?: string }) => {
        if (opts.prompt?.includes("token")) return "test-token";
        return undefined;
      },
      restore,
    );
    mock(
      require("../todos/codeScanningService"),
      "importScanningFindings",
      async (
        _c: unknown,
        _r: unknown,
        _s: unknown,
        _scope: string,
        _findings: ScanningFinding[],
        _grouping: string,
        _options?: { target?: string },
      ) => {
        return {
          created: 0,
          updated: 2,
          refreshed: 0,
          changes: { added: 0, changed: 1, unchanged: 0, notReturned: 0, uncompared: 0 },
          reviewRequired: [],
        };
      },
      restore,
    );
    mock(vscode.window, "showErrorMessage", async () => undefined, restore);
    mock(vscode.window, "showInformationMessage", async () => undefined, restore);
    mock(
      vscode.window,
      "withProgress",
      async (_opts: unknown, work: () => Promise<void>) => work(),
      restore,
    );
    mock(
      vscode.workspace,
      "getConfiguration",
      () => ({
        get: () => undefined,
        update: async () => undefined,
        has: () => false,
        inspect: () => undefined,
      }),
      restore,
    );
    const callbacks = new Map<string, (...args: any[]) => Promise<void>>();
    const subscriptions: vscode.Disposable[] = [];
    const secretsStore = new Map<string, string>();
    const secrets = {
      get: async (key: string) => {
        return secretsStore.get(key);
      },
      store: async (key: string, value: string) => {
        secretsStore.set(key, value);
      },
      delete: async (key: string) => {
        secretsStore.delete(key);
      },
    };
    mock(
      vscode.commands,
      "registerCommand",
      (id: string, cb: (...args: any[]) => Promise<void>) => {
        callbacks.set(id, cb);
        return new vscode.Disposable(() => {});
      },
    );
    registerCommands(
      {
        subscriptions,
        secrets,
      } as never,
      {
        config: { getWorkspaceFolder: () => ({ uri: root }) },
        repository: { getTodos: () => repository.getTodos(), refresh: () => repository.refresh() },
      } as never,
    );
    const handler = callbacks.get(Command.RefreshScanningTodo) as any;
    await handler({ kind: "todo", todo: repository.getTodos().find((t) => t.id === id) as any });
    assert.strictEqual(capturedServer, "https://sonar.example.com/");
    assert.strictEqual(capturedProject, "project");
  });

  test("Sonar CLI mismatch aborts before fetch", async () => {
    const scope = "https://sonar.example.com/project";
    const { id } = await createScanningTodo("sonarqube", "AYE123", "finding", scope);
    const errors: string[] = [];
    let fetchCalled = false;
    mock(
      require("../todos/codeScanningService"),
      "fetchCodeQL",
      async () => ({ scope: "owner/repo", findings: [codeqlFinding] }),
      restore,
    );
    mock(
      require("../todos/codeScanningService"),
      "fetchSonarQube",
      async () => {
        fetchCalled = true;
        return { scope, findings: [] };
      },
      restore,
    );
    mock(
      require("../todos/codeScanningService"),
      "sonarQubeCliServer",
      async () => "https://other-server.example.com/",
      restore,
    );
    mock(
      vscode.window,
      "showErrorMessage",
      async (msg: string) => {
        errors.push(msg);
      },
      restore,
    );
    mock(
      vscode.window,
      "showQuickPick",
      async (items: Array<{ cli?: boolean }>) => {
        if (items[0]?.cli !== undefined) {
          return { cli: true };
        }
        return undefined;
      },
      restore,
    );
    mock(
      vscode.window,
      "withProgress",
      async (_opts: unknown, work: () => Promise<void>) => work(),
      restore,
    );
    const callbacks = new Map<string, (...args: any[]) => Promise<void>>();
    const subscriptions: vscode.Disposable[] = [];
    mock(
      vscode.commands,
      "registerCommand",
      (id: string, cb: (...args: any[]) => Promise<void>) => {
        callbacks.set(id, cb);
        return new vscode.Disposable(() => {});
      },
    );
    registerCommands(
      { subscriptions } as never,
      {
        config: { getWorkspaceFolder: () => ({ uri: root }) },
        repository: { getTodos: () => repository.getTodos(), refresh: () => repository.refresh() },
      } as never,
    );
    const handler = callbacks.get(Command.RefreshScanningTodo) as any;
    await handler({ kind: "todo", todo: repository.getTodos().find((t) => t.id === id) as any });
    assert.strictEqual(fetchCalled, false, "Fetch called after CLI mismatch");
    assert.ok(errors.some((e) => e.includes("CLI connection") || e.includes("different server")));
  });

  test("reviewRequired IDs are shown with warning, no status change", async () => {
    const { id } = await createScanningTodo("codeql", "src/test.ts", "file", "owner/repo");
    const infoMessages: string[] = [];
    mock(
      require("../todos/codeScanningService"),
      "fetchCodeQL",
      async () => ({ scope: "owner/repo", findings: [codeqlFinding] }),
      restore,
    );
    mock(
      require("../todos/codeScanningService"),
      "importScanningFindings",
      async () => ({
        created: 0,
        updated: 1,
        refreshed: 0,
        changes: { added: 0, changed: 1, unchanged: 0, notReturned: 0, uncompared: 0 },
        reviewRequired: [id],
      }),
      restore,
    );
    mock(vscode.window, "showErrorMessage", async () => undefined, restore);
    mock(
      vscode.window,
      "showInformationMessage",
      async (msg: string) => {
        infoMessages.push(msg);
      },
      restore,
    );
    mock(
      vscode.window,
      "withProgress",
      async (_opts: unknown, work: () => Promise<void>) => work(),
      restore,
    );
    const callbacks = new Map<string, (...args: any[]) => Promise<void>>();
    const subscriptions: vscode.Disposable[] = [];
    mock(
      vscode.commands,
      "registerCommand",
      (id: string, cb: (...args: any[]) => Promise<void>) => {
        callbacks.set(id, cb);
        return new vscode.Disposable(() => {});
      },
    );
    registerCommands(
      { subscriptions } as never,
      {
        config: { getWorkspaceFolder: () => ({ uri: root }) },
        repository: { getTodos: () => repository.getTodos(), refresh: () => repository.refresh() },
      } as never,
    );
    const handler = callbacks.get(Command.RefreshScanningTodo) as any;
    await handler({ kind: "todo", todo: repository.getTodos().find((t) => t.id === id) as any });
    const msg = infoMessages.find((m) => m.includes("Requires review"));
    assert.ok(msg, "No review required message");
    assert.ok(msg.includes("not auto-marked"));
    assert.ok(msg.includes("retrieves current scanner results"));
  });

  test("ambiguous board todoId is rejected", async () => {
    await createScanningTodo("codeql", "src/a.ts", "file", "owner/repo");
    const errors: string[] = [];
    mock(
      vscode.window,
      "showErrorMessage",
      async (msg: string) => {
        errors.push(msg);
      },
      restore,
    );
    const callbacks = new Map<string, (...args: any[]) => Promise<void>>();
    const subscriptions: vscode.Disposable[] = [];
    mock(
      vscode.commands,
      "registerCommand",
      (id: string, cb: (...args: any[]) => Promise<void>) => {
        callbacks.set(id, cb);
        return new vscode.Disposable(() => {});
      },
    );
    registerCommands(
      { subscriptions } as never,
      {
        config: { getWorkspaceFolder: () => ({ uri: root }) },
        repository: {
          getTodos: () => repository.getTodos(),
          refresh: () => repository.refresh(),
        },
      } as never,
    );
    const handler = callbacks.get(Command.RefreshScanningTodo) as any;
    await handler({ todoId: "nonexistent" });
    assert.ok(errors.some((e) => e.includes("Could not resolve")));
  });

  test("command palette (no arg) shows picker of imported todos", async () => {
    await createScanningTodo("codeql", "src/test.ts", "file", "owner/repo");
    const pickerItems: Array<{ label?: string }> = [];
    mock(
      vscode.window,
      "showQuickPick",
      async (items: Array<{ label?: string }>) => {
        pickerItems.push(...items);
        return undefined;
      },
      restore,
    );
    mock(vscode.window, "showErrorMessage", async () => undefined, restore);
    const callbacks = new Map<string, (...args: any[]) => Promise<void>>();
    const subscriptions: vscode.Disposable[] = [];
    mock(
      vscode.commands,
      "registerCommand",
      (id: string, cb: (...args: any[]) => Promise<void>) => {
        callbacks.set(id, cb);
        return new vscode.Disposable(() => {});
      },
    );
    registerCommands(
      { subscriptions } as never,
      {
        config: { getWorkspaceFolder: () => ({ uri: root }) },
        repository: { getTodos: () => repository.getTodos(), refresh: () => repository.refresh() },
      } as never,
    );
    const handler = callbacks.get(Command.RefreshScanningTodo) as any;
    await handler();
    assert.ok(pickerItems.length > 0, "Picker not shown for command palette invocation");
  });
});
