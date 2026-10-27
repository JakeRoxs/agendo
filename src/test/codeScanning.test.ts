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
  fetchCodeQLBranches,
  fetchSonarQube,
  fetchSonarQubeBranches,
  fetchSonarQubeCliBranches,
  fetchSonarQubeCli,
  importScanningFindings,
  type ScanningFinding,
  scanningPriority,
  sonarQubeCliServer,
  sonarQubeDefaults,
  sonarQubeEnvironmentToken,
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
  override get completedFolder() {
    return "done";
  }
  override get cancelledFolder() {
    return "dropped";
  }
  override get backloggedFolder() {
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

function assertImportCounts(
  actual: { created: number; updated: number },
  expected: { created: number; updated: number },
): void {
  assert.deepStrictEqual({ created: actual.created, updated: actual.updated }, expected);
}

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

  test("SonarQube defaults read the root project key without importing file credentials", async () => {
    await fs.writeFile(
      path.join(root.fsPath, "sonar-project.properties"),
      "# sonar.projectKey=ignored\nsonar.projectKey = example-project\nsonar.token=file-token\n",
    );
    assert.deepStrictEqual(await sonarQubeDefaults(root, {}), {
      server: "",
      project: "example-project",
      token: "",
    });
  });

  test("SonarQube project key trims surrounding whitespace from the properties file", async () => {
    await fs.writeFile(
      path.join(root.fsPath, "sonar-project.properties"),
      "  sonar.projectKey =   example-project   \n",
    );
    assert.deepStrictEqual(await sonarQubeDefaults(root, {}), {
      server: "",
      project: "example-project",
      token: "",
    });
  });

  test("SonarQube properties parsing respects line boundaries and literal keys", async () => {
    for (const [properties, project] of [
      ["\r\n# Comment\r\n\tsonar.projectKey\t:\t example-project \r\n", "example-project"],
      ["# Comment\rsonar.projectKey = cr-project\r", "cr-project"],
      ["sonar.projectKeySuffix=wrong\nsonar.projectKey=wanted", "wanted"],
      ["sonar.projectKey=\nother.property=not-a-project", ""],
    ]) {
      await fs.writeFile(path.join(root.fsPath, "sonar-project.properties"), properties);
      assert.strictEqual((await sonarQubeDefaults(root, {})).project, project);
    }
  });

  test("SonarQube properties parsing handles long malformed assignments", async () => {
    await fs.writeFile(
      path.join(root.fsPath, "sonar-project.properties"),
      `sonar.projectKey${" ".repeat(20_000)}not an assignment\nsonar.projectKey=valid-project`,
    );
    assert.strictEqual((await sonarQubeDefaults(root, {})).project, "valid-project");
  });

  test("SonarQube environment defaults support MCP and scanner variable names", async () => {
    assert.deepStrictEqual(
      await sonarQubeDefaults(root, {
        SONARQUBE_URL: " https://sonar.example.com ",
        SONARQUBE_TOKEN: " mcp-token ",
        SONAR_HOST_URL: "https://other.example.com",
        SONAR_TOKEN: "scanner-token",
        SONAR_PROJECT_KEY: "project",
      }),
      { server: "https://sonar.example.com", project: "project", token: "mcp-token" },
    );
    assert.deepStrictEqual(
      await sonarQubeDefaults(root, {
        SONAR_HOST_URL: "https://sonar.example.com",
        SONAR_TOKEN: "scanner-token",
      }),
      { server: "https://sonar.example.com", project: "", token: "scanner-token" },
    );
  });

  test("SonarQube environment project key overrides the properties file", async () => {
    await fs.writeFile(
      path.join(root.fsPath, "sonar-project.properties"),
      "sonar.projectKey:file-project\n",
    );
    assert.strictEqual(
      (await sonarQubeDefaults(root, { SONAR_PROJECT_KEY: "env-project" })).project,
      "env-project",
    );
  });

  test("SonarQube environment defaults never mix credential families or reuse unpaired tokens", async () => {
    for (const env of [
      { SONARQUBE_URL: "https://sonar.example.com", SONAR_TOKEN: "other-token" },
      { SONAR_HOST_URL: "https://sonar.example.com", SONARQUBE_TOKEN: "other-token" },
      {
        SONARQUBE_URL: "https://sonar.example.com",
        SONAR_HOST_URL: "https://other.example.com",
        SONAR_TOKEN: "other-token",
      },
    ]) {
      const defaults = await sonarQubeDefaults(root, env);
      assert.strictEqual(defaults.server, "https://sonar.example.com");
      assert.strictEqual(defaults.token, "");
      assert.strictEqual(sonarQubeEnvironmentToken(defaults.server, defaults), "");
    }
    for (const env of [
      { SONARQUBE_TOKEN: "unpaired-token" },
      { SONAR_TOKEN: "unpaired-token" },
      { SONARQUBE_URL: " ", SONARQUBE_TOKEN: "unpaired-token" },
    ]) {
      assert.deepStrictEqual(await sonarQubeDefaults(root, env), {
        server: "",
        project: "",
        token: "",
      });
    }
    assert.deepStrictEqual(
      await sonarQubeDefaults(root, {
        SONARQUBE_URL: " ",
        SONARQUBE_TOKEN: "ignored-token",
        SONAR_HOST_URL: " https://scanner.example.com ",
        SONAR_TOKEN: " scanner-token ",
      }),
      { server: "https://scanner.example.com", project: "", token: "scanner-token" },
    );
  });

  test("SonarQube environment tokens are not reused for a different server", () => {
    const defaults = { server: "https://sonar.example.com", token: "token" };
    assert.strictEqual(sonarQubeEnvironmentToken(`${defaults.server}/`, defaults), "token");
    assert.strictEqual(sonarQubeEnvironmentToken("https://other.example.com", defaults), "");
    assert.strictEqual(
      sonarQubeEnvironmentToken(defaults.server, { ...defaults, server: "bad" }),
      "",
    );
    assert.strictEqual(sonarQubeEnvironmentToken(defaults.server, { ...defaults, server: "" }), "");
  });

  test("scanner evidence leads with explicit locations and messages before rule documentation", () => {
    const content =
      "<!-- agendo:scan-evidence:start -->\nOld evidence\n<!-- agendo:scan-evidence:end -->\nPersonal notes\n";
    const updated = updateScanningEvidence(content, [
      {
        ...finding,
        ruleTitle: "Example rule",
        ruleDescription: "#### Why is this an issue?\n\nLong explanation.",
      },
      { ...finding, id: "43", path: "", line: undefined },
    ]);
    assert.match(updated, /### Affected Locations/);
    assert.match(updated, /#### File: src\/example.ts \| Line: 10/);
    assert.match(updated, /#### File: Project-level finding \| Line: not reported/);
    assert.match(updated, /\*\*Problem:\*\* Review this finding/);
    assert.match(updated, /\*\*Severity:\*\* warning/);
    assert.match(updated, /\[View finding 42\]\(<https:\/\/github.com/);
    assert.ok(updated.indexOf("File: src/example.ts") < updated.indexOf("### Rule:"));
    assert.ok(updated.indexOf("File: Project-level finding") < updated.indexOf("### Rule:"));
    assert.ok(updated.endsWith("Personal notes\n"));
  });

  test("canvas keeps scanner headings above body text with code labels and safe source links", async () => {
    const load = new Function("url", "return import(url)") as (url: string) => Promise<any>;
    const { renderMarkdown } = await load(
      pathToFileURL(
        path.resolve(__dirname, "../../resources/canvas/agendo-work-session/markdown.mjs"),
      ).href,
    );
    const html = renderMarkdown(
      "### Affected Locations\n\n#### File: src/example.ts | Line: 10\n\n**Problem:** Compare values.\n\n### Rule: Example\n\n#### Why is this an issue?\n\n##### Exceptions\n\n[`Reference`](https://example.com/rule)\n\n[Unsafe](javascript:alert(1))",
    );
    assert.match(html, /<h3>Affected Locations<\/h3>/);
    assert.match(html, /<h4>File: src\/example.ts \| Line: 10<\/h4>/);
    assert.match(html, /<h4>Why is this an issue\?<\/h4>/);
    assert.match(html, /<h5>Exceptions<\/h5>/);
    assert.match(html, /<a href="https:\/\/example.com\/rule"[^>]*><code>Reference<\/code><\/a>/);
    assert.doesNotMatch(html, /href="javascript:/);
    const css = await fs.readFile(
      path.resolve(__dirname, "../../resources/canvas/agendo-work-session/assets/page.css"),
      "utf8",
    );
    assert.match(css, /h2\{[^}]*font-size:1\.3em/);
    assert.match(css, /h3\{[^}]*font-size:1\.15em/);
    assert.match(css, /h4\{[^}]*font-size:1\.05em/);
    assert.match(css, /h5,h6\{[^}]*font-size:1em/);
  });

  test("scanner canvas groups findings by file with independent context sections and contents links", async () => {
    const load = new Function("url", "return import(url)") as (url: string) => Promise<any>;
    const { renderCanvas } = await load(
      pathToFileURL(path.resolve(__dirname, "../../resources/canvas/agendo-work-session/page.mjs"))
        .href,
    );
    const description = [
      "#### Why is this an issue?",
      "",
      "Understand the problem.",
      "",
      "#### How to fix it",
      "",
      "```",
      "#### File: fake.ts | Line: 999",
      "example();",
      "```",
      "",
      "#### References",
      "",
      "[Documentation](https://example.com/rule)",
    ].join("\n");
    const evidence = updateScanningEvidence(
      "<!-- agendo:scan-evidence:start -->\n<!-- agendo:scan-evidence:end -->",
      [
        {
          ...finding,
          id: "42",
          line: 20,
          ruleTitle: "Example <rule>",
          ruleDescription: description,
        },
        { ...finding, id: "43", line: 3 },
        { ...finding, id: "44", path: "src/other.ts", line: undefined },
      ],
    )
      .replace(/^<!-- agendo:scan-evidence:start -->\s*## Scanner Evidence\s*/, "")
      .replace(/\s*<!-- agendo:scan-evidence:end -->$/, "");
    const todo = {
      id: "sq-001",
      title: "Example",
      status: "pending",
      priority: "p2",
      criteria: [],
      triage: [],
      workLog: [],
      scannerEvidence: evidence,
    };
    const html = renderCanvas(todo, null, null);
    assert.match(html, /Example &lt;rule&gt;/);
    assert.match(html, /3 findings across 2 files/);
    assert.match(html, /aria-label="Scanner contents"/);
    assert.match(html, /class="toc-label">Affected Files/);
    assert.match(html, /class="toc-label">Rule Context/);
    assert.strictEqual((html.match(/<details[^>]+id="scanner-file-/g) || []).length, 2);
    assert.match(
      html,
      /id="scanner-file-src%2Fexample.ts" data-section="scanner-file-src%2Fexample.ts" open/,
    );
    const fileStart = html.indexOf('id="scanner-file-src%2Fexample.ts"');
    assert.ok(
      html.indexOf("<h4>Line 3</h4>", fileStart) < html.indexOf("<h4>Line 20</h4>", fileStart),
    );
    assert.match(html, /Line not reported/);
    assert.strictEqual((html.match(/<details[^>]+id="scanner-context-/g) || []).length, 3);
    assert.doesNotMatch(html, /id="scanner-context-\d+"[^>]* open/);
    assert.match(html, /<h3 id="scanner-context-0-heading">Why is this an issue\?/);
    assert.match(html, /<h3 id="scanner-context-1-heading">How to fix it/);
    assert.match(html, /<h3 id="scanner-context-2-heading">References/);
    assert.doesNotMatch(html, /scanner-file-fake/);
    for (const match of html.matchAll(/data-section-link="([^"]+)"/g)) {
      assert.ok(html.includes(`id="${match[1]}"`), `Missing target ${match[1]}`);
    }
    for (const match of html.matchAll(/href="#([^"]+)" data-section-link="([^"]+)"/g)) {
      assert.strictEqual(decodeURIComponent(match[1]), match[2]);
    }
    assert.doesNotMatch(
      renderCanvas({ ...todo, status: "in-progress" }, null, null),
      /id="scanner-file-[^"]+"[^>]* open/,
    );
  });

  test("file-based scanner canvas keeps multiple rule explanations separate and linked", async () => {
    const load = new Function("url", "return import(url)") as (url: string) => Promise<any>;
    const { renderCanvas } = await load(
      pathToFileURL(path.resolve(__dirname, "../../resources/canvas/agendo-work-session/page.mjs"))
        .href,
    );
    const evidence = updateScanningEvidence(
      "<!-- agendo:scan-evidence:start -->\n<!-- agendo:scan-evidence:end -->",
      [
        {
          ...finding,
          ruleTitle: "First rule",
          ruleDescription:
            "#### Why is this an issue?\n\nFirst cause.\n\n#### References\n\nFirst references.",
        },
        {
          ...finding,
          id: "43",
          rule: "ts:second",
          ruleTitle: "Second rule",
          ruleDescription:
            "#### How to fix it\n\nSecond solution.\n\n#### References\n\nSecond references.",
        },
      ],
    )
      .replace(/^<!-- agendo:scan-evidence:start -->\s*## Scanner Evidence\s*/, "")
      .replace(/\s*<!-- agendo:scan-evidence:end -->$/, "");
    const todo = {
      id: "sq-001",
      title: "src/example.ts",
      status: "pending",
      priority: "p1",
      criteria: [],
      triage: [],
      workLog: [],
      scannerEvidence: evidence,
    };
    const html = renderCanvas(todo, null, null);
    assert.match(html, /2 findings across 1 file · 2 rule types/);
    assert.strictEqual((html.match(/<details[^>]+id="scanner-file-/g) || []).length, 1);
    assert.strictEqual((html.match(/<details[^>]+id="scanner-rule-/g) || []).length, 2);
    assert.doesNotMatch(html, /id="scanner-rule-\d+"[^>]* open/);
    assert.match(html, /js\/example · First rule/);
    assert.match(html, /ts:second · Second rule/);
    assert.match(html, /<strong>Rule:<\/strong> js\/example/);
    assert.match(html, /<strong>Rule:<\/strong> ts:second/);
    assert.match(html, /<h4 id="scanner-context-0-0-heading">Why is this an issue\?/);
    assert.match(html, /<h4 id="scanner-context-1-0-heading">How to fix it/);
    assert.ok(html.indexOf("First cause.") < html.indexOf('id="scanner-rule-1"'));
    assert.ok(html.indexOf("Second solution.") > html.indexOf('id="scanner-rule-1"'));
    assert.match(html, /First references/);
    assert.match(html, /Second references/);
    assert.doesNotMatch(html, /Rule Overview/);
    for (const match of html.matchAll(/data-section-link="([^"]+)"/g)) {
      assert.ok(html.includes(`id="${match[1]}"`), `Missing multi-rule target ${match[1]}`);
    }
  });

  test("scanner contents links expand ancestors, focus targets, and retain scoped collapse state", async () => {
    const script = await fs.readFile(
      path.resolve(__dirname, "../../resources/canvas/agendo-work-session/assets/page.js"),
      "utf8",
    );
    let onClick: (event: { preventDefault: () => void }) => void = () => {};
    let onToggle = () => {};
    let focused = false;
    let scrolled = false;
    let prevented = false;
    const storage = new Map<string, string>();
    const parent = { open: false, parentElement: { closest: () => null } };
    const target = {
      open: false,
      dataset: { section: "scanner-context-0" },
      parentElement: { closest: () => parent },
      addEventListener: (_event: string, callback: () => void) => {
        onToggle = callback;
      },
      querySelector: () => ({
        focus: () => {
          focused = true;
        },
      }),
      scrollIntoView: () => {
        scrolled = true;
      },
    };
    const link = {
      dataset: { sectionLink: "scanner-context-0" },
      addEventListener: (_event: string, callback: typeof onClick) => {
        onClick = callback;
      },
    };
    runInNewContext(script, {
      document: {
        body: { dataset: { todoId: "sq-001", status: "pending", percent: "0" } },
        addEventListener: () => {},
        getElementById: (id: string) =>
          id === "status-message"
            ? { textContent: "" }
            : id === "scanner-context-0"
              ? target
              : null,
        querySelector: () => null,
        querySelectorAll: (selector: string) =>
          selector === "details.collapsible"
            ? [target]
            : selector === "[data-section-link]"
              ? [link]
              : [],
      },
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
      setInterval: () => {},
    });
    onClick({
      preventDefault: () => {
        prevented = true;
      },
    });
    assert.ok(target.open, "the target section should expand");
    assert.ok(parent.open, "the target's parent section should expand");
    assert.ok(focused, "the target heading should receive focus");
    assert.ok(scrolled, "the target section should scroll into view");
    assert.ok(prevented, "the section link should prevent default navigation");
    onToggle();
    assert.strictEqual(storage.get("agendo-section-sq-001-pending-scanner-context-0"), "1");
    assert.strictEqual(
      storage.get("agendo-section-sq-001-in-progress-scanner-context-0"),
      undefined,
    );
  });

  test("external canvas links route through the host when embedded", async () => {
    const script = await fs.readFile(
      path.resolve(__dirname, "../../resources/canvas/agendo-work-session/assets/page.js"),
      "utf8",
    );
    let onClick: ((event: { target: unknown; preventDefault: () => void }) => void) | undefined;
    let openedUrl: unknown;
    let prevented = false;
    const parent = {
      postMessage: (message: unknown, targetOrigin: string) => {
        openedUrl = message;
        assert.strictEqual(targetOrigin, "*");
      },
    };
    class LinkTarget {
      closest(selector: string) {
        assert.strictEqual(selector, 'a[target="_blank"]');
        return { href: "https://github.com/JakeRoxs/agendo/security/code-scanning/3" };
      }
    }
    runInNewContext(script, {
      Element: LinkTarget,
      URL,
      document: {
        addEventListener: (event: string, callback: typeof onClick) => {
          if (event === "click") onClick = callback;
        },
        body: { dataset: { todoId: "cql-001", status: "pending", percent: "0" } },
        getElementById: (id: string) => (id === "status-message" ? { textContent: "" } : null),
        querySelector: () => null,
        querySelectorAll: () => [],
      },
      location: { href: "http://localhost:1234/" },
      window: { parent },
      sessionStorage: { getItem: () => null, setItem: () => {} },
      setInterval: () => {},
    });
    onClick?.({
      target: new LinkTarget(),
      preventDefault: () => {
        prevented = true;
      },
    });
    assert.ok(prevented);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(openedUrl)), {
      type: "agendo:openExternal",
      url: "https://github.com/JakeRoxs/agendo/security/code-scanning/3",
    });
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
    const result = await importScanningFindings(
      config,
      repository,
      "codeql",
      "owner/repo",
      [finding, { ...finding, id: "43", severity: "critical" }],
      "rule",
    );
    assertImportCounts(result, { created: 1, updated: 0 });
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
    await importScanningFindings(
      config,
      repository,
      "codeql",
      "owner/repo",
      [{ ...finding, rule: "js/second" }],
      "rule",
    );
    assert.strictEqual(repository.getMaxId("codeql"), 2);
  });

  test("imports default to file grouping and keep file, rule, and individual identities separate", async () => {
    const findings = [
      {
        ...finding,
        ruleTitle: "First rule",
        ruleDescription: "#### Why is this an issue?\n\nFirst explanation.",
      },
      {
        ...finding,
        id: "43",
        rule: "ts:second",
        severity: "critical",
        ruleTitle: "Second rule",
        ruleDescription: "#### How to fix it\n\nSecond explanation.",
      },
      {
        ...finding,
        id: "44",
        path: "src/other.ts",
        ruleTitle: "First rule",
        ruleDescription: "#### Why is this an issue?\n\nFirst explanation.",
      },
    ];
    assertImportCounts(
      await importScanningFindings(config, repository, "sonarqube", "server#project", findings),
      { created: 2, updated: 0 },
    );
    const fileTodo = repository
      .getTodos()
      .find((todo) => todo.frontmatter.scan_target === "src/example.ts");
    assert.ok(fileTodo);
    assert.strictEqual(fileTodo.frontmatter.scan_grouping, "file");
    assert.strictEqual(fileTodo.group, undefined);
    assert.strictEqual(fileTodo.priority, "p1");
    assert.strictEqual(fileTodo.title, "src/example.ts");
    const content = await readText(fileTodo.uri);
    assert.strictEqual((content.match(/^### Rule:/gm) || []).length, 2);
    assert.match(content, /First explanation/);
    assert.match(content, /Second explanation/);
    assert.match(content, /\*\*Rule:\*\* js\/example/);
    assert.match(content, /\*\*Rule:\*\* ts:second/);
    await new StatusService(config, repository).setGroup(fileTodo, "SonarQube");
    await repository.refresh();
    await importScanningFindings(config, repository, "sonarqube", "server#project", findings);
    assert.strictEqual(
      repository.getTodos().find((todo) => todo.frontmatter.scan_target === "src/example.ts")
        ?.group,
      undefined,
    );
    assertImportCounts(
      await importScanningFindings(
        config,
        repository,
        "sonarqube",
        "server#project",
        [...findings].reverse(),
      ),
      { created: 0, updated: 0 },
    );
    assertImportCounts(
      await importScanningFindings(
        config,
        repository,
        "sonarqube",
        "server#project",
        findings,
        "rule",
      ),
      { created: 2, updated: 0 },
    );
    assertImportCounts(
      await importScanningFindings(
        config,
        repository,
        "sonarqube",
        "server#project",
        findings,
        "finding",
      ),
      { created: 3, updated: 0 },
    );
    assert.ok(
      repository
        .getTodos()
        .filter((todo) => todo.frontmatter.scan_grouping === "finding")
        .every((todo) => todo.group === "src/example.ts" || todo.group === "src/other.ts"),
    );
    assert.ok(
      repository
        .getTodos()
        .filter((todo) => todo.frontmatter.scan_grouping === "rule")
        .every((todo) => todo.group === undefined),
    );
    assert.strictEqual(repository.getTodos().length, 7);
    assert.strictEqual(
      new Set(repository.getTodos().map((todo) => todo.frontmatter.scan_identity)).size,
      7,
    );
    for (const grouping of ["file", "rule", "finding"] as const) {
      assertImportCounts(
        await importScanningFindings(
          config,
          repository,
          "sonarqube",
          "server#project",
          findings,
          grouping,
        ),
        { created: 0, updated: 0 },
      );
    }
    assert.strictEqual(repository.getMaxId("sonarqube"), 7);
  });

  test("individual imports follow stable finding IDs across location changes", async () => {
    await importScanningFindings(
      config,
      repository,
      "codeql",
      "owner/repo",
      [finding, { ...finding, id: "43" }],
      "finding",
    );
    assert.strictEqual(repository.getTodos().length, 2);
    const original = repository.getTodos().find((todo) => todo.frontmatter.scan_target === "42");
    assert.ok(original);
    assert.strictEqual(original.group, "src/example.ts");
    const status = new StatusService(config, repository);
    await status.setGroup(original, "CodeQL");
    await repository.refresh();
    const result = await importScanningFindings(
      config,
      repository,
      "codeql",
      "owner/repo",
      [{ ...finding, path: "src/moved.ts", line: 99 }],
      "finding",
    );
    assertImportCounts(result, { created: 0, updated: 2 });
    const updated = repository.getTodos().find((todo) => todo.id === original.id);
    assert.ok(updated);
    assert.strictEqual(updated.uri.toString(), original.uri.toString());
    assert.strictEqual(updated.group, "src/moved.ts");
    assert.match(await readText(updated.uri), /File: src\/moved.ts \| Line: 99/);

    await status.setGroup(updated, "Custom group");
    await repository.refresh();
    await importScanningFindings(
      config,
      repository,
      "codeql",
      "owner/repo",
      [{ ...finding, path: "src/renamed.ts" }],
      "finding",
    );
    const customized = repository.getTodos().find((todo) => todo.id === original.id);
    assert.ok(customized);
    assert.strictEqual(customized.group, "Custom group");
  });

  test("file grouping handles project-level issues and rejects unknown grouping before writes", async () => {
    await assert.rejects(
      importScanningFindings(
        config,
        repository,
        "codeql",
        "owner/repo",
        [finding],
        "invalid" as never,
      ),
      /supported scanner import grouping/,
    );
    assert.deepStrictEqual(await fs.readdir(root.fsPath), []);
    await importScanningFindings(config, repository, "sonarqube", "server#project", [
      { ...finding, path: "", line: undefined },
      { ...finding, id: "43", rule: "ts:other", path: "", line: undefined },
      { ...finding, id: "44", path: "Project-level findings" },
    ]);
    assert.strictEqual(repository.getTodos().length, 2);
    const projectTodo = repository.getTodos().find((todo) => todo.frontmatter.scan_target === "");
    assert.ok(projectTodo);
    assert.strictEqual(projectTodo.title, "Project-level findings");
    assert.match(await readText(projectTodo.uri), /Line: not reported/);
  });

  test("import picker defaults to files, forwards each grouping, and cancels before fetching", async () => {
    const service =
      require("../todos/codeScanningService") as typeof import("../todos/codeScanningService");
    const restore: Array<() => void> = [];
    const mock = (target: object, key: string, value: unknown) => {
      const descriptor = Object.getOwnPropertyDescriptor(target, key);
      Object.defineProperty(target, key, { configurable: true, value });
      restore.push(() => {
        if (descriptor) Object.defineProperty(target, key, descriptor);
      });
    };
    const callbacks = new Map<string, () => Promise<void>>();
    const subscriptions: vscode.Disposable[] = [];
    const chosen: string[] = [];
    const chosenBranches: Array<string | undefined> = [];
    const errors: string[] = [];
    let index: number | undefined = 0;
    let branchIndex = 0;
    let fetches = 0;
    try {
      mock(vscode.workspace, "isTrusted", true);
      mock(vscode.commands, "registerCommand", (id: string, callback: () => Promise<void>) => {
        callbacks.set(id, callback);
        return new vscode.Disposable(() => {});
      });
      mock(
        vscode.window,
        "showQuickPick",
        async (items: Array<{ source?: string; grouping?: string; branch?: string }>) => {
          if (items[0].source) return items[0];
          if ("branch" in items[0]) return items[branchIndex];
          assert.deepStrictEqual(
            items.map((item) => item.grouping),
            ["file", "rule", "finding"],
          );
          return index === undefined ? undefined : items[index];
        },
      );
      mock(vscode.window, "showInformationMessage", async () => undefined);
      mock(vscode.window, "showErrorMessage", async (message: string) => {
        errors.push(message);
      });
      mock(vscode.window, "withProgress", async (_options: unknown, work: () => Promise<void>) =>
        work(),
      );
      mock(service, "fetchCodeQLBranches", async () => ({
        defaultBranch: "main",
        branches: ["main", "dev"],
      }));
      mock(service, "fetchCodeQL", async (_cwd: string, _run: unknown, branch?: string) => {
        fetches++;
        return { scope: "owner/repo", ...(branch ? { branch } : {}), findings: [finding] };
      });
      mock(
        service,
        "importScanningFindings",
        async (
          _config: unknown,
          _repository: unknown,
          _source: unknown,
          _scope: unknown,
          _findings: unknown,
          grouping: string,
          options: { branch?: string },
        ) => {
          chosen.push(grouping);
          chosenBranches.push(options.branch);
          return {
            created: 1,
            updated: 0,
            refreshed: 0,
            changes: { added: 1, changed: 0, unchanged: 0, notReturned: 0, uncompared: 0 },
            reviewRequired: [],
          };
        },
      );
      registerCommands(
        { subscriptions } as never,
        {
          config: { getWorkspaceFolder: () => ({ uri: root }), codeScanningEnabled: true },
          repository: { refresh: async () => {} },
        } as never,
      );
      const command = callbacks.get(Command.ImportCodeScanning);
      assert.ok(command);
      for (index of [0, 1, 2]) {
        branchIndex = index === 2 ? 1 : 0;
        await command();
      }
      assert.deepStrictEqual(chosen, ["file", "rule", "finding"]);
      assert.deepStrictEqual(chosenBranches, [undefined, undefined, "dev"]);
      assert.strictEqual(fetches, 3);
      index = undefined;
      await command();
      assert.strictEqual(fetches, 3);
      assert.deepStrictEqual(errors, []);
    } finally {
      for (const undo of restore.reverse()) undo();
      for (const subscription of subscriptions) subscription.dispose();
    }
  });

  test("reimport preserves edits, terminal lifecycle, and identity after moves", async () => {
    await importScanningFindings(config, repository, "codeql", "owner/repo", [finding]);
    const status = new StatusService(config, repository);
    const completed = await status.setStatus(repository.getTodos()[0], "completed");
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
    assertImportCounts(result, { created: 0, updated: 1 });
    const todo = repository.getTodos()[0];
    assert.strictEqual(todo.status, "completed");
    assert.strictEqual(todo.priority, "p3");
    assert.strictEqual(todo.folder, "code-scanning/codeql/done");
    const content = await readText(todo.uri);
    assert.ok(content.includes("My investigation notes"));
    assert.ok(content.includes("Updated evidence"));
    assertImportCounts(
      await importScanningFindings(config, repository, "codeql", "owner/repo", [
        { ...finding, message: "Updated evidence" },
      ]),
      { created: 0, updated: 0 },
    );
    await importScanningFindings(config, repository, "codeql", "owner/repo", []);
    assert.strictEqual(repository.getTodos().length, 1);
    const reopened = await status.setStatus(todo, "pending");
    assert.ok(
      reopened?.path.endsWith("/code-scanning/codeql/cql-001-pending-p3-src-example-ts.md"),
    );
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

  test("branch imports have independent identities and refresh scopes", async () => {
    await importScanningFindings(config, repository, "codeql", "owner/repo", [finding]);
    await importScanningFindings(config, repository, "codeql", "owner/repo", [finding], "file", {
      branch: "dev",
    });
    assert.strictEqual(repository.getTodos().length, 2);
    assert.strictEqual(
      repository.getTodos().find((todo) => todo.frontmatter.scan_branch)?.frontmatter.scan_branch,
      "dev",
    );
    assert.strictEqual(
      repository.getTodos().filter((todo) => todo.frontmatter.scan_branch === undefined).length,
      1,
    );

    const branchResult = await importScanningFindings(
      config,
      repository,
      "codeql",
      "owner/repo",
      [finding],
      "file",
      { branch: "dev" },
    );
    assert.strictEqual(branchResult.refreshed, 1);
    const result = await importScanningFindings(config, repository, "codeql", "owner/repo", [
      finding,
    ]);
    assert.strictEqual(result.refreshed, 1);
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
        /Save todo changes/,
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

  test("CodeQL adapter filters alerts by the selected branch", async () => {
    let alertsRequest = "";
    const scan = await fetchCodeQL(
      root.fsPath,
      async (args) => {
        if (args[0] === "api") alertsRequest = args[1];
        return {
          stdout:
            args[0] === "repo"
              ? "owner/repo\n"
              : JSON.stringify([
                  [
                    {
                      number: 7,
                      rule: { id: "js/rule" },
                      most_recent_instance: {
                        location: { path: "src/example.ts" },
                        message: { text: "Issue" },
                      },
                    },
                  ],
                ]),
        };
      },
      "feature/branch-selector",
    );
    assert.strictEqual(scan.branch, "feature/branch-selector");
    assert.strictEqual(scan.findings.length, 1);
    assert.strictEqual(
      new URL(`https://api.github.com/${alertsRequest}`).searchParams.get("ref"),
      "refs/heads/feature/branch-selector",
    );
    assert.strictEqual(
      new URL(scan.findings[0].url).searchParams.get("ref"),
      "refs/heads/feature/branch-selector",
    );
  });

  test("CodeQL branch discovery returns the repository default branch", async () => {
    const calls: string[][] = [];
    const branches = await fetchCodeQLBranches(root.fsPath, async (args) => {
      calls.push(args);
      return {
        stdout:
          args[0] === "repo"
            ? JSON.stringify({
                nameWithOwner: "owner/repo",
                defaultBranchRef: { name: "main" },
              })
            : JSON.stringify([[{ name: "main" }, { name: "dev" }]]),
      };
    });
    assert.deepStrictEqual(branches, { defaultBranch: "main", branches: ["main", "dev"] });
    assert.ok(calls[1][1].includes("branches?per_page=100"));
    assert.ok(calls[1].includes("--paginate"));
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
      if (requests[requests.length - 1].pathname.endsWith("/api/measures/component")) {
        return new Response(
          JSON.stringify({
            component: {
              measures: [
                { metric: "duplicated_lines", value: "0" },
                { metric: "duplicated_lines_density", value: "0" },
              ],
            },
          }),
        );
      }
      if (requests[requests.length - 1].pathname.endsWith("/api/rules/show")) {
        return new Response(
          JSON.stringify({
            rule: {
              key: "ts:S1",
              name: "Use a comparison function",
              descriptionSections: [
                {
                  key: "root_cause",
                  content: "<p>Why this matters.</p><pre>items.sort((a, b) =&gt; a - b);</pre>",
                },
              ],
            },
          }),
        );
      }
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
        undefined,
        undefined,
        "feature/branch-selector",
      );
      assert.strictEqual(result.branch, "feature/branch-selector");
      assert.strictEqual(result.findings.length, 2);
      assert.strictEqual(result.findings[0].path, "src/example.ts");
      assert.strictEqual(requests[0].pathname, "/context/api/issues/search");
      assert.strictEqual(requests[1].searchParams.get("p"), "2");
      assert.strictEqual(requests[0].searchParams.get("branch"), "feature/branch-selector");
      assert.strictEqual(requests[0].searchParams.get("componentKeys"), "org:project");
      assert.strictEqual(
        requests.length,
        4,
        "fetch issues, rule explanation, and duplication metrics",
      );
      const ruleRequest = requests.find((r) => r.pathname.endsWith("/api/rules/show"));
      assert.strictEqual(ruleRequest?.searchParams.get("key"), "ts:S1");
      assert.strictEqual(result.findings[0].ruleTitle, "Use a comparison function");
      assert.strictEqual(
        new URL(result.findings[0].url).searchParams.get("branch"),
        "feature/branch-selector",
      );
      assert.match(result.findings[0].ruleDescription || "", /Why this matters/);
      assert.match(
        result.findings[0].ruleDescription || "",
        /```\nitems.sort\(\(a, b\) => a - b\);\n```/,
      );
      await importScanningFindings(
        config,
        repository,
        "sonarqube",
        result.scope,
        result.findings,
        "file",
        { branch: result.branch },
      );
      const content = await readText(repository.getTodos()[0].uri);
      assert.strictEqual(
        repository.getTodos()[0].frontmatter.scan_branch,
        "feature/branch-selector",
      );
      assert.match(content, /\*\*Branch:\*\* feature\/branch-selector/);
      assert.match(content, /### Rule: Use a comparison function/);
      assert.match(content, /Why this matters/);
      const updated = updateScanningEvidence(
        `${content}\nPersonal notes stay here.\n`,
        result.findings,
      );
      assert.match(updated, /Personal notes stay here/);
    } finally {
      globalThis.fetch = original;
    }
  });

  test("SonarQube branch discovery includes the main branch and encoded project key", async () => {
    let request: URL | undefined;
    const branches = await fetchSonarQubeBranches(
      "https://sonar.example/context",
      "org:project & test",
      "test-token",
      async (url) => {
        request = url;
        return {
          branches: [
            { name: "main", isMain: true },
            { name: "feature/branch-selector", isMain: false },
          ],
        };
      },
    );
    assert.strictEqual(request?.pathname, "/context/api/project_branches/list");
    assert.strictEqual(request?.searchParams.get("project"), "org:project & test");
    assert.deepStrictEqual(branches, {
      defaultBranch: "main",
      branches: ["main", "feature/branch-selector"],
    });
  });

  test("SonarQube rule context supports legacy descriptions and rejects invalid rule responses", async () => {
    for (const description of [
      {
        htmlDesc:
          '<h2>Exceptions</h2><p>Explanation</p><script>alert("unsafe")</script><pre>const x = &lt;value&gt;;</pre><p><a href="https://example.com/rule">Reference</a></p>',
      },
      {
        mdDesc:
          "Explanation\n\n```\nconst x = <value>;\n```\n\n[Reference](https://example.com/rule)",
      },
    ]) {
      const scan = await fetchSonarQube("https://sonar.example", "project", "", async (url) =>
        url.pathname.endsWith("/rules/show")
          ? { rule: { key: "ts:example", name: "Rule title", ...description } }
          : {
              issues: [
                {
                  key: "issue",
                  rule: "ts:example",
                  severity: "MAJOR",
                  message: "Issue",
                  component: "project:file.ts",
                },
              ],
              paging: { total: 1 },
            },
      );
      assert.match(scan.findings[0].ruleDescription || "", /Explanation/);
      assert.match(scan.findings[0].ruleDescription || "", /const x = <value>;/);
      assert.match(scan.findings[0].ruleDescription || "", /https:\/\/example.com\/rule/);
      assert.doesNotMatch(scan.findings[0].ruleDescription || "", /alert|<script>/i);
      if ("htmlDesc" in description)
        assert.match(scan.findings[0].ruleDescription || "", /##### Exceptions/);
    }
    await assert.rejects(
      fetchSonarQube("https://sonar.example", "project", "", async (url) =>
        url.pathname.endsWith("/rules/show")
          ? { rule: { key: "wrong", name: "Wrong" } }
          : {
              issues: [
                {
                  key: "issue",
                  rule: "ts:example",
                  severity: "MAJOR",
                  message: "Issue",
                  component: "project:file.ts",
                },
              ],
              paging: { total: 1 },
            },
      ),
      /Unexpected SonarQube rule response/,
    );
  });

  test("SonarQube CLI imports share pagination, encoding, and identity with direct imports", async () => {
    const calls: string[][] = [];
    const run = async (args: string[], cwd: string) => {
      assert.strictEqual(cwd, root.fsPath);
      calls.push(args);
      if (args[0] === "auth") {
        assert.deepStrictEqual(args, ["auth", "status", "--format", "json"]);
        return JSON.stringify({ status: "connected", server: "https://sonar.example/context" });
      }
      assert.deepStrictEqual(args.slice(0, 2), ["api", "get"]);
      const url = new URL(args[2], "https://sonar.example");
      if (url.pathname === "/api/measures/component") {
        return JSON.stringify({
          component: {
            measures: [
              { metric: "duplicated_lines", value: "0" },
              { metric: "duplicated_lines_density", value: "0" },
            ],
          },
        });
      }
      if (url.pathname === "/api/rules/show") {
        assert.strictEqual(url.searchParams.get("key"), "ts:example");
        return JSON.stringify({
          rule: { key: "ts:example", name: "Example rule", htmlDesc: "<p>Rule explanation</p>" },
        });
      }
      assert.strictEqual(url.pathname, "/api/issues/search");
      assert.strictEqual(url.searchParams.get("componentKeys"), "org:project & test");
      assert.strictEqual(url.searchParams.get("ps"), "500");
      return JSON.stringify({
        issues: [
          {
            key: `issue-${url.searchParams.get("p")}`,
            rule: "ts:example",
            severity: "MAJOR",
            component: "org:project & test:src/example.ts",
            message: "Example",
          },
        ],
        paging: { total: 2 },
      });
    };
    const result = await fetchSonarQubeCli(
      root.fsPath,
      "https://sonar.example/context/",
      "org:project & test",
      run,
      "feature/branch-selector",
    );
    const callTypes = calls.map((args) => args[0]);
    assert.strictEqual(callTypes.filter((t) => t === "auth").length, 8);
    assert.strictEqual(callTypes.filter((t) => t === "api").length, 4);
    assert.strictEqual(result.scope, "https://sonar.example/context/#org:project & test");
    assert.strictEqual(result.branch, "feature/branch-selector");
    assert.strictEqual(result.findings.length, 2);
    assert.strictEqual(result.findings[0].path, "src/example.ts");
    assert.strictEqual(result.findings[0].ruleDescription, "Rule explanation");
    assert.strictEqual(new URL(result.findings[0].url).pathname, "/context/project/issues");
    assert.strictEqual(new URL(calls[4][2], "https://sonar.example").searchParams.get("p"), "2");
    assert.strictEqual(
      new URL(calls[1][2], "https://sonar.example").searchParams.get("branch"),
      "feature/branch-selector",
    );
    assert.strictEqual(
      new URL(result.findings[0].url).searchParams.get("branch"),
      "feature/branch-selector",
    );
  });

  test("SonarQube CLI lists branches through its active connection", async () => {
    const calls: string[][] = [];
    const branches = await fetchSonarQubeCliBranches(
      root.fsPath,
      "https://sonar.example/context",
      "project",
      async (args) => {
        calls.push(args);
        if (args[0] === "auth") {
          return JSON.stringify({ status: "connected", server: "https://sonar.example/context/" });
        }
        return JSON.stringify({
          branches: [
            { name: "main", isMain: true },
            { name: "dev", isMain: false },
          ],
        });
      },
    );
    assert.deepStrictEqual(branches, { defaultBranch: "main", branches: ["main", "dev"] });
    const apiCall = calls.find((args) => args[0] === "api");
    assert.ok(apiCall);
    assert.strictEqual(
      new URL(apiCall[2], "https://sonar.example").pathname,
      "/api/project_branches/list",
    );
  });

  test("SonarQube CLI connection changes during or between pages prevent all todo writes", async () => {
    for (const changeAtCheck of [2, 3, 4]) {
      let checks = 0;
      let pages = 0;
      const run = async (args: string[]) => {
        if (args[0] === "auth") {
          checks++;
          return JSON.stringify({
            status: "connected",
            server: checks >= changeAtCheck ? "https://other.example" : "https://sonar.example",
          });
        }
        pages++;
        return JSON.stringify({
          issues: [
            {
              key: `issue-${pages}`,
              rule: "ts:example",
              severity: "MAJOR",
              component: "project:src/example.ts",
              message: "Example",
            },
          ],
          paging: { total: 2 },
        });
      };
      await assert.rejects(async () => {
        const scan = await fetchSonarQubeCli(root.fsPath, "https://sonar.example", "project", run);
        await importScanningFindings(config, repository, "sonarqube", scan.scope, scan.findings);
      }, /connection changed/);
      assert.strictEqual(checks, changeAtCheck);
      assert.strictEqual(pages, changeAtCheck === 4 ? 2 : 1);
      await repository.refresh();
      assert.deepStrictEqual(repository.getTodos(), []);
      assert.deepStrictEqual(await fs.readdir(root.fsPath), []);
    }
  });

  test("SonarQube CLI refuses disconnected, invalid, or changed connections", async () => {
    await assert.rejects(
      sonarQubeCliServer(root.fsPath, async () => '{"status":"disconnected"}'),
      /not connected/,
    );
    await assert.rejects(
      sonarQubeCliServer(root.fsPath, async () => "not json"),
      SyntaxError,
    );
    await assert.rejects(
      sonarQubeCliServer(root.fsPath, async () =>
        JSON.stringify({ status: "connected", server: "http://remote.example" }),
      ),
      /HTTPS/,
    );
    await assert.rejects(
      fetchSonarQubeCli(root.fsPath, "https://expected.example", "project", async (args) => {
        assert.strictEqual(args[0], "auth");
        return JSON.stringify({ status: "connected", server: "https://different.example" });
      }),
      /connection changed/,
    );
  });

  test("SonarQube CLI errors and malformed or incomplete API results abort imports", async () => {
    for (const payload of ["not json", "{}", '{"issues":[],"paging":{"total":1}}']) {
      await assert.rejects(
        fetchSonarQubeCli(root.fsPath, "https://sonar.example", "project", async (args) =>
          args[0] === "auth"
            ? JSON.stringify({ status: "connected", server: "https://sonar.example" })
            : payload,
        ),
      );
    }
    await assert.rejects(
      fetchSonarQubeCli(root.fsPath, "https://sonar.example", "project", async () => {
        throw new Error("CLI unavailable");
      }),
      /CLI unavailable/,
    );
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

  test("pending canvas exposes scanner context without confusing examples with editable criteria", async () => {
    const dir = path.join(root.fsPath, "docs", "todos", "code-scanning", "sonarqube");
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, "sq-001-pending-p1-example.md");
    const content = [
      "---",
      "status: pending",
      "---",
      "# Scanner example",
      "",
      "Review this finding.",
      "",
      "<!-- agendo:scan-evidence:start -->",
      "## Scanner Evidence",
      "",
      "### Rule: Example rule",
      "",
      "A useful explanation <script>alert(1)</script>.",
      "",
      "```",
      "## Acceptance Criteria",
      "- [ ] Scanner example only",
      "```",
      "",
      "## Findings",
      "Not user triage.",
      "",
      "[View issue](<https://sonar.example/project/issues?id=project&issues=issue>)",
      "",
      "<!-- agendo:scan-evidence:end -->",
      "",
      "## Acceptance Criteria",
      "",
      "- [ ] User criterion",
      "",
    ].join("\n");
    await fs.writeFile(file, content);
    const load = new Function("url", "return import(url)") as (url: string) => Promise<any>;
    const canvasDir = path.resolve(__dirname, "../../resources/canvas/agendo-work-session");
    const todos = await load(pathToFileURL(path.join(canvasDir, "todos.mjs")).href);
    const page = await load(pathToFileURL(path.join(canvasDir, "page.mjs")).href);
    const todo = todos.loadTodo("sq-001", root.fsPath);
    assert.deepStrictEqual(todo.criteria, [{ met: false, text: "User criterion" }]);
    assert.deepStrictEqual(todo.triage, []);
    assert.doesNotMatch(todo.description, /agendo:scan|useful explanation/);
    assert.match(todo.scannerEvidence, /useful explanation/);
    const pending = page.renderCanvas(todo, null, null);
    assert.doesNotMatch(pending, /Needs triage/);
    assert.doesNotMatch(pending, /No triage notes yet/);
    assert.match(pending, /status-help/);
    assert.match(pending, /Not started/);
    assert.match(pending, /id="scanner" data-section="scanner" open/);
    assert.ok(pending.indexOf('id="scanner"') < pending.indexOf('id="criteria"'));
    assert.doesNotMatch(pending, /id="criteria" data-section="criteria" open/);
    assert.match(pending, /&lt;script&gt;/);
    assert.doesNotMatch(pending, /<script>alert/);
    assert.match(
      pending,
      /href="https:\/\/sonar.example\/project\/issues\?id=project&amp;issues=issue"/,
    );
    assert.doesNotMatch(pending, /agendo:scan-evidence/);
    const active = page.renderCanvas({ ...todo, status: "in-progress" }, null, null);
    assert.doesNotMatch(active, /Needs triage/);
    assert.doesNotMatch(active, /id="scanner" data-section="scanner" open/);
    assert.match(active, /id="criteria" data-section="criteria" open/);
    todos.setCriterionMet("sq-001", 0, true, root.fsPath);
    const updated = await fs.readFile(file, "utf8");
    assert.match(updated, /- \[x\] User criterion/);
    assert.match(updated, /- \[ \] Scanner example only/);
    assert.deepStrictEqual(todos.loadTodo("sq-001", root.fsPath).criteria, [
      { met: true, text: "User criterion" },
    ]);
  });

  test("canvas discovers scanner IDs and keeps custom source lifecycle folders", async () => {
    const workspace = path.join(root.fsPath, "workspace");
    const todoRoot = path.join(workspace, "docs", "todos");
    const sourceDir = path.join(todoRoot, "code-scanning", "codeql");
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.writeFile(
      path.join(todoRoot, ".agendo-config.json"),
      JSON.stringify({ completedFolder: "done" }),
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
    canvas.setTodoStatus("cql-001", "completed", workspace);
    assert.ok(
      canvas
        .findTodoFile("cql-001", workspace)
        .endsWith("code-scanning/codeql/done/cql-001-completed-p2-example.md"),
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
      assert.ok(html.includes("cql · #001 CodeQL finding"));
      assert.ok(html.includes("sq · #001 SonarQube finding"));
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
    assert.ok(withoutEdit.includes('class="canvas-toolbar"'));
    assert.ok(withoutEdit.includes("data-settings"));
  });

  test("canvas labels omit redundant scanner prefixes while all navigation keeps full IDs", async () => {
    const load = new Function("url", "return import(url)") as (url: string) => Promise<any>;
    const { renderCanvas } = await load(
      pathToFileURL(path.resolve(__dirname, "../../resources/canvas/agendo-work-session/page.mjs"))
        .href,
    );
    const recent = [
      { id: "sq-002", title: "src/foo.ts", status: "pending", current: true },
      { id: "sq-001", title: "src/bar.ts", status: "pending" },
      { id: "cql-001", title: "src/baz.ts", status: "ready" },
      { id: "001", title: "a regular task", status: "ready" },
    ];
    const todo = { ...recent[0], priority: "p1", criteria: [], triage: [], workLog: [] };
    const relations = {
      blocked: true,
      dependencies: [
        { ...recent[1], priority: "p1", satisfied: false },
        { ...recent[2], priority: "p2", satisfied: false },
        { id: "sq-999", missing: true, satisfied: false },
      ],
      dependents: [],
    };
    const html = renderCanvas(todo, relations, { canBack: true, canForward: false, recent });
    assert.match(html, /<title>src\/foo\.ts<\/title>/);
    assert.match(html, /<h1><span class="todo-id">#002<\/span>src\/foo\.ts<\/h1>/);
    assert.match(html, /sq · #002 src\/foo\.ts/);
    assert.match(html, /cql · #001 src\/baz\.ts/);
    assert.match(html, /source-sonarqube[^>]*>sq<\/span> #001<\/button>/);
    assert.match(html, /source-codeql[^>]*>cql<\/span> #001<\/button>/);
    assert.match(html, /class="todo-id">#999<\/span>/);
    assert.match(html, /data-todo-id="sq-002"/);
    assert.match(html, /data-open="sq-001"/);
    assert.match(html, /data-open="cql-001"/);
    assert.match(html, /todo · #001 a regular task/);
    const visibleText = html.replace(/<[^>]*>/g, " ");
    assert.doesNotMatch(visibleText, /(?:sq|cql)-\d+/);
    assert.doesNotMatch(visibleText, /typescript:|js\//);
    const fileHtml = renderCanvas({ ...todo, title: "src/foo\\_bar.ts" }, null, null);
    assert.match(fileHtml, /<h1><span class="todo-id">#002<\/span>src\/foo_bar.ts<\/h1>/);
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
        addEventListener: () => {},
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

  test("findings checklist serialization and reconciliation", async () => {
    const { buildFindingsChecklist, updateFindingsChecklist } =
      require("../todos/codeScanningService");
    const finding1: ScanningFinding = {
      id: "cql-100",
      rule: "js/test-rule",
      severity: "high",
      message: "Test finding",
      path: "src/test.ts",
      line: 5,
      url: "https://github.com/owner/repo/security/code-scanning/100",
    };
    const finding2: ScanningFinding = {
      id: "cql-101",
      rule: "js/other-rule",
      severity: "medium",
      message: "Other finding",
      path: "src/other.ts",
      line: 10,
      url: "https://github.com/owner/repo/security/code-scanning/101",
    };

    const checklist = buildFindingsChecklist([finding1, finding2]);
    assert.ok(checklist.includes("### Findings"));
    assert.ok(checklist.includes("[cql-100]"));
    assert.ok(checklist.includes("[cql-101]"));
    assert.ok(checklist.includes("js/test-rule"));
    assert.ok(checklist.includes("src/test.ts:5"));

    const content = [
      "---",
      "status: pending",
      "priority: p1",
      'issue_id: "cql-001"',
      "tags: [code-scanning, codeql]",
      "scan_identity: test",
      "scan_source: codeql",
      'scan_scope: "owner/repo"',
      "scan_grouping: finding",
      'scan_target: "cql-100"',
      "---",
      "",
      "# test",
      "",
      "Review these scanner findings.",
      "",
      "<!-- agendo:scan-evidence:start -->",
      "## Scanner Evidence",
      "<!-- agendo:scan-evidence:end -->",
      "",
      "## Acceptance Criteria",
      "",
      checklist,
      "",
      "- [ ] Verify changes with tests and a new scan",
      "",
      "## Work Log",
      "",
    ].join("\n");

    const snapshot = {
      version: 1,
      source: "codeql" as const,
      scope: "owner/repo",
      grouping: "finding" as const,
      target: "cql-100",
      retrievedAt: new Date().toISOString(),
      findings: [
        { ...finding1, returned: true },
        { ...finding2, returned: false },
      ],
      rules: [],
    };
    const updated = updateFindingsChecklist(content, [finding1], snapshot);
    assert.ok(updated.includes("[cql-100]"));
    assert.ok(updated.includes("(not returned)"));
    assert.ok(updated.includes("Verify changes with tests and a new scan"));

    // Verify checked state is preserved across refreshes
    const checkedContent = updated.replace("- [ ] [cql-100]", "- [x] [cql-100]");
    const refreshed = updateFindingsChecklist(checkedContent, [finding1], snapshot);
    assert.ok(refreshed.includes("- [x] [cql-100]"));
    assert.ok(refreshed.includes("(not returned)"));
  });

  test("mixed existing and new imports allocate one ID per new import and aggregate changes", async () => {
    const seeded = await importScanningFindings(
      config,
      repository,
      "codeql",
      "owner/repo",
      [finding],
      "finding",
    );
    assertImportCounts(seeded, { created: 1, updated: 0 });
    assert.strictEqual(seeded.refreshed, 0);
    assert.strictEqual(repository.getMaxId("codeql"), 1);

    const result = await importScanningFindings(
      config,
      repository,
      "codeql",
      "owner/repo",
      [finding, { ...finding, id: "43", rule: "js/second" }],
      "finding",
    );
    assertImportCounts(result, { created: 1, updated: 0 });
    assert.strictEqual(result.refreshed, 1);
    assert.strictEqual(result.created, 1);
    assert.strictEqual(result.updated, 0);

    assert.strictEqual(repository.getMaxId("codeql"), 2);
    const newTodo = repository.getTodos().find((todo) => todo.id === "cql-002");
    assert.ok(newTodo);
    assert.strictEqual(newTodo.frontmatter.scan_target, "43");
    assert.strictEqual(newTodo.frontmatter.scan_source, "codeql");
    assert.strictEqual(newTodo.frontmatter.scan_scope, "owner/repo");
    assert.strictEqual(newTodo.frontmatter.scan_grouping, "finding");

    assert.deepStrictEqual(result.changes, {
      added: 1,
      changed: 0,
      unchanged: 1,
      notReturned: 0,
      uncompared: 0,
    });

    const content = await readText(newTodo.uri);
    assert.match(content, /scan_refreshed_at:/);
    assert.match(content, /js\/second/);
    const existingTodo = repository.getTodos().find((todo) => todo.id === "cql-001");
    assert.ok(existingTodo);
    assert.match(await readText(existingTodo.uri), /js\/example/);

    const changed = await importScanningFindings(
      config,
      repository,
      "codeql",
      "owner/repo",
      [{ ...finding, message: "Updated evidence" }, { ...finding, id: "43", rule: "js/second" }],
      "finding",
    );
    assert.strictEqual(changed.created, 0);
    assert.strictEqual(changed.refreshed, 2);
    assert.strictEqual(changed.updated, 1);
    assert.strictEqual(repository.getMaxId("codeql"), 2);
    assert.deepStrictEqual(changed.changes, {
      added: 0,
      changed: 1,
      unchanged: 1,
      notReturned: 0,
      uncompared: 0,
    });
  });

  test("updateScanningEvidence accepts exactly one START/END marker pair", () => {
    const content =
      "<!-- agendo:scan-evidence:start -->\nOld evidence\n<!-- agendo:scan-evidence:end -->\nPersonal notes\n";
    const updated = updateScanningEvidence(content, [finding]);
    assert.match(updated, /### Affected Locations/);
    assert.match(updated, /#### File: src\/example.ts \| Line: 10/);
    assert.ok(updated.endsWith("Personal notes\n"));
  });

  test("updateScanningEvidence rejects duplicate START markers", () => {
    const content =
      "<!-- agendo:scan-evidence:start -->\n<!-- agendo:scan-evidence:start -->\nOld evidence\n<!-- agendo:scan-evidence:end -->\n";
    assert.throws(() => updateScanningEvidence(content, [finding]), /markers are missing/);
  });

  test("updateScanningEvidence rejects duplicate END markers", () => {
    const content =
      "<!-- agendo:scan-evidence:start -->\nOld evidence\n<!-- agendo:scan-evidence:end -->\n<!-- agendo:scan-evidence:end -->\n";
    assert.throws(() => updateScanningEvidence(content, [finding]), /markers are missing/);
  });

  test("updateScanningEvidence rejects inverted markers (END before START)", () => {
    const content =
      "<!-- agendo:scan-evidence:end -->\nOld evidence\n<!-- agendo:scan-evidence:start -->\n";
    assert.throws(() => updateScanningEvidence(content, [finding]), /markers are missing/);
  });

  test("updateScanningEvidence rejects reimport with duplicate START markers", async () => {
    await importScanningFindings(config, repository, "codeql", "owner/repo", [finding], "finding");
    const todo = repository.getTodos()[0];
    const content = await readText(todo.uri);
    const dirty = content.replace(
      "<!-- agendo:scan-evidence:start -->",
      "<!-- agendo:scan-evidence:start -->\n<!-- agendo:scan-evidence:start -->",
    );
    await vscode.workspace.fs.writeFile(todo.uri, Buffer.from(dirty, "utf8"));
    await assert.rejects(
      importScanningFindings(config, repository, "codeql", "owner/repo", [finding], "finding"),
      /markers are missing/,
    );
  });

  test("auto-completes scanner todo when all findings are resolved", async () => {
    await importScanningFindings(config, repository, "codeql", "owner/repo", [finding], "finding");
    assert.strictEqual(repository.getTodos().length, 1);
    const todo = repository.getTodos()[0];
    assert.strictEqual(todo.status, "pending");
    assert.ok(todo.folder === "code-scanning/codeql");

    const result = await importScanningFindings(
      config,
      repository,
      "codeql",
      "owner/repo",
      [{ ...finding, resolved: true }],
      "finding",
    );
    assert.strictEqual(result.autoCompleted, 1);
    assert.strictEqual(result.refreshed, 1);
    assert.strictEqual(result.updated, 1);

    const completed = repository.getTodos().find((t) => t.id === todo.id);
    assert.ok(completed);
    assert.strictEqual(completed.status, "completed");
    assert.ok(completed.folder.includes("done"));
    assert.ok(completed.fileName.includes("-completed-"));

    const content = await readText(completed.uri);
    assert.match(content, /^status: completed$/m);
    assert.match(content, /Auto-completed by scanner import/);
    assert.match(content, /scan_identity:/);
    assert.match(content, /scan_source: codeql/);
    assert.match(content, /scan_scope: "owner\/repo"/);
    assert.match(content, /scan_grouping: finding/);
    assert.match(content, /scan_target: "42"/);
    assert.match(content, /<!-- agendo:scan-evidence:start -->/);
    assert.match(content, /<!-- agendo:scan-evidence:end -->/);
    assert.match(content, /scan_refreshed_at:/);
    // The pending file should have been moved; no pending version remains.
    assert.ok(
      !repository
        .getTodos()
        .some((t) => t.id === todo.id && t.status !== "completed"),
    );
  });

  test("keeps scanner todo status when some findings are resolved and some remain open", async () => {
    const findings = [
      finding,
      { ...finding, id: "43", rule: "js/second", path: "src/example.ts" },
    ];
    await importScanningFindings(
      config,
      repository,
      "codeql",
      "owner/repo",
      findings,
      "file",
    );
    assert.strictEqual(repository.getTodos().length, 1);
    const todo = repository.getTodos()[0];
    assert.strictEqual(todo.status, "pending");

    // Re-import with only the first finding resolved; the second remains open.
    const result = await importScanningFindings(
      config,
      repository,
      "codeql",
      "owner/repo",
      [{ ...finding, resolved: true }, { ...finding, id: "43", rule: "js/second" }],
      "file",
    );
    assert.strictEqual(result.autoCompleted, 0);
    assert.strictEqual(result.refreshed, 1);

    await repository.refresh();
    const unchanged = repository.getTodos().find((t) => t.id === todo.id);
    assert.ok(unchanged);
    assert.strictEqual(unchanged.status, "pending");
    assert.strictEqual(unchanged.folder, "code-scanning/codeql");

    const content = await readText(unchanged.uri);
    assert.match(content, /^status: pending$/m);
    assert.match(content, /scan_identity:/);
    assert.match(content, /<!-- agendo:scan-evidence:start -->/);
    assert.match(content, /<!-- agendo:scan-evidence:end -->/);
  });

  test("does not auto-complete when findings are unchanged (no fixed findings)", async () => {
    await importScanningFindings(config, repository, "codeql", "owner/repo", [finding], "finding");
    assert.strictEqual(repository.getTodos().length, 1);
    const todo = repository.getTodos()[0];
    assert.strictEqual(todo.status, "pending");

    const result = await importScanningFindings(
      config,
      repository,
      "codeql",
      "owner/repo",
      [finding],
      "finding",
    );
    assert.strictEqual(result.autoCompleted, 0);
    assert.strictEqual(result.refreshed, 1);

    await repository.refresh();
    const unchanged = repository.getTodos().find((t) => t.id === todo.id);
    assert.ok(unchanged);
    assert.strictEqual(unchanged.status, "pending");
    assert.strictEqual(unchanged.folder, "code-scanning/codeql");

    const content = await readText(unchanged.uri);
    assert.match(content, /^status: pending$/m);
    assert.match(content, /scan_identity:/);
    assert.match(content, /<!-- agendo:scan-evidence:start -->/);
    assert.match(content, /<!-- agendo:scan-evidence:end -->/);
  });
});
