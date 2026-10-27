import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as vscode from "vscode";

import TurndownService = require("turndown");

import type { ConfigService } from "./configService";
import { readText } from "./fileSystem";
import {
  type FindingChanges,
  readScanningProvenance,
  readScanningSnapshot,
  reconcileScanningSnapshot,
  type ScanningProvenance,
  type ScanningSnapshot,
  scanningIdentity,
  serializeScanningSnapshot,
  validFinding,
  writeScanningProvenance,
} from "./scanningSnapshot";
import {
  buildFileName,
  codeScanningBase,
  getTodoSource,
  parseFrontmatter,
  SCANNING_ID_PREFIX,
  splitFrontmatter,
  type Todo,
  type TodoPriority,
  type TodoStatus,
} from "./todoModel";
import type { TodoRepository } from "./todoRepository";

export type ScanningSource = "codeql" | "sonarqube";
export type ScanningGrouping = "file" | "rule" | "finding";
export interface ScanningFinding {
  id: string;
  rule: string;
  severity: string;
  message: string;
  path: string;
  line?: number;
  url: string;
  ruleTitle?: string;
  ruleDescription?: string;
  /** True when the scanner reports this finding as resolved/fixed/closed. */
  resolved?: boolean;
}

const START = "<!-- agendo:scan-evidence:start -->";
const END = "<!-- agendo:scan-evidence:end -->";
const exec = promisify(execFile);
const ruleMarkdown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
ruleMarkdown.remove(["script", "style", "iframe"]);
ruleMarkdown.addRule("sonarSubheadings", {
  filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
  replacement: (content) => `\n\n##### ${content}\n\n`,
});
ruleMarkdown.addRule("sonarCodeExamples", {
  filter: "pre",
  replacement: (_content, node) => {
    const content = node.textContent;
    const code = typeof content === "string" ? content : "";
    const fence = "`".repeat(
      Math.max(3, ...Array.from(code.matchAll(/`+/g), (match) => match[0].length + 1)),
    );
    return `\n\n${fence}\n${code.replace(/^\r?\n/, "").trimEnd()}\n${fence}\n\n`;
  },
});

export async function sonarQubeDefaults(
  workspace: vscode.Uri,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ server: string; project: string; token: string }> {
  let properties = "";
  try {
    properties = await readText(vscode.Uri.joinPath(workspace, "sonar-project.properties"));
  } catch (error) {
    if (!(error instanceof vscode.FileSystemError) || error.code !== "FileNotFound") {
      throw error;
    }
  }
  const sonarQubeUrl = env.SONARQUBE_URL?.trim();
  const server = sonarQubeUrl || env.SONAR_HOST_URL?.trim() || "";
  const token = (sonarQubeUrl ? env.SONARQUBE_TOKEN : env.SONAR_TOKEN)?.trim() || "";
  return {
    server,
    project:
      env.SONAR_PROJECT_KEY?.trim() || readProjectKey(properties),
    token: server ? token : "",
  };
}

function readProjectKey(properties: string): string {
  const key = "sonar.projectKey";
  for (const line of properties.split(/\r\n?|\n/)) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith(key)) continue;
    const assignment = trimmed.slice(key.length).trimStart();
    if (assignment.startsWith("=") || assignment.startsWith(":")) {
      return assignment.slice(1).trim();
    }
  }
  return "";
}

export function sonarQubeEnvironmentToken(
  server: string,
  defaults: { server: string; token: string },
): string {
  if (!defaults.server) {
    return "";
  }
  try {
    return validateSonarUrl(server).toString() === validateSonarUrl(defaults.server).toString()
      ? defaults.token
      : "";
  } catch {
    return "";
  }
}

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
  return value.replace(/[\r\n]+/g, " ").replace(/[\\`*_{}[\]<>#|!]/g, String.raw`\$&`);
}

function replaceGroup(content: string, group: string | undefined): string {
  const match = /^---(\r?\n)([\s\S]*?)\r?\n---/.exec(content);
  if (!match) return content;
  const lineEnding = match[1];
  const lines = match[2].split(/\r?\n/);
  const groupIndex = lines.findIndex((line) => /^group\s*:/.test(line));
  if (group === undefined) {
    if (groupIndex < 0) return content;
    lines.splice(groupIndex, 1);
  } else if (groupIndex >= 0) {
    lines[groupIndex] = `group: ${JSON.stringify(group)}`;
  } else {
    lines.push(`group: ${JSON.stringify(group)}`);
  }
  const replacement = `---${lineEnding}${lines.join(lineEnding)}${lineEnding}---`;
  return content.slice(0, match.index) + replacement + content.slice(match.index + match[0].length);
}

function updateImportedGroup(
  content: string,
  source: ScanningSource,
  grouping: ScanningGrouping,
  target: string,
  findings: ScanningFinding[],
  previous: ScanningSnapshot | undefined,
): string {
  const current = parseFrontmatter(splitFrontmatter(content).data).group;
  if (typeof current !== "string") return content;
  const sourceGroup = source === "codeql" ? "CodeQL" : "SonarQube";
  if (current === sourceGroup) {
    const priorFinding = previous?.findings.find((finding) => finding.id === target);
    const finding = findings[0] || priorFinding;
    const group =
      grouping === "finding" && finding ? finding.path || "Project-level findings" : undefined;
    return replaceGroup(content, group);
  }
  if (grouping !== "finding" || findings.length === 0) return content;
  const priorFinding = previous?.findings.find((finding) => finding.id === target);
  const priorGroup = priorFinding?.path || "Project-level findings";
  if (!priorFinding || current !== priorGroup) return content;
  return replaceGroup(content, findings[0].path || "Project-level findings");
}

/** Rewrite the frontmatter `status` field to the given value. */
function updateFrontmatterStatus(content: string, status: TodoStatus): string {
  const { data, body } = splitFrontmatter(content);
  if (!data) return content;
  const lines = data.split("\n");
  const statusIndex = lines.findIndex((line) => /^status\s*:/.test(line));
  if (statusIndex >= 0) {
    lines[statusIndex] = `status: ${status}`;
  } else {
    lines.push(`status: ${status}`);
  }
  const newData = lines.join("\n");
  return `---\n${newData}\n---\n${body}`;
}

/** Append an auto-completion work log entry to the todo's Work Log section. */
function addWorkLogEntry(content: string, action: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const entry = `\n### ${date} - Auto-completed by scanner import\n\n**By:** Kilo\n\n**Actions:**\n- ${action}\n`;
  const workLogMatch = /^## Work Log\r?\n(?:\r?\n)?/m.exec(content);
  if (workLogMatch) {
    return (
      content.slice(0, workLogMatch.index + workLogMatch[0].length) +
      entry +
      content.slice(workLogMatch.index + workLogMatch[0].length)
    );
  }
  return `${content}\n\n## Work Log\n${entry}`;
}

function findingCriterionLine(finding: ScanningFinding, met: boolean, returned: boolean): string {
  let location: string;
  if (!finding.path) {
    location = "project-level";
  } else if (finding.line) {
    location = `${finding.path}:${finding.line}`;
  } else {
    location = finding.path;
  }
  const status = returned ? "" : " (not returned)";
  return `- [${met ? "x" : " "}] [${finding.id}] \`${finding.rule}\` — ${text(finding.message)} (${location})${status}`;
}

const FINDINGS_SECTION = "### Findings";
const FINDINGS_END = "### End Findings";
const FINDING_ENTRY_RE = /^-\s*\[([ xX])\]\s*\[([^\]]+)\]\s(.*)$/;

function parseFindingsChecklist(content: string): Map<string, boolean> {
  const metByFinding = new Map<string, boolean>();
  const match = /### Findings[\s\S]*?### End Findings/.exec(content);
  if (!match) {
    return metByFinding;
  }
  for (const line of match[0].split("\n")) {
    const entry = FINDING_ENTRY_RE.exec(line);
    if (entry) {
      metByFinding.set(entry[2], entry[1].toLowerCase() === "x");
    }
  }
  return metByFinding;
}

export function buildFindingsChecklist(findings: ScanningFinding[]): string {
  const lines = [FINDINGS_SECTION, ""];
  for (const finding of findings) {
    lines.push(findingCriterionLine(finding, false, true));
  }
  lines.push("", FINDINGS_END, "");
  return lines.join("\n");
}

export function updateFindingsChecklist(
  content: string,
  findings: ScanningFinding[],
  snapshot: ScanningSnapshot,
): string {
  const metByFinding = parseFindingsChecklist(content);
  const lines = [FINDINGS_SECTION, ""];
  for (const finding of findings) {
    lines.push(findingCriterionLine(finding, metByFinding.get(finding.id) ?? false, true));
  }
  for (const finding of snapshot.findings) {
    if (!finding.returned) {
      lines.push(findingCriterionLine(finding, metByFinding.get(finding.id) ?? false, false));
    }
  }
  lines.push("", FINDINGS_END, "");
  const block = lines.join("\n");
  const sectionMatch = /### Findings[\s\S]*?### End Findings/.exec(content);
  if (!sectionMatch) {
    const introEnd = content.indexOf("## Acceptance Criteria");
    if (introEnd === -1) {
      return content;
    }
    return `${content.slice(0, introEnd)}${block}\n${content.slice(introEnd)}`;
  }
  return content.replace(/### Findings[\s\S]*?### End Findings/, block);
}

function evidence(findings: ScanningFinding[], snapshot?: ScanningSnapshot): string {
  const rules = new Map<string, ScanningFinding>();
  for (const finding of findings) {
    if (finding.ruleTitle || finding.ruleDescription) rules.set(finding.rule, finding);
  }
  const problem = [...rules]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([key, rule]) =>
        `\n\n### Rule: ${text(rule.ruleTitle || key)}\n\n**Rule ID:** ${text(key)}\n\n${(rule.ruleDescription || "").replace(/<!--/g, "&lt;!--")}`,
    )
    .join("");
  const missing = new Set(
    snapshot?.findings.filter((finding) => !finding.returned).map((finding) => finding.id),
  );
  const rows = [...findings]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (finding) =>
        `#### File: ${text(finding.path || "Project-level finding")} | Line: ${finding.line || "not reported"}\n\n**Rule:** ${text(finding.rule)}\n\n**Problem:** ${text(finding.message)}\n\n**Severity:** ${text(finding.severity)}\n\n${missing.has(finding.id) ? "**Observation:** Not returned in the latest successful result; resolution is not verified.\n\n" : ""}[View finding ${text(finding.id)}](<${finding.url.replace(/[<>\r\n]/g, "")}>)`,
    );
  const refresh = snapshot
    ? `**Retrieved:** ${snapshot.retrievedAt}\n\n**Branch:** ${text(snapshot.branch || "Default branch")}\n\n${findings.length - missing.size} reported; ${missing.size} not returned. This retrieves existing scanner results, not a new analysis.\n\n`
    : "";
  const baseline = snapshot ? `\n\n${serializeScanningSnapshot(snapshot)}` : "";
  return `${START}\n## Scanner Evidence\n\n${refresh}### Affected Locations\n\n${rows.join("\n\n")}${problem}${baseline}\n${END}`;
}

/** Only replace scanner-owned evidence, never lifecycle fields or user-authored sections. */
export function updateScanningEvidence(
  content: string,
  findings: ScanningFinding[],
  snapshot?: ScanningSnapshot,
): string {
  const start = content.indexOf(START);
  const end = content.indexOf(END, start);
  if (
    start < 0 ||
    end < start ||
    content.includes(START, start + START.length) ||
    content.includes(END, end + END.length)
  ) {
    throw new Error("Scanner evidence markers are missing; restore them before importing again.");
  }
  return content.slice(0, start) + evidence(findings, snapshot) + content.slice(end + END.length);
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

type GitHubRunner = (
  args: string[],
  options: { cwd: string; timeout: number; maxBuffer?: number },
) => Promise<{ stdout: string }>;

export interface ScanningBranches {
  defaultBranch: string;
  branches: string[];
}

const runGitHub = (args: string[], options: Parameters<GitHubRunner>[1]) =>
  exec("gh", args, options);

export async function fetchCodeQLBranches(
  cwd: string,
  run: GitHubRunner = runGitHub,
): Promise<ScanningBranches> {
  const { stdout: repoOutput } = await run(
    ["repo", "view", "--json", "nameWithOwner,defaultBranchRef"],
    { cwd, timeout: 30_000 },
  );
  const repo = JSON.parse(repoOutput) as {
    nameWithOwner?: unknown;
    defaultBranchRef?: { name?: unknown } | null;
  };
  if (
    typeof repo.nameWithOwner !== "string" ||
    !/^[\w.-]+\/[\w.-]+$/.test(repo.nameWithOwner) ||
    typeof repo.defaultBranchRef?.name !== "string"
  ) {
    throw new Error("Unable to determine the GitHub repository's default branch.");
  }
  const { stdout } = await run(
    ["api", `repos/${repo.nameWithOwner}/branches?per_page=100`, "--paginate", "--slurp"],
    { cwd, timeout: 120_000, maxBuffer: 32 * 1024 * 1024 },
  );
  const pages: unknown = JSON.parse(stdout);
  if (!Array.isArray(pages) || !pages.every(Array.isArray)) {
    throw new Error("Unexpected GitHub branches response.");
  }
  const branches = pages.flatMap((page: unknown[]) =>
    page.map((branch: unknown) =>
      branch && typeof branch === "object" && "name" in branch ? branch.name : undefined,
    ),
  );
  if (!branches.every((branch): branch is string => typeof branch === "string")) {
    throw new Error("Unexpected GitHub branch entry.");
  }
  if (!branches.includes(repo.defaultBranchRef.name)) {
    throw new Error("GitHub did not return the repository's default branch.");
  }
  return { defaultBranch: repo.defaultBranchRef.name, branches };
}

export async function fetchCodeQL(
  cwd: string,
  run: GitHubRunner = runGitHub,
  branch?: string,
): Promise<{ scope: string; branch?: string; findings: ScanningFinding[] }> {
  const { stdout: repoOutput } = await run(
    ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
    { cwd, timeout: 30_000 },
  );
  const scope = repoOutput.trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(scope)) {
    throw new Error("Unable to determine the GitHub repository from gh.");
  }

  const fetchAlerts = async (state: string): Promise<ScanningFinding[]> => {
    const query = new URLSearchParams({ state, per_page: "100", tool_name: "CodeQL" });
    if (branch) query.set("ref", `refs/heads/${branch}`);
    const { stdout } = await run(
      ["api", `repos/${scope}/code-scanning/alerts?${query}`, "--paginate", "--slurp"],
      { cwd, timeout: 120_000, maxBuffer: 32 * 1024 * 1024 },
    );
    const pages = JSON.parse(stdout) as Array<
      Array<{
        number: number;
        state?: string;
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
    return pages.flat().map((alert) => {
      const url = new URL(`https://github.com/${scope}/security/code-scanning/${alert.number}`);
      if (branch) url.searchParams.set("ref", `refs/heads/${branch}`);
      return {
        id: String(alert.number),
        rule: alert.rule.id,
        severity: alert.rule.security_severity_level || alert.rule.severity || "warning",
        message: alert.most_recent_instance.message.text,
        path: alert.most_recent_instance.location.path,
        line: alert.most_recent_instance.location.start_line,
        url: url.toString(),
        /** A finding is resolved when the scanner reports it as closed or fixed. */
        resolved: alert.state === "closed" || alert.state === "fixed",
      };
    });
  };

  const [openFindings, closedFindings] = await Promise.all([
    fetchAlerts("open"),
    fetchAlerts("closed"),
  ]);

  // Merge and deduplicate by alert number; closed/fixed alerts override open ones.
  const findingsById = new Map<string, ScanningFinding>();
  for (const finding of [...openFindings, ...closedFindings]) {
    findingsById.set(finding.id, finding);
  }

  return {
    scope,
    ...(branch ? { branch } : {}),
    findings: [...findingsById.values()],
  };
}

type SonarCliRunner = (args: string[], cwd: string) => Promise<string>;

async function runSonarCli(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await exec("sonar", args, {
      cwd,
      timeout: 120_000,
      maxBuffer: 32 * 1024 * 1024,
    });
    return stdout;
  } catch {
    // Do not surface CLI stdout/stderr, which can contain authentication details.
    throw new Error(
      "SonarQube CLI request failed. Ensure sonar is on VS Code's PATH and run sonar auth login, then retry.",
    );
  }
}

export async function sonarQubeCliServer(
  cwd: string,
  run: SonarCliRunner = runSonarCli,
): Promise<string> {
  const status = JSON.parse(await run(["auth", "status", "--format", "json"], cwd));
  if (status?.status !== "connected" || typeof status.server !== "string") {
    throw new Error("SonarQube CLI is not connected. Run sonar auth login, then retry.");
  }
  return validateSonarUrl(status.server).toString();
}

export async function fetchSonarQubeCli(
  cwd: string,
  server: string,
  project: string,
  run: SonarCliRunner = runSonarCli,
  branch?: string,
): Promise<{ scope: string; branch?: string; findings: ScanningFinding[] }> {
  return fetchSonarQube(
    server,
    project,
    "",
    createSonarCliRequest(cwd, server, run),
    undefined,
    branch,
  );
}

function createSonarCliRequest(
  cwd: string,
  server: string,
  run: SonarCliRunner,
): (url: URL) => Promise<unknown> {
  const base = validateSonarUrl(server);
  const expectedServer = base.toString();
  const checkConnection = async () => {
    if ((await sonarQubeCliServer(cwd, run)) !== expectedServer) {
      throw new Error("SonarQube CLI connection changed. Start the import again.");
    }
  };
  return async (url) => {
    await checkConnection();
    // sonar api routes relative endpoints against the active connection, including its context path.
    const output = await run(
      ["api", "get", `/${url.pathname.slice(base.pathname.length)}${url.search}`],
      cwd,
    );
    await checkConnection();
    return JSON.parse(output);
  };
}

export async function fetchSonarQubeBranches(
  server: string,
  project: string,
  token: string,
  request?: (url: URL) => Promise<unknown>,
): Promise<ScanningBranches> {
  const base = validateSonarUrl(server);
  const url = new URL("api/project_branches/list", base);
  url.search = new URLSearchParams({ project }).toString();
  const payload = (await (request ? request(url) : fetchSonarQubePage(url, token))) as {
    branches?: Array<{ name?: unknown; isMain?: unknown }>;
  };
  const branches = Array.isArray(payload?.branches)
    ? payload.branches.filter((branch): branch is { name: string; isMain: boolean } =>
        Boolean(
          branch &&
            typeof branch === "object" &&
            typeof branch.name === "string" &&
            typeof branch.isMain === "boolean",
        ),
      )
    : [];
  if (!Array.isArray(payload?.branches) || branches.length !== payload.branches.length) {
    throw new Error("Unexpected SonarQube project branches response.");
  }
  const mainBranch = branches.find((branch) => branch.isMain);
  if (!mainBranch?.name) {
    throw new Error("SonarQube did not return the project's main branch.");
  }
  return { defaultBranch: mainBranch.name, branches: branches.map((branch) => branch.name) };
}

export async function fetchSonarQubeCliBranches(
  cwd: string,
  server: string,
  project: string,
  run: SonarCliRunner = runSonarCli,
): Promise<ScanningBranches> {
  return fetchSonarQubeBranches(server, project, "", createSonarCliRequest(cwd, server, run));
}

interface SonarIssue {
  key: string;
  rule: string;
  severity: string;
  message: string;
  component: string;
  line?: number;
  /** Date the issue was resolved, or undefined when still open. */
  resolved?: string;
}

function sonarIssueFinding(
  issue: SonarIssue,
  base: URL,
  project: string,
  branch?: string,
): ScanningFinding {
  const link = new URL("project/issues", base);
  const params = new URLSearchParams({ id: project, issues: issue.key });
  if (branch) params.set("branch", branch);
  link.search = params.toString();
  return {
    id: issue.key,
    rule: issue.rule,
    severity: issue.severity,
    message: issue.message,
    path: issue.component.startsWith(`${project}:`)
      ? issue.component.slice(project.length + 1)
      : issue.component,
    line: issue.line,
    url: link.toString(),
    /** A SonarQube issue is resolved when it has a resolved date. */
    resolved: Boolean(issue.resolved),
  };
}

async function fetchPaginatedIssues(
  base: URL,
  project: string,
  token: string,
  request?: (url: URL) => Promise<unknown>,
  branch?: string,
): Promise<ScanningFinding[]> {
  const findings: ScanningFinding[] = [];
  for (let page = 1; ; page++) {
    const url = new URL("api/issues/search", base);
    const params = new URLSearchParams({
      componentKeys: project,
      ps: "500",
      p: String(page),
    });
    if (branch) params.set("branch", branch);
    url.search = params.toString();
    const payload = (await (request ? request(url) : fetchSonarQubePage(url, token))) as {
      issues: SonarIssue[];
      paging: { total: number };
    };
    if (
      !Array.isArray(payload?.issues) ||
      !Number.isInteger(payload.paging?.total) ||
      payload.paging.total < 0
    ) {
      throw new Error("Unexpected SonarQube issues response.");
    }
    for (const issue of payload.issues) {
      findings.push(sonarIssueFinding(issue, base, project, branch));
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
  return findings;
}

async function fetchRuleDetail(
  base: URL,
  key: string,
  token: string,
  request?: (url: URL) => Promise<unknown>,
): Promise<{ title: string; description: string }> {
  const url = new URL("api/rules/show", base);
  url.search = new URLSearchParams({ key }).toString();
  const payload = (await (request ? request(url) : fetchSonarQubePage(url, token))) as {
    rule?: {
      key: string;
      name: string;
      descriptionSections?: Array<{ key: string; content: string }>;
      htmlDesc?: string;
      mdDesc?: string;
    };
  };
  const rule = payload?.rule;
  if (rule?.key !== key || typeof rule.name !== "string") {
    throw new Error("Unexpected SonarQube rule response. No todos were imported.");
  }
  const sections = rule.descriptionSections
    ?.map((section) => {
      const headings: Record<string, string> = {
        root_cause: "Why is this an issue?",
        how_to_fix: "How to fix it",
        resources: "References",
        assess_the_problem: "Assess the problem",
        introduction: "Overview",
      };
      const heading = headings[section.key] || section.key.replace(/_/g, " ");
      return `#### ${text(heading)}\n\n${ruleMarkdown.turndown(section.content)}`;
    })
    .join("\n\n");
  const description =
    sections || (rule.htmlDesc ? ruleMarkdown.turndown(rule.htmlDesc) : rule.mdDesc || "");
  return {
    title: rule.name,
    description: description.replace(/<!--/g, "&lt;!--"),
  };
}

const DUPLICATION_RULE_DESCRIPTION =
  "This file has a high density of duplicated lines. Consider refactoring to extract shared code or remove redundant blocks.";

async function readDuplicationMetrics(
  url: URL,
  token: string,
  request?: (url: URL) => Promise<unknown>,
): Promise<{ density: number; duplicatedLines: number } | undefined> {
  const payload = (await (request ? request(url) : fetchSonarQubePage(url, token))) as {
    component?: { measures?: Array<{ metric: string; value: string | number }> };
  };
  const measures = payload?.component?.measures;
  if (!Array.isArray(measures)) return undefined;
  const density = measures.find((measure) => measure.metric === "duplicated_lines_density");
  const lines = measures.find((measure) => measure.metric === "duplicated_lines");
  return {
    density: density ? Number(density.value) : 0,
    duplicatedLines: lines ? Number(lines.value) : 0,
  };
}

async function checkDuplicationMetrics(
  base: URL,
  project: string,
  filePaths: Set<string>,
  token: string,
  request: ((url: URL) => Promise<unknown>) | undefined,
  branch: string | undefined,
  options: { threshold: number; description: string },
): Promise<ScanningFinding[]> {
  const duplicationRuleKey = "sonarqube:duplicated_lines";
  const duplicationFindings: ScanningFinding[] = [];
  for (const filePath of filePaths) {
    try {
      const url = new URL("api/measures/component", base);
      url.search = new URLSearchParams({
        component: `${project}:${filePath}`,
        metricKeys: "duplicated_lines,duplicated_lines_density",
        ...(branch ? { branch } : {}),
      }).toString();
      const measures = await readDuplicationMetrics(url, token, request);
      if (!measures) continue;
      const { density, duplicatedLines } = measures;
      if (density >= options.threshold && duplicatedLines > 0) {
        const link = new URL("project/issues", base);
        const linkParams = new URLSearchParams({
          id: project,
          view: "duplications",
          file: filePath,
        });
        if (branch) linkParams.set("branch", branch);
        link.search = linkParams.toString();
        duplicationFindings.push({
          id: `dup-${project}-${filePath}`,
          rule: duplicationRuleKey,
          severity: "MAJOR",
          message: `${duplicatedLines} duplicated lines (${Math.round(density)}% density) in ${filePath}`,
          path: filePath,
          url: link.toString(),
          ruleTitle: "Duplicated code detected",
          ruleDescription: options.description,
        });
      }
    } catch {
      // Skip files where duplication metrics are unavailable
    }
  }
  return duplicationFindings;
}

export async function fetchSonarQube(
  server: string,
  project: string,
  token: string,
  request?: (url: URL) => Promise<unknown>,
  duplicationThreshold?: number,
  branch?: string,
): Promise<{ scope: string; branch?: string; findings: ScanningFinding[] }> {
  const base = validateSonarUrl(server);
  const threshold = duplicationThreshold ?? 0.05;
  const findings = await fetchPaginatedIssues(base, project, token, request, branch);
  const rules = new Map<string, { title: string; description: string }>();
  for (const key of new Set(findings.map((finding) => finding.rule))) {
    rules.set(key, await fetchRuleDetail(base, key, token, request));
  }
  for (const finding of findings) {
    const rule = rules.get(finding.rule);
    finding.ruleTitle = rule?.title;
    finding.ruleDescription = rule?.description;
  }
  const duplicationRuleKey = "sonarqube:duplicated_lines";
  const duplicationFindings = await checkDuplicationMetrics(
    base,
    project,
    new Set(findings.map((f) => f.path)),
    token,
    request,
    branch,
    {
      threshold,
      description: rules.get(duplicationRuleKey)?.description ?? DUPLICATION_RULE_DESCRIPTION,
    },
  );
  findings.push(...duplicationFindings);
  return { scope: `${base.toString()}#${project}`, ...(branch ? { branch } : {}), findings };
}

async function fetchSonarQubePage(url: URL, token: string): Promise<unknown> {
  const credentials = Buffer.from(`${token}:`).toString("base64");
  const response = await fetch(url, {
    headers: { Authorization: `Basic ${credentials}` },
    signal: AbortSignal.timeout(30_000),
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error(
      `SonarQube request failed (HTTP ${response.status}). Check the server, project key, and token.`,
    );
  }
  return response.json();
}

export interface ScanningImportResult {
  created: number;
  updated: number;
  refreshed: number;
  autoCompleted: number;
  changes: FindingChanges;
  reviewRequired: string[];
}

/** Outcome of processing one scanner import group. */
interface ImportGroupWrite {
  uri: vscode.Uri;
  /** Source URI for existing todos (used when the target differs, e.g. auto-complete move). */
  sourceUri?: vscode.Uri;
  before?: string;
  after: string;
  changed: boolean;
  reviewRequired: string[];
  /** True when this write auto-completed the todo to completed status. */
  autoCompleted?: boolean;
}

interface ImportContext {
  provenance: Omit<ScanningProvenance, "target">;
  target?: string;
  existing: Todo[];
  root: vscode.Uri;
  retrievedAt: string;
  /** Completed folder name (e.g. "completed") for moving auto-completed todos. */
  completedFolder: string;
}

async function readImportBaseline(context: ImportContext, provenance: ScanningProvenance) {
  const identity = scanningIdentity(provenance);
  const matches = context.existing.filter(
    (candidate) => candidate.frontmatter.scan_identity === identity,
  );
  if (matches.length > 1)
    throw new Error("Duplicate scanner import identity; reconcile it before refreshing.");
  const todo = matches[0];
  if (todo && getTodoSource(todo) !== provenance.source)
    throw new Error("Scanner identity belongs to a different source.");
  if (context.target !== undefined && !todo)
    throw new Error("The imported refresh target no longer exists.");
  const before = todo ? await readText(todo.uri) : undefined;
  const oldProvenance = before ? readScanningProvenance(before) : undefined;
  if (oldProvenance && scanningIdentity(oldProvenance) !== identity)
    throw new Error("Scanner refresh scope does not match its provenance.");
  const owned = before?.slice(before.indexOf(START), before.indexOf(END) + END.length);
  const previous = owned ? readScanningSnapshot(owned, provenance) : undefined;
  return { todo, before, previous };
}

async function processImportGroup(
  context: ImportContext,
  key: string,
  alerts: ScanningFinding[],
  nextId: number,
): Promise<{ write: ImportGroupWrite; changes: FindingChanges; nextId: number }> {
  const provenance = { ...context.provenance, target: key };
  const { todo, before, previous } = await readImportBaseline(context, provenance);
  const { snapshot, changes } = reconcileScanningSnapshot(
    provenance,
    previous,
    alerts,
    Boolean(todo),
    context.retrievedAt,
  );
  const changed =
    !previous ||
    JSON.stringify({ ...previous, retrievedAt: "" }) !==
      JSON.stringify({ ...snapshot, retrievedAt: "" });
  const review = Boolean(
    todo && ["ready", "completed"].includes(todo.status) && (changed || alerts.length),
  );
  const reviewRequired: string[] = [];
  if (review && todo) reviewRequired.push(todo.id);
  const rules = new Map(snapshot.rules.map((rule) => [rule.id, rule]));
  const observations = snapshot.findings.map(({ returned: _returned, ...finding }) => ({
    ...finding,
    ruleTitle: rules.get(finding.rule)?.title,
    ruleDescription: rules.get(finding.rule)?.description,
  }));

  /** All findings for this todo are resolved by the scanner. */
  const allResolved = snapshot.findings.length > 0 && snapshot.findings.every((f) => f.resolved === true);
  const autoComplete = todo && todo.status !== "completed" && allResolved;

  if (todo && before !== undefined) {
    let content = before;
    let targetUri = todo.uri;
    let sourceUri = todo.uri;
    let effectiveReview = review;

    if (autoComplete) {
      // Transition the todo to completed: update status, add work log, move to completed folder.
      content = updateFrontmatterStatus(content, "completed");
      content = addWorkLogEntry(
        content,
        "All scanner findings for this todo are resolved; auto-completed by import.",
      );
      const sourceFolder = codeScanningBase(todo.folder);
      const completedFolderPath = sourceFolder
        ? `${sourceFolder}/${context.completedFolder}`
        : context.completedFolder;
      targetUri = vscode.Uri.joinPath(
        context.root,
        completedFolderPath,
        buildFileName(todo.id, "completed", todo.priority, todo.description),
      );
      sourceUri = todo.uri;
      effectiveReview = false;
    }

    const updatedContent = updateImportedGroup(
      content,
      provenance.source,
      provenance.grouping,
      key,
      alerts,
      previous,
    );
    const after = writeScanningProvenance(
      updateFindingsChecklist(
        updateScanningEvidence(updatedContent, observations, snapshot),
        observations,
        snapshot,
      ),
      snapshot,
      effectiveReview,
    );
    return {
      write: {
        uri: targetUri,
        sourceUri,
        before,
        after,
        changed,
        reviewRequired,
        ...(autoComplete ? { autoCompleted: true } : {}),
      },
      changes,
      nextId,
    };
  }
  const id = `${SCANNING_ID_PREFIX[provenance.source]}-${String(nextId).padStart(3, "0")}`;
  return {
    write: newImportWrite(context, provenance, snapshot, observations, alerts, id),
    changes,
    nextId: nextId + 1,
  };
}

function importTitle(grouping: ScanningGrouping, key: string, finding: ScanningFinding): string {
  if (grouping === "file") {
    return key || "Project-level findings";
  }
  if (grouping === "rule") return key;
  const linePart = finding.line ? `:${finding.line}` : "";
  return `${finding.path || "Project"}${linePart} - ${finding.rule}`;
}

function newImportWrite(
  context: ImportContext,
  provenance: ScanningProvenance,
  snapshot: ScanningSnapshot,
  observations: ScanningFinding[],
  alerts: ScanningFinding[],
  id: string,
): ImportGroupWrite {
  const { source, grouping, target: key } = provenance;
  const identity = scanningIdentity(provenance);
  const title = importTitle(grouping, key, alerts[0]);
  const priority = alerts
    .map((alert) => scanningPriority(alert.severity))
    .sort((a, b) => a.localeCompare(b))[0];
  const group = grouping === "finding" ? alerts[0].path || "Project-level findings" : undefined;
  const folder = vscode.Uri.joinPath(context.root, "code-scanning", source);
  const uri = vscode.Uri.joinPath(folder, buildFileName(id, "pending", priority, title));
  const content = [
    "---",
    "status: pending",
    `priority: ${priority}`,
    `issue_id: "${id}"`,
    `tags: [code-scanning, ${source}]`,
    ...(group ? [`group: ${JSON.stringify(group)}`] : []),
    "dependencies: []",
    `scan_identity: ${identity}`,
    `scan_source: ${source}`,
    `scan_grouping: ${grouping}`,
    `scan_target: ${JSON.stringify(key)}`,
    "---",
    "",
    `# ${text(title)}`,
    "",
    "Review these scanner findings and verify any fix before completing this todo.",
    "",
    evidence(observations, snapshot),
    "",
    "## Acceptance Criteria",
    "",
    buildFindingsChecklist(observations),
    "",
    "- [ ] Review each finding and address or document its disposition",
    "- [ ] Verify changes with tests and a new scan",
    "",
    "## Work Log",
    "",
  ].join("\n");
  const after = writeScanningProvenance(content, snapshot, false);
  return { uri, after, changed: false, reviewRequired: [] };
}

async function preflightWrites(writes: ImportGroupWrite[]): Promise<void> {
  for (const write of writes) {
    if (
      vscode.workspace.textDocuments.some(
        (document) => document.uri.toString() === write.uri.toString() && document.isDirty,
      )
    )
      throw new Error("Save todo changes before refreshing scanner evidence.");
    const sourceUri = write.sourceUri ?? write.uri;
    if (write.before !== undefined && (await readText(sourceUri)) !== write.before)
      throw new Error("A scanner todo changed while preparing the refresh; retry.");
    if (write.before === undefined) {
      await assertNewImportPath(write.uri);
    }
  }
}

async function assertNewImportPath(uri: vscode.Uri): Promise<void> {
  try {
    await vscode.workspace.fs.stat(uri);
    throw new Error("A new scanner todo already exists; refresh and retry.");
  } catch (error) {
    if (!(error instanceof vscode.FileSystemError) || error.code !== "FileNotFound") throw error;
  }
}

async function writeImportResults(
  writes: ImportGroupWrite[],
  root: vscode.Uri,
  source: ScanningSource,
): Promise<void> {
  for (const write of writes) {
    await writeScannerTodo(write, root, source);
  }
}

async function writeScannerTodo(
  write: ImportGroupWrite,
  root: vscode.Uri,
  source: ScanningSource,
): Promise<void> {
  if (
    vscode.workspace.textDocuments.some(
      (document) => document.uri.toString() === write.uri.toString() && document.isDirty,
    )
  )
    throw new Error("Save todo changes before refreshing scanner evidence.");
  if (write.before !== undefined) {
    const sourceUri = write.sourceUri ?? write.uri;
    if ((await readText(sourceUri)) !== write.before)
      throw new Error("A scanner todo changed during refresh; retry.");
    if (write.sourceUri && write.sourceUri.toString() !== write.uri.toString()) {
      // Move the file to a new location (e.g. completed folder) and write the updated content.
      await vscode.workspace.fs.rename(sourceUri, write.uri, { overwrite: false });
      await vscode.workspace.fs.writeFile(write.uri, Buffer.from(write.after, "utf8"));
    } else {
      await vscode.workspace.fs.writeFile(write.uri, Buffer.from(write.after, "utf8"));
    }
  } else {
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(root, "code-scanning", source));
    const edit = new vscode.WorkspaceEdit();
    edit.createFile(write.uri, { overwrite: false });
    edit.insert(write.uri, new vscode.Position(0, 0), write.after);
    if (
      !(await vscode.workspace.applyEdit(edit)) ||
      !(await (await vscode.workspace.openTextDocument(write.uri)).save())
    ) {
      throw new Error("Unable to create and save the imported scanner todo.");
    }
  }
}

function groupImportFindings(findings: ScanningFinding[], grouping: ScanningGrouping) {
  const groups = new Map<string, ScanningFinding[]>();
  const findingIds = new Set<string>();
  for (const finding of findings) {
    if (!validFinding(finding) || findingIds.has(finding.id)) {
      throw new Error("Scanner returned an invalid finding. No todos were imported.");
    }
    findingIds.add(finding.id);
    let key: string;
    if (grouping === "file") {
      key = finding.path;
    } else if (grouping === "rule") {
      key = finding.rule;
    } else {
      key = finding.id;
    }
    const group = groups.get(key) ?? [];
    group.push(finding);
    groups.set(key, group);
  }
  return groups;
}

async function addExistingImportGroups(
  groups: Map<string, ScanningFinding[]>,
  existing: Todo[],
  scope: Omit<ScanningProvenance, "target">,
): Promise<void> {
  for (const todo of existing) {
    if (
      getTodoSource(todo) !== scope.source ||
      todo.frontmatter.scan_scope !== scope.scope ||
      todo.frontmatter.scan_grouping !== scope.grouping ||
      todo.frontmatter.scan_branch !== scope.branch
    ) {
      continue;
    }
    const provenance = readScanningProvenance(await readText(todo.uri));
    if (provenance?.source !== scope.source)
      throw new Error("Invalid scanner provenance for an existing import.");
    if (!groups.has(provenance.target)) groups.set(provenance.target, []);
  }
}

function accumulateImportResult(
  result: ScanningImportResult,
  write: ImportGroupWrite,
  changes: FindingChanges,
): void {
  if (write.before === undefined) {
    result.created++;
  } else {
    result.refreshed++;
    if (write.changed) result.updated++;
  }
  for (const field of Object.keys(result.changes) as Array<keyof FindingChanges>) {
    result.changes[field] += changes[field];
  }
  result.reviewRequired.push(...write.reviewRequired);
  if (write.autoCompleted) result.autoCompleted++;
}

export async function importScanningFindings(
  config: ConfigService,
  repository: TodoRepository,
  source: ScanningSource,
  scope: string,
  findings: ScanningFinding[],
  grouping: ScanningGrouping = "file",
  options: { target?: string; branch?: string } = {},
): Promise<ScanningImportResult> {
  if (!["file", "rule", "finding"].includes(grouping)) {
    throw new Error("Choose a supported scanner import grouping.");
  }
  const root = config.getRootUri();
  if (!root) {
    throw new Error("Open a workspace before importing code-scanning todos.");
  }
  if (!["codeql", "sonarqube"].includes(source) || !scope || /[\r\n]/.test(scope)) {
    throw new Error("Invalid scanner source or scope.");
  }
  if (options.branch !== undefined && (!options.branch.trim() || /[\r\n]/.test(options.branch))) {
    throw new Error("Invalid scanner branch.");
  }
  if (scope.includes("://")) validateSonarUrl(scope.split("#")[0]);
  await repository.refresh();
  const existing = repository.getTodos();
  const groups = groupImportFindings(findings, grouping);
  const provenance = {
    source,
    scope,
    grouping,
    ...(options.branch === undefined ? {} : { branch: options.branch }),
  };
  await addExistingImportGroups(groups, existing, provenance);
  if (options.target !== undefined) {
    const findingsForTarget = groups.get(options.target) ?? [];
    groups.clear();
    groups.set(options.target, findingsForTarget);
  }
  let nextId = repository.getMaxId(source) + 1;
  const result: ScanningImportResult = {
    created: 0,
    updated: 0,
    refreshed: 0,
    autoCompleted: 0,
    changes: { added: 0, changed: 0, unchanged: 0, notReturned: 0, uncompared: 0 },
    reviewRequired: [],
  };
  const writes: ImportGroupWrite[] = [];
  const context: ImportContext = {
    provenance,
    target: options.target,
    existing,
    root,
    retrievedAt: new Date().toISOString(),
    completedFolder: config.completedFolder,
  };
  for (const [key, alerts] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const { write, changes, nextId: nextIdAfter } = await processImportGroup(
      context,
      key,
      alerts,
      nextId,
    );
    nextId = nextIdAfter;
    writes.push(write);
    accumulateImportResult(result, write, changes);
  }
  await preflightWrites(writes);
  await writeImportResults(writes, root, source);
  if (result.created) {
    await config.writeConfigFile({ force: true });
    await config.applyGitignore({ force: true });
  }
  await repository.refresh();
  return result;
}
