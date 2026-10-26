import { createHash } from "node:crypto";
import type { ScanningFinding, ScanningGrouping, ScanningSource } from "./codeScanningService";

export type { ScanningFinding } from "./codeScanningService";

export interface ScanningProvenance {
  source: ScanningSource;
  scope: string;
  grouping: ScanningGrouping;
  target: string;
}

export interface FindingChanges {
  added: number;
  changed: number;
  unchanged: number;
  notReturned: number;
  uncompared: number;
}

export interface ScanningSnapshot extends ScanningProvenance {
  version: 1;
  retrievedAt: string;
  findings: Array<Omit<ScanningFinding, "ruleTitle" | "ruleDescription"> & { returned: boolean }>;
  rules: Array<{ id: string; title?: string; description?: string }>;
}

const SNAPSHOT = /<!-- agendo:scan-snapshot\n([\s\S]*?)\n-->/;

export function scanningIdentity(provenance: ScanningProvenance): string {
  const { source, scope, grouping, target } = provenance;
  return createHash("sha256")
    .update(
      JSON.stringify(
        grouping === "rule" ? [source, scope, target] : [source, scope, grouping, target],
      ),
    )
    .digest("hex");
}

export function validFinding(finding: ScanningFinding): boolean {
  try {
    return (
      [
        finding.id,
        finding.rule,
        finding.severity,
        finding.message,
        finding.path,
        finding.url,
      ].every((value) => typeof value === "string") &&
      Boolean(finding.id && finding.rule) &&
      ["http:", "https:"].includes(new URL(finding.url).protocol) &&
      (finding.line === undefined || (Number.isInteger(finding.line) && finding.line > 0))
    );
  } catch {
    return false;
  }
}

export function readScanningProvenance(content: string): ScanningProvenance | undefined {
  const header = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content)?.[1];
  if (!header) return;
  const field = (name: string): string | undefined => {
    const value = new RegExp(`^${name}:\\s*([^\\r\\n]*)$`, "m").exec(header)?.[1].trim();
    if (value === undefined) return;
    if (value.startsWith('"')) {
      const decoded: unknown = JSON.parse(value);
      if (typeof decoded !== "string") throw new Error("Invalid scanner provenance.");
      return decoded;
    }
    return value;
  };
  const source = field("scan_source");
  const scope = field("scan_scope");
  const grouping = field("scan_grouping");
  const target = field("scan_target");
  if (
    !scope ||
    target === undefined ||
    !["codeql", "sonarqube"].includes(source || "") ||
    !["file", "rule", "finding"].includes(grouping || "")
  )
    return;
  const provenance = {
    source: source as ScanningSource,
    scope,
    grouping: grouping as ScanningGrouping,
    target,
  };
  if (field("scan_identity") !== scanningIdentity(provenance)) {
    throw new Error(
      "Scanner provenance does not match its identity; re-import the original scope/grouping.",
    );
  }
  return provenance;
}

export function writeScanningProvenance(
  content: string,
  snapshot: ScanningSnapshot,
  review: boolean,
): string {
  const header = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!header) throw new Error("Scanner frontmatter is missing.");
  const eol = header[0].includes("\r\n") ? "\r\n" : "\n";
  const lines = header[1]
    .split(/\r?\n/)
    .filter(
      (line) => !/^scan_(?:source|scope|grouping|target|refreshed_at|review_required):/.test(line),
    );
  lines.push(
    `scan_source: ${snapshot.source}`,
    `scan_scope: ${JSON.stringify(snapshot.scope)}`,
    `scan_grouping: ${snapshot.grouping}`,
    `scan_target: ${JSON.stringify(snapshot.target)}`,
    `scan_refreshed_at: ${JSON.stringify(snapshot.retrievedAt)}`,
    `scan_review_required: ${review}`,
  );
  return `---${eol}${lines.join(eol)}${eol}---${eol}${content.slice(header[0].length)}`;
}

export function readScanningSnapshot(
  content: string,
  provenance: ScanningProvenance,
): ScanningSnapshot | undefined {
  const match = SNAPSHOT.exec(content);
  if (!match) return;
  const snapshot = JSON.parse(match[1]) as ScanningSnapshot;
  if (
    snapshot?.version !== 1 ||
    !Number.isFinite(Date.parse(snapshot.retrievedAt)) ||
    snapshot.source !== provenance.source ||
    snapshot.scope !== provenance.scope ||
    snapshot.grouping !== provenance.grouping ||
    snapshot.target !== provenance.target ||
    !Array.isArray(snapshot.findings) ||
    !snapshot.findings.every((f) => validFinding(f) && typeof f.returned === "boolean") ||
    new Set(snapshot.findings.map((f) => f.id)).size !== snapshot.findings.length ||
    !Array.isArray(snapshot.rules) ||
    !snapshot.rules.every(
      (rule) =>
        typeof rule.id === "string" &&
        (rule.title === undefined || typeof rule.title === "string") &&
        (rule.description === undefined || typeof rule.description === "string"),
    )
  ) {
    throw new Error("Invalid or mismatched scanner snapshot; restore it before refreshing.");
  }
  return snapshot;
}

export function serializeScanningSnapshot(snapshot: ScanningSnapshot): string {
  return `<!-- agendo:scan-snapshot\n${JSON.stringify(snapshot).replace(/</g, "\\u003c")}\n-->`;
}

export function reconcileScanningSnapshot(
  provenance: ScanningProvenance,
  previous: ScanningSnapshot | undefined,
  findings: ScanningFinding[],
  existing: boolean,
  retrievedAt: string,
): { snapshot: ScanningSnapshot; changes: FindingChanges } {
  const old = new Map(previous?.findings.map((f) => [f.id, f]) ?? []);
  const rules = new Map(previous?.rules.map((rule) => [rule.id, rule]) ?? []);
  const changes = { added: 0, changed: 0, unchanged: 0, notReturned: 0, uncompared: 0 };
  const current = findings.map((finding) => {
    const { ruleTitle, ruleDescription, ...fields } = finding;
    if (ruleTitle || ruleDescription)
      rules.set(finding.rule, { id: finding.rule, title: ruleTitle, description: ruleDescription });
    const observation = { ...fields, returned: true };
    const before = old.get(finding.id);
    old.delete(finding.id);
    if (existing && !previous) changes.uncompared++;
    else if (!before) changes.added++;
    else if (
      ["rule", "severity", "message", "path", "line", "url"].some(
        (key) => before[key as keyof typeof fields] !== fields[key as keyof typeof fields],
      ) ||
      !before.returned
    )
      changes.changed++;
    else changes.unchanged++;
    return observation;
  });
  for (const missing of old.values()) {
    if (missing.returned) {
      current.push({ ...missing, returned: false });
      changes.notReturned++;
    } else {
      current.push(missing);
    }
  }
  const usedRules = new Set(current.map((finding) => finding.rule));
  return {
    snapshot: {
      ...provenance,
      version: 1,
      retrievedAt,
      findings: current.sort((a, b) => a.id.localeCompare(b.id)),
      rules: [...rules.values()]
        .filter((rule) => usedRules.has(rule.id))
        .sort((a, b) => a.id.localeCompare(b.id)),
    },
    changes,
  };
}
