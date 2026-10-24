import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import * as vscode from "vscode";
import type { ConfigService } from "./configService";
import { readText } from "./fileSystem";
import { buildFileName, SCANNING_ID_PREFIX, type TodoPriority } from "./todoModel";
import type { TodoRepository } from "./todoRepository";

export type ScanningSource = "codeql" | "sonarqube";
export interface ScanningFinding {
  id: string;
  rule: string;
  severity: string;
  message: string;
  path: string;
  line?: number;
  url: string;
}

const START = "<!-- agendo:scan-evidence:start -->";
const END = "<!-- agendo:scan-evidence:end -->";
const exec = promisify(execFile);

export function scanningPriority(severity: string): TodoPriority {
  switch (severity.toLowerCase()) {
    case "blocker":
    case "critical":
    case "high":
    case "error":
      return "p1";
    case "minor":
    case "low":
    case "info":
    case "note":
    case "recommendation":
      return "p3";
    default:
      return "p2";
  }
}

function text(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/[\\`*_{}[\]<>#|!]/g, "\\$&");
}

function evidence(findings: ScanningFinding[]): string {
  const rows = [...findings]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (finding) =>
        `- [${text(finding.id)}](<${finding.url.replace(/[<>\r\n]/g, "")}>) | ${text(finding.severity)} | ${text(finding.path)}${finding.line ? `:${finding.line}` : ""} | ${text(finding.message)}`,
    );
  return `${START}\n## Scanner Evidence\n\n${rows.join("\n")}\n${END}`;
}

/** Only replace scanner-owned evidence, never lifecycle fields or user-authored sections. */
export function updateScanningEvidence(content: string, findings: ScanningFinding[]): string {
  const start = content.indexOf(START);
  const end = content.indexOf(END, start);
  if (start < 0 || end < start) {
    throw new Error("Scanner evidence markers are missing; restore them before importing again.");
  }
  return content.slice(0, start) + evidence(findings) + content.slice(end + END.length);
}

export function validateSonarUrl(value: string): URL {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Use an HTTPS SonarQube server URL (HTTP is allowed only on loopback), without credentials, query, or fragment.",
    );
  }
  url.pathname = `${url.pathname.replace(/\/$/, "")}/`;
  return url;
}

export async function fetchCodeQL(
  cwd: string,
  run: (
    args: string[],
    options: { cwd: string; timeout: number; maxBuffer?: number },
  ) => Promise<{ stdout: string }> = (args, options) => exec("gh", args, options),
): Promise<{ scope: string; findings: ScanningFinding[] }> {
  const { stdout: repoOutput } = await run(
    ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
    { cwd, timeout: 30_000 },
  );
  const scope = repoOutput.trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(scope)) {
    throw new Error("Unable to determine the GitHub repository from gh.");
  }
  const { stdout } = await run(
    [
      "api",
      `repos/${scope}/code-scanning/alerts?state=open&per_page=100&tool_name=CodeQL`,
      "--paginate",
      "--slurp",
    ],
    { cwd, timeout: 120_000, maxBuffer: 32 * 1024 * 1024 },
  );
  const pages = JSON.parse(stdout) as Array<
    Array<{
      number: number;
      rule: { id: string; severity?: string; security_severity_level?: string };
      most_recent_instance: {
        location: { path: string; start_line?: number };
        message: { text: string };
      };
    }>
  >;
  if (!Array.isArray(pages) || !pages.every(Array.isArray)) {
    throw new Error("Unexpected GitHub code-scanning response.");
  }
  const findings = pages.flat().map((alert) => ({
    id: String(alert.number),
    rule: alert.rule.id,
    severity: alert.rule.security_severity_level || alert.rule.severity || "warning",
    message: alert.most_recent_instance.message.text,
    path: alert.most_recent_instance.location.path,
    line: alert.most_recent_instance.location.start_line,
    url: `https://github.com/${scope}/security/code-scanning/${alert.number}`,
  }));
  return { scope, findings };
}

export async function fetchSonarQube(
  server: string,
  project: string,
  token: string,
): Promise<{ scope: string; findings: ScanningFinding[] }> {
  const base = validateSonarUrl(server);
  const findings: ScanningFinding[] = [];
  for (let page = 1; ; page++) {
    const url = new URL("api/issues/search", base);
    url.search = new URLSearchParams({
      componentKeys: project,
      resolved: "false",
      ps: "500",
      p: String(page),
    }).toString();
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}` },
      signal: AbortSignal.timeout(30_000),
      redirect: "error",
    });
    if (!response.ok) {
      throw new Error(
        `SonarQube request failed (HTTP ${response.status}). Check the server, project key, and token.`,
      );
    }
    const payload = (await response.json()) as {
      issues: Array<{
        key: string;
        rule: string;
        severity: string;
        message: string;
        component: string;
        line?: number;
      }>;
      paging: { total: number };
    };
    if (
      !Array.isArray(payload.issues) ||
      !Number.isInteger(payload.paging?.total) ||
      payload.paging.total < 0
    ) {
      throw new Error("Unexpected SonarQube issues response.");
    }
    for (const issue of payload.issues) {
      const link = new URL("project/issues", base);
      link.search = new URLSearchParams({ id: project, issues: issue.key }).toString();
      findings.push({
        id: issue.key,
        rule: issue.rule,
        severity: issue.severity,
        message: issue.message,
        path: issue.component.startsWith(`${project}:`)
          ? issue.component.slice(project.length + 1)
          : issue.component,
        line: issue.line,
        url: link.toString(),
      });
    }
    if (findings.length >= payload.paging.total) {
      break;
    }
    if (!payload.issues.length || page >= 20) {
      throw new Error(
        "SonarQube results are incomplete or exceed its 10,000-issue search limit. No todos were imported.",
      );
    }
  }
  return { scope: `${base.toString()}#${project}`, findings };
}

/** Import one todo per rule, using a stable identity independent of filenames and lifecycle. */
export async function importScanningFindings(
  config: ConfigService,
  repository: TodoRepository,
  source: ScanningSource,
  scope: string,
  findings: ScanningFinding[],
): Promise<{ created: number; updated: number }> {
  const root = config.getRootUri();
  if (!root) {
    throw new Error("Open a workspace before importing code-scanning todos.");
  }
  await repository.refresh();
  const existing = repository.getTodos();
  const groups = new Map<string, ScanningFinding[]>();
  for (const finding of findings) {
    if (
      typeof finding.id !== "string" ||
      !finding.id ||
      typeof finding.rule !== "string" ||
      !finding.rule ||
      typeof finding.severity !== "string" ||
      typeof finding.url !== "string" ||
      !/^https?:\/\//.test(finding.url) ||
      typeof finding.message !== "string" ||
      typeof finding.path !== "string"
    ) {
      throw new Error("Scanner returned an invalid finding. No todos were imported.");
    }
    const group = groups.get(finding.rule) ?? [];
    group.push(finding);
    groups.set(finding.rule, group);
  }
  let nextId = repository.getMaxId(source) + 1;
  const result = { created: 0, updated: 0 };
  for (const [rule, alerts] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const identity = createHash("sha256")
      .update(JSON.stringify([source, scope, rule]))
      .digest("hex");
    const todo = existing.find((candidate) => candidate.frontmatter.scan_identity === identity);
    if (todo) {
      if (
        vscode.workspace.textDocuments.some(
          (document) => document.uri.toString() === todo.uri.toString() && document.isDirty,
        )
      ) {
        throw new Error(`Save todo ${todo.id} before refreshing its scanner evidence.`);
      }
      const content = await readText(todo.uri);
      const updated = updateScanningEvidence(content, alerts);
      if (content !== updated) {
        await vscode.workspace.fs.writeFile(todo.uri, Buffer.from(updated, "utf8"));
        result.updated++;
      }
      continue;
    }
    const id = `${SCANNING_ID_PREFIX[source]}-${String(nextId++).padStart(3, "0")}`;
    const priority = alerts.map((alert) => scanningPriority(alert.severity)).sort()[0];
    const folder = vscode.Uri.joinPath(root, "code-scanning", source);
    const uri = vscode.Uri.joinPath(folder, buildFileName(id, "pending", priority, rule));
    const content = [
      "---",
      "status: pending",
      `priority: ${priority}`,
      `issue_id: "${id}"`,
      `tags: [code-scanning, ${source}]`,
      `group: ${source === "codeql" ? "CodeQL" : "SonarQube"}`,
      "dependencies: []",
      `scan_identity: ${identity}`,
      `scan_source: ${source}`,
      "---",
      "",
      `# ${source === "codeql" ? "CodeQL" : "SonarQube"}: ${text(rule)}`,
      "",
      "Review these scanner findings and verify any fix before completing this todo.",
      "",
      evidence(alerts),
      "",
      "## Acceptance Criteria",
      "",
      "- [ ] Review each finding and address or document its disposition",
      "- [ ] Verify changes with tests and a new scan",
      "",
      "## Work Log",
      "",
    ].join("\n");
    await vscode.workspace.fs.createDirectory(folder);
    // A new scan must never overwrite a manually created todo.
    const edit = new vscode.WorkspaceEdit();
    edit.createFile(uri, { overwrite: false });
    edit.insert(uri, new vscode.Position(0, 0), content);
    if (!(await vscode.workspace.applyEdit(edit))) {
      throw new Error(`Unable to create scanning todo ${id}.`);
    }
    if (!(await (await vscode.workspace.openTextDocument(uri)).save())) {
      throw new Error(`Unable to save scanning todo ${id}.`);
    }
    result.created++;
  }
  if (result.created) {
    await config.writeConfigFile({ force: true });
    await config.applyGitignore({ force: true });
  }
  await repository.refresh();
  return result;
}
