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
  type ScanningSnapshot,
  scanningIdentity,
  serializeScanningSnapshot,
  validFinding,
  writeScanningProvenance,
} from "./scanningSnapshot";
import {
  buildFileName,
  getTodoSource,
  parseFrontmatter,
  SCANNING_ID_PREFIX,
  splitFrontmatter,
  type TodoPriority,
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
    const code = String(node.textContent || "");
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
      env.SONAR_PROJECT_KEY?.trim() ||
      properties.match(/^\s*sonar\.projectKey\s*[=:]\s*(.*?)\s*$/m)?.[1] ||
      "",
    token: server ? token : "",
  };
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
  return value.replace(/[\r\n]+/g, " ").replace(/[\\`*_{}[\]<>#|!]/g, "\\$&");
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

function findingCriterionLine(finding: ScanningFinding, met: boolean, returned: boolean): string {
  const location = finding.path
    ? finding.line
      ? `${finding.path}:${finding.line}`
      : finding.path
    : "project-level";
  const status = returned ? "" : " (not returned)";
  return `- [${met ? "x" : " "}] [${finding.id}] \`${finding.rule}\` — ${text(finding.message)} (${location})${status}`;
}

const FINDINGS_SECTION = "### Findings";
const FINDINGS_END = "### End Findings";
const FINDING_ENTRY_RE = /^-\s*\[([ xX])\]\s*\[([^\]]+)\]\s(.*)$/;

function parseFindingsChecklist(content: string): Map<string, boolean> {
  const metByFinding = new Map<string, boolean>();
  const match = content.match(/### Findings[\s\S]*?### End Findings/);
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
  const sectionMatch = content.match(/### Findings[\s\S]*?### End Findings/);
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
    content.indexOf(START, start + START.length) !== -1 ||
    content.indexOf(END, end + END.length) !== -1
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
  const query = new URLSearchParams({ state: "open", per_page: "100", tool_name: "CodeQL" });
  if (branch) query.set("ref", `refs/heads/${branch}`);
  const { stdout } = await run(
    ["api", `repos/${scope}/code-scanning/alerts?${query}`, "--paginate", "--slurp"],
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
  const findings = pages.flat().map((alert) => {
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
    };
  });
  return { scope, ...(branch ? { branch } : {}), findings };
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
  const findings: ScanningFinding[] = [];
  for (let page = 1; ; page++) {
    const url = new URL("api/issues/search", base);
    const params = new URLSearchParams({
      componentKeys: project,
      resolved: "false",
      ps: "500",
      p: String(page),
    });
    if (branch) params.set("branch", branch);
    url.search = params.toString();
    const payload = (await (request ? request(url) : fetchSonarQubePage(url, token))) as {
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
      !Array.isArray(payload?.issues) ||
      !Number.isInteger(payload.paging?.total) ||
      payload.paging.total < 0
    ) {
      throw new Error("Unexpected SonarQube issues response.");
    }
    for (const issue of payload.issues) {
      const link = new URL("project/issues", base);
      const linkParams = new URLSearchParams({ id: project, issues: issue.key });
      if (branch) linkParams.set("branch", branch);
      link.search = linkParams.toString();
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
  const rules = new Map<string, { title: string; description: string }>();
  for (const key of new Set(findings.map((finding) => finding.rule))) {
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
    rules.set(key, {
      title: rule.name,
      description: description.replace(/<!--/g, "&lt;!--"),
    });
  }
  for (const finding of findings) {
    const rule = rules.get(finding.rule);
    finding.ruleTitle = rule?.title;
    finding.ruleDescription = rule?.description;
  }

  const duplicationRuleKey = "sonarqube:duplicated_lines";
  if (!rules.has(duplicationRuleKey)) {
    rules.set(duplicationRuleKey, {
      title: "Duplicated code detected",
      description:
        "This file has a high density of duplicated lines. Consider refactoring to extract shared code or remove redundant blocks.",
    });
  }

  const filePaths = new Set(findings.map((finding) => finding.path));
  for (const filePath of filePaths) {
    try {
      const url = new URL("api/measures/component", base);
      url.search = new URLSearchParams({
        component: `${project}:${filePath}`,
        metricKeys: "duplicated_lines,duplicated_lines_density",
        ...(branch ? { branch } : {}),
      }).toString();
      const payload = (await (request ? request(url) : fetchSonarQubePage(url, token))) as {
        component?: { measures?: Array<{ metric: string; value: string | number }> };
      };
      const measures = payload?.component?.measures;
      if (!Array.isArray(measures)) continue;
      const densityMeasure = measures.find((m) => m.metric === "duplicated_lines_density");
      const linesMeasure = measures.find((m) => m.metric === "duplicated_lines");
      const density = densityMeasure ? Number(densityMeasure.value) : 0;
      const duplicatedLines = linesMeasure ? Number(linesMeasure.value) : 0;
      if (density >= threshold && duplicatedLines > 0) {
        const link = new URL("project/issues", base);
        const linkParams = new URLSearchParams({
          id: project,
          view: "duplications",
          file: filePath,
        });
        if (branch) linkParams.set("branch", branch);
        link.search = linkParams.toString();
        findings.push({
          id: `dup-${project}-${filePath}`,
          rule: duplicationRuleKey,
          severity: "MAJOR",
          message: `${duplicatedLines} duplicated lines (${Math.round(density)}% density) in ${filePath}`,
          path: filePath,
          url: link.toString(),
          ruleTitle: "Duplicated code detected",
          ruleDescription: rules.get(duplicationRuleKey)?.description,
        });
      }
    } catch {
      // Skip files where duplication metrics are unavailable
    }
  }

  return { scope: `${base.toString()}#${project}`, ...(branch ? { branch } : {}), findings };
}

async function fetchSonarQubePage(url: URL, token: string): Promise<unknown> {
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
  return response.json();
}

export interface ScanningImportResult {
  created: number;
  updated: number;
  refreshed: number;
  changes: FindingChanges;
  reviewRequired: string[];
}

/** Requires a complete source result; fetchers reject failed/incomplete pagination before import. */
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
  const groups = new Map<string, ScanningFinding[]>();
  const findingIds = new Set<string>();
  for (const finding of findings) {
    if (!validFinding(finding) || findingIds.has(finding.id)) {
      throw new Error("Scanner returned an invalid finding. No todos were imported.");
    }
    findingIds.add(finding.id);
    const key =
      grouping === "file" ? finding.path : grouping === "rule" ? finding.rule : finding.id;
    const group = groups.get(key) ?? [];
    group.push(finding);
    groups.set(key, group);
  }
  for (const todo of existing) {
    if (
      getTodoSource(todo) !== source ||
      todo.frontmatter.scan_scope !== scope ||
      todo.frontmatter.scan_grouping !== grouping ||
      todo.frontmatter.scan_branch !== options.branch
    )
      continue;
    const provenance = readScanningProvenance(await readText(todo.uri));
    if (!provenance || provenance.source !== source)
      throw new Error("Invalid scanner provenance for an existing import.");
    if (!groups.has(provenance.target)) groups.set(provenance.target, []);
  }
  if (options.target !== undefined) {
    const findingsForTarget = groups.get(options.target) || [];
    groups.clear();
    groups.set(options.target, findingsForTarget);
  }
  let nextId = repository.getMaxId(source) + 1;
  const result: ScanningImportResult = {
    created: 0,
    updated: 0,
    refreshed: 0,
    changes: { added: 0, changed: 0, unchanged: 0, notReturned: 0, uncompared: 0 },
    reviewRequired: [],
  };
  const writes: Array<{ uri: vscode.Uri; before?: string; after: string }> = [];
  const retrievedAt = new Date().toISOString();
  for (const [key, alerts] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const provenance = {
      source,
      scope,
      grouping,
      target: key,
      ...(options.branch === undefined ? {} : { branch: options.branch }),
    };
    const identity = scanningIdentity(provenance);
    const matches = existing.filter(
      (candidate) => candidate.frontmatter.scan_identity === identity,
    );
    if (matches.length > 1)
      throw new Error("Duplicate scanner import identity; reconcile it before refreshing.");
    const todo = matches[0];
    if (todo && getTodoSource(todo) !== source)
      throw new Error("Scanner identity belongs to a different source.");
    if (options.target !== undefined && !todo)
      throw new Error("The imported refresh target no longer exists.");
    const before = todo ? await readText(todo.uri) : undefined;
    const oldProvenance = before ? readScanningProvenance(before) : undefined;
    if (oldProvenance && scanningIdentity(oldProvenance) !== identity)
      throw new Error("Scanner refresh scope does not match its provenance.");
    const owned = before?.slice(before.indexOf(START), before.indexOf(END) + END.length);
    const previous = owned ? readScanningSnapshot(owned, provenance) : undefined;
    const { snapshot, changes } = reconcileScanningSnapshot(
      provenance,
      previous,
      alerts,
      Boolean(todo),
      retrievedAt,
    );
    for (const field of Object.keys(result.changes) as Array<keyof FindingChanges>)
      result.changes[field] += changes[field];
    const changed =
      !previous ||
      JSON.stringify({ ...previous, retrievedAt: "" }) !==
        JSON.stringify({ ...snapshot, retrievedAt: "" });
    const review = Boolean(
      todo && ["ready", "completed"].includes(todo.status) && (changed || alerts.length),
    );
    if (review && todo) result.reviewRequired.push(todo.id);
    const rules = new Map(snapshot.rules.map((rule) => [rule.id, rule]));
    const observations = snapshot.findings.map(({ returned: _returned, ...finding }) => ({
      ...finding,
      ruleTitle: rules.get(finding.rule)?.title,
      ruleDescription: rules.get(finding.rule)?.description,
    }));
    if (todo && before !== undefined) {
      const updatedContent = updateImportedGroup(before, source, grouping, key, alerts, previous);
      writes.push({
        uri: todo.uri,
        before,
        after: writeScanningProvenance(
          updateFindingsChecklist(
            updateScanningEvidence(updatedContent, observations, snapshot),
            observations,
            snapshot,
          ),
          snapshot,
          review,
        ),
      });
      result.refreshed++;
      if (changed) result.updated++;
      continue;
    }
    const title =
      grouping === "file"
        ? key || "Project-level findings"
        : grouping === "rule"
          ? key
          : `${alerts[0].path || "Project"}${alerts[0].line ? `:${alerts[0].line}` : ""} - ${alerts[0].rule}`;
    const id = `${SCANNING_ID_PREFIX[source]}-${String(nextId++).padStart(3, "0")}`;
    const priority = alerts.map((alert) => scanningPriority(alert.severity)).sort()[0];
    const group = grouping === "finding" ? alerts[0].path || "Project-level findings" : undefined;
    const folder = vscode.Uri.joinPath(root, "code-scanning", source);
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
      `# ${source === "codeql" ? "CodeQL" : "SonarQube"}: ${text(title)}`,
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
    writes.push({ uri, after: writeScanningProvenance(content, snapshot, false) });
    result.created++;
  }
  // Preflight all targets before writing so a later dirty file cannot leave earlier baselines refreshed.
  for (const write of writes) {
    if (
      vscode.workspace.textDocuments.some(
        (document) => document.uri.toString() === write.uri.toString() && document.isDirty,
      )
    )
      throw new Error("Save todo changes before refreshing scanner evidence.");
    if (write.before !== undefined && (await readText(write.uri)) !== write.before)
      throw new Error("A scanner todo changed while preparing the refresh; retry.");
    if (write.before === undefined) {
      try {
        await vscode.workspace.fs.stat(write.uri);
        throw new Error("A new scanner todo already exists; refresh and retry.");
      } catch (error) {
        if (!(error instanceof vscode.FileSystemError) || error.code !== "FileNotFound")
          throw error;
      }
    }
  }
  for (const write of writes) {
    if (
      vscode.workspace.textDocuments.some(
        (document) => document.uri.toString() === write.uri.toString() && document.isDirty,
      )
    )
      throw new Error("Save todo changes before refreshing scanner evidence.");
    if (write.before !== undefined) {
      if ((await readText(write.uri)) !== write.before)
        throw new Error("A scanner todo changed during refresh; retry.");
      await vscode.workspace.fs.writeFile(write.uri, Buffer.from(write.after, "utf8"));
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
  if (result.created) {
    await config.writeConfigFile({ force: true });
    await config.applyGitignore({ force: true });
  }
  await repository.refresh();
  return result;
}
