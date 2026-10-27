import * as assert from "node:assert";
import {
  readScanningProvenance,
  readScanningSnapshot,
  reconcileScanningSnapshot,
  type ScanningFinding,
  type ScanningProvenance,
  type ScanningSnapshot,
  scanningIdentity,
  serializeScanningSnapshot,
  validFinding,
  writeScanningProvenance,
} from "../todos/scanningSnapshot";

const PROVENANCE: ScanningProvenance = {
  source: "codeql",
  scope: "owner/repo",
  grouping: "file",
  target: "src/example.ts",
};

const NOW = "2026-10-25T22:00:00.000Z";

const BASE_FINDING: ScanningFinding = {
  id: "cql-1",
  rule: "js/no-unsafe",
  severity: "warning",
  message: "Unsafe usage",
  path: "src/example.ts",
  line: 10,
  url: "https://github.com/owner/repo/security/code-scanning/1",
};

function makeSnapshot(
  findings: ScanningFinding[],
  retrievedAt = NOW,
  provenance = PROVENANCE,
): ScanningSnapshot {
  const { snapshot } = reconcileScanningSnapshot(
    provenance,
    undefined,
    findings,
    false,
    retrievedAt,
  );
  return snapshot;
}

suite("scanningSnapshot", () => {
  test("scanningIdentity produces stable hash for same provenance", () => {
    const id = scanningIdentity(PROVENANCE);
    assert.strictEqual(id.length, 64);
    assert.strictEqual(id, scanningIdentity({ ...PROVENANCE }));
    assert.notStrictEqual(id, scanningIdentity({ ...PROVENANCE, scope: "other/repo" }));
    assert.notStrictEqual(id, scanningIdentity({ ...PROVENANCE, target: "src/other.ts" }));
    assert.notStrictEqual(id, scanningIdentity({ ...PROVENANCE, source: "sonarqube" }));
    assert.notStrictEqual(id, scanningIdentity({ ...PROVENANCE, branch: "dev" }));
  });

  test("scanningIdentity for rule grouping omits grouping from hash", () => {
    const ruleId = scanningIdentity({
      source: "codeql",
      scope: "owner/repo",
      grouping: "rule",
      target: "js/no-unsafe",
    });
    const ruleId2 = scanningIdentity({
      source: "codeql",
      scope: "owner/repo",
      grouping: "rule",
      target: "js/no-unsafe",
    });
    assert.strictEqual(ruleId, ruleId2);
  });

  test("validFinding accepts well-formed finding", () => {
    assert.ok(validFinding(BASE_FINDING));
  });

  test("validFinding rejects missing required fields", () => {
    assert.ok(!validFinding({ ...BASE_FINDING, id: "" }));
    assert.ok(!validFinding({ ...BASE_FINDING, rule: "" }));
  });

  test("validFinding rejects invalid URLs", () => {
    assert.ok(!validFinding({ ...BASE_FINDING, url: "not-a-url" }));
    assert.ok(!validFinding({ ...BASE_FINDING, url: "ftp://example.com" }));
    assert.ok(!validFinding({ ...BASE_FINDING, url: "" }));
  });

  test("validFinding rejects invalid line values", () => {
    assert.ok(!validFinding({ ...BASE_FINDING, line: 0 }));
    assert.ok(!validFinding({ ...BASE_FINDING, line: -1 }));
    assert.ok(!validFinding({ ...BASE_FINDING, line: 1.5 }));
    assert.ok(validFinding({ ...BASE_FINDING, line: 1 }));
    assert.ok(validFinding({ ...BASE_FINDING, line: undefined }));
  });

  test("validFinding accepts non-string optional fields as valid", () => {
    const finding = { ...BASE_FINDING, line: undefined };
    assert.ok(validFinding(finding));
  });

  test("readScanningProvenance reads valid frontmatter", () => {
    const identity = scanningIdentity(PROVENANCE);
    const content = `---
scan_source: codeql
scan_scope: "owner/repo"
scan_grouping: file
scan_target: "src/example.ts"
scan_identity: ${identity}
---
# Title
`;
    const result = readScanningProvenance(content);
    assert.ok(result);
    assert.deepStrictEqual(result, PROVENANCE);
  });

  test("readScanningProvenance retains a selected branch", () => {
    const provenance = { ...PROVENANCE, branch: "feature/branch-selector" };
    const content = `---
scan_source: codeql
scan_scope: "owner/repo"
scan_grouping: file
scan_target: "src/example.ts"
scan_branch: "feature/branch-selector"
scan_identity: ${scanningIdentity(provenance)}
---
`;
    assert.deepStrictEqual(readScanningProvenance(content), provenance);
  });

  test("readScanningProvenance rejects mismatched identity", () => {
    const identity = scanningIdentity({ ...PROVENANCE, scope: "wrong/repo" });
    const content = `---
scan_source: codeql
scan_scope: "owner/repo"
scan_grouping: file
scan_target: "src/example.ts"
scan_identity: ${identity}
---
`;
    assert.throws(() => readScanningProvenance(content), /identity/);
  });

  test("readScanningProvenance returns undefined for missing frontmatter", () => {
    assert.strictEqual(readScanningProvenance("no frontmatter"), undefined);
  });

  test("readScanningProvenance returns undefined for invalid source", () => {
    const content = `---
scan_source: unknown
scan_scope: "owner/repo"
scan_grouping: file
scan_target: "src/example.ts"
scan_identity: x
---
`;
    assert.strictEqual(readScanningProvenance(content), undefined);
  });

  test("writeScanningProvenance writes and preserves user fields", () => {
    const content = `---
title: My Todo
custom_field: preserved
---
# Body
User content here
`;
    const snapshot = makeSnapshot([BASE_FINDING], NOW, {
      ...PROVENANCE,
      branch: "feature/branch-selector",
    });
    const written = writeScanningProvenance(content, snapshot, true);
    assert.ok(written.includes("scan_source: codeql"));
    assert.ok(written.includes('scan_scope: "owner/repo"'));
    assert.ok(written.includes("scan_grouping: file"));
    assert.ok(written.includes('scan_target: "src/example.ts"'));
    assert.ok(written.includes('scan_branch: "feature/branch-selector"'));
    assert.ok(written.includes("scan_review_required: true"));
    assert.ok(written.includes("title: My Todo"));
    assert.ok(written.includes("custom_field: preserved"));
    assert.ok(written.includes("# Body"));
    assert.ok(written.includes("User content here"));
  });

  test("writeScanningProvenance overwrites existing scan fields", () => {
    const content = `---
scan_source: old-source
scan_scope: "old-scope"
scan_grouping: finding
scan_target: "old-target"
scan_branch: "old-branch"
scan_refreshed_at: "2020-01-01T00:00:00Z"
scan_review_required: false
---
`;
    const snapshot = makeSnapshot([BASE_FINDING]);
    const written = writeScanningProvenance(content, snapshot, false);
    assert.ok(!written.includes("old-source"));
    assert.ok(!written.includes("old-scope"));
    assert.ok(!written.includes("old-branch"));
    assert.ok(written.includes("scan_source: codeql"));
    assert.ok(written.includes("scan_review_required: false"));
  });

  test("readScanningSnapshot reads valid snapshot from content", () => {
    const snapshot = makeSnapshot([BASE_FINDING]);
    const serialized = serializeScanningSnapshot(snapshot);
    const content = `# Title
${serialized}
`;
    const result = readScanningSnapshot(content, PROVENANCE);
    assert.ok(result);
    assert.strictEqual(result.version, 1);
    assert.strictEqual(result.findings.length, 1);
    assert.strictEqual(result.findings[0].id, "cql-1");
  });

  test("readScanningSnapshot returns undefined when no marker present", () => {
    assert.strictEqual(readScanningSnapshot("no snapshot here", PROVENANCE), undefined);
  });

  test("readScanningSnapshot rejects tampered snapshot", () => {
    const snapshot = makeSnapshot([BASE_FINDING]);
    const tampered = { ...snapshot, scope: "tampered/scope" };
    const serialized = `<!-- agendo:scan-snapshot
${JSON.stringify(tampered)}
-->`;
    assert.throws(() => readScanningSnapshot(serialized, PROVENANCE), /mismatched/);
  });

  test("readScanningSnapshot rejects duplicate finding IDs", () => {
    const snapshot = makeSnapshot([BASE_FINDING]);
    snapshot.findings.push({
      id: "cql-1",
      rule: "js/other",
      severity: "warning",
      message: "Dup",
      path: "src/other.ts",
      url: "https://example.com",
      returned: true,
    });
    const serialized = serializeScanningSnapshot(snapshot);
    assert.throws(() => readScanningSnapshot(serialized, PROVENANCE), /Invalid/);
  });

  test("serializeScanningSnapshot escapes HTML comment injection", () => {
    const finding: ScanningFinding = {
      ...BASE_FINDING,
      message: "<script>alert(1)</script>",
    };
    const snapshot = makeSnapshot([finding]);
    const serialized = serializeScanningSnapshot(snapshot);
    assert.ok(serialized.includes("\\u003cscript"));
    assert.ok(!serialized.includes("<script>"));
    const result = readScanningSnapshot(serialized, PROVENANCE);
    assert.ok(result);
    assert.strictEqual(result.findings[0].message, "<script>alert(1)</script>");
  });

  test("serializeScanningSnapshot round-trips JSON strings with backslashes and quotes", () => {
    const finding: ScanningFinding = {
      ...BASE_FINDING,
      message: 'He said "hello \\n world"',
      path: "src\\windows\\file.ts",
    };
    const snapshot = makeSnapshot([finding]);
    const serialized = serializeScanningSnapshot(snapshot);
    const result = readScanningSnapshot(serialized, PROVENANCE);
    assert.ok(result);
    assert.strictEqual(result.findings[0].message, 'He said "hello \\n world"');
    assert.strictEqual(result.findings[0].path, "src\\windows\\file.ts");
  });

  test("serializeScanningSnapshot uses String.raw form for escaped backslash", () => {
    const finding: ScanningFinding = {
      ...BASE_FINDING,
      message: "path with <tag>",
    };
    const snapshot = makeSnapshot([finding]);
    const serialized = serializeScanningSnapshot(snapshot);
    // String.raw produces \u003c (single backslash in JSON), not \\u003c (escaped backslash)
    assert.ok(serialized.includes("\\u003ctag"), "expected \\u003c escape in serialized output");
    assert.ok(!serialized.includes("\\\\u003c"), "should not contain double-escaped backslash");
    const result = readScanningSnapshot(serialized, PROVENANCE);
    assert.ok(result);
    assert.strictEqual(result.findings[0].message, "path with <tag>");
  });

  test("scanningIdentity stable for same provenance components", () => {
    const id1 = scanningIdentity(PROVENANCE);
    const id2 = scanningIdentity({
      source: "codeql",
      scope: "owner/repo",
      grouping: "file",
      target: "src/example.ts",
    });
    assert.strictEqual(id1, id2);
    assert.strictEqual(id1.length, 64);
  });

  test("scanningIdentity distinguishes branch presence", () => {
    const withoutBranch = scanningIdentity(PROVENANCE);
    const withBranch = scanningIdentity({ ...PROVENANCE, branch: "dev" });
    assert.notStrictEqual(withoutBranch, withBranch);
  });

  test("reconcileScanningSnapshot sort is a separate statement (findings sorted by ID)", () => {
    const f2: ScanningFinding = {
      ...BASE_FINDING,
      id: "cql-10",
      url: "https://github.com/owner/repo/security/code-scanning/10",
    };
    const f1: ScanningFinding = {
      ...BASE_FINDING,
      id: "cql-2",
      url: "https://github.com/owner/repo/security/code-scanning/2",
    };
    const result = reconcileScanningSnapshot(PROVENANCE, undefined, [f2, f1], false, NOW);
    assert.strictEqual(result.snapshot.findings[0].id, "cql-10");
    assert.strictEqual(result.snapshot.findings[1].id, "cql-2");
  });

  test("reconcileScanningSnapshot detects added findings", () => {
    const previous = makeSnapshot([BASE_FINDING]);
    const newFinding: ScanningFinding = {
      ...BASE_FINDING,
      id: "cql-2",
      url: "https://github.com/owner/repo/security/code-scanning/2",
    };
    const { snapshot, changes } = reconcileScanningSnapshot(
      PROVENANCE,
      previous,
      [BASE_FINDING, newFinding],
      false,
      NOW,
    );
    assert.strictEqual(changes.added, 1);
    assert.strictEqual(snapshot.findings.length, 2);
  });

  test("reconcileScanningSnapshot detects changed findings", () => {
    const previous = makeSnapshot([BASE_FINDING]);
    const changedFinding: ScanningFinding = {
      ...BASE_FINDING,
      message: "Updated message",
    };
    const { changes } = reconcileScanningSnapshot(
      PROVENANCE,
      previous,
      [changedFinding],
      false,
      NOW,
    );
    assert.strictEqual(changes.changed, 1);
    assert.strictEqual(changes.added, 0);
    assert.strictEqual(changes.unchanged, 0);
  });

  test("reconcileScanningSnapshot detects unchanged findings", () => {
    const previous = makeSnapshot([BASE_FINDING]);
    const { changes } = reconcileScanningSnapshot(PROVENANCE, previous, [BASE_FINDING], false, NOW);
    assert.strictEqual(changes.unchanged, 1);
    assert.strictEqual(changes.added, 0);
    assert.strictEqual(changes.changed, 0);
  });

  test("reconcileScanningSnapshot tracks notReturned findings", () => {
    const previous = makeSnapshot([BASE_FINDING]);
    const { snapshot, changes } = reconcileScanningSnapshot(PROVENANCE, previous, [], false, NOW);
    assert.strictEqual(changes.notReturned, 1);
    const missing = snapshot.findings.find((f) => f.id === "cql-1");
    assert.ok(missing);
    assert.strictEqual(missing.returned, false);
  });

  test("reconcileScanningSnapshot stable IDs across line moves", () => {
    const previous = makeSnapshot([BASE_FINDING]);
    const movedFinding: ScanningFinding = {
      ...BASE_FINDING,
      line: 42,
      path: "src/moved.ts",
    };
    const { snapshot, changes } = reconcileScanningSnapshot(
      PROVENANCE,
      previous,
      [movedFinding],
      false,
      NOW,
    );
    assert.strictEqual(changes.changed, 1);
    const updated = snapshot.findings.find((f) => f.id === "cql-1");
    assert.ok(updated);
    assert.strictEqual(updated.path, "src/moved.ts");
    assert.strictEqual(updated.line, 42);
  });

  test("reconcileScanningSnapshot retains repeated missing findings", () => {
    const previous = makeSnapshot([BASE_FINDING]);
    const result = reconcileScanningSnapshot(PROVENANCE, previous, [], false, NOW);
    assert.strictEqual(result.changes.notReturned, 1);
    const again = reconcileScanningSnapshot(PROVENANCE, result.snapshot, [], false, NOW);
    assert.strictEqual(again.changes.notReturned, 0);
    assert.strictEqual(again.changes.unchanged, 0);
  });

  test("reconcileScanningSnapshot handles reappearance of missing finding", () => {
    const previous = makeSnapshot([BASE_FINDING]);
    const disappeared = reconcileScanningSnapshot(PROVENANCE, previous, [], false, NOW);
    assert.strictEqual(disappeared.changes.notReturned, 1);
    const reappeared = reconcileScanningSnapshot(
      PROVENANCE,
      disappeared.snapshot,
      [BASE_FINDING],
      false,
      NOW,
    );
    assert.strictEqual(reappeared.changes.changed, 1);
    const finding = reappeared.snapshot.findings.find((f) => f.id === "cql-1");
    assert.ok(finding);
    assert.strictEqual(finding.returned, true);
  });

  test("reconcileScanningSnapshot counts existing legacy as uncompared", () => {
    const findings = [BASE_FINDING];
    const result = reconcileScanningSnapshot(PROVENANCE, undefined, findings, true, NOW);
    assert.strictEqual(result.changes.uncompared, 1);
    assert.strictEqual(result.changes.added, 0);
  });

  test("reconcileScanningSnapshot rule context dedup by rule ID", () => {
    const f1: ScanningFinding = {
      ...BASE_FINDING,
      ruleTitle: "Rule A",
      ruleDescription: "Desc A",
    };
    const f2: ScanningFinding = {
      ...BASE_FINDING,
      id: "cql-2",
      rule: "js/no-unsafe",
      url: "https://github.com/owner/repo/security/code-scanning/2",
      ruleTitle: "Rule A updated",
      ruleDescription: "Desc A updated",
    };
    const result = reconcileScanningSnapshot(PROVENANCE, undefined, [f1, f2], false, NOW);
    const rule = result.snapshot.rules.find((r) => r.id === "js/no-unsafe");
    assert.ok(rule);
    assert.strictEqual(rule.title, "Rule A updated");
    assert.strictEqual(result.snapshot.rules.length, 1);
  });

  test("readScanningSnapshot rejects invalid version", () => {
    const snapshot = makeSnapshot([BASE_FINDING]);
    snapshot.version = 2 as never;
    const serialized = serializeScanningSnapshot(snapshot);
    assert.throws(() => readScanningSnapshot(serialized, PROVENANCE), /Invalid/);
  });

  test("readScanningSnapshot rejects invalid retrievedAt", () => {
    const snapshot = makeSnapshot([BASE_FINDING]);
    snapshot.retrievedAt = "not-a-date";
    const serialized = serializeScanningSnapshot(snapshot);
    assert.throws(() => readScanningSnapshot(serialized, PROVENANCE), /Invalid/);
  });

  test("writeScanningProvenance preserves CRLF line endings", () => {
    const content = "---\r\ntitle: Test\r\n---\r\n# Body\r\n";
    const snapshot = makeSnapshot([BASE_FINDING]);
    const written = writeScanningProvenance(content, snapshot, false);
    assert.ok(written.includes("\r\n"));
  });

  test("scanningIdentity differs for different grouping values", () => {
    const fileId = scanningIdentity({
      source: "codeql",
      scope: "owner/repo",
      grouping: "file",
      target: "src/example.ts",
    });
    const ruleId = scanningIdentity({
      source: "codeql",
      scope: "owner/repo",
      grouping: "rule",
      target: "src/example.ts",
    });
    const findingId = scanningIdentity({
      source: "codeql",
      scope: "owner/repo",
      grouping: "finding",
      target: "src/example.ts",
    });
    assert.notStrictEqual(fileId, ruleId);
    assert.notStrictEqual(fileId, findingId);
    assert.notStrictEqual(ruleId, findingId);
  });

  test("reconcileScanningSnapshot sorts findings by ID", () => {
    const f2: ScanningFinding = {
      ...BASE_FINDING,
      id: "cql-10",
      url: "https://github.com/owner/repo/security/code-scanning/10",
    };
    const f1: ScanningFinding = {
      ...BASE_FINDING,
      id: "cql-2",
      url: "https://github.com/owner/repo/security/code-scanning/2",
    };
    const result = reconcileScanningSnapshot(PROVENANCE, undefined, [f2, f1], false, NOW);
    assert.strictEqual(result.snapshot.findings[0].id, "cql-10");
    assert.strictEqual(result.snapshot.findings[1].id, "cql-2");
  });

  test("reconcileScanningSnapshot deduplicates rules used by findings", () => {
    const f1: ScanningFinding = {
      ...BASE_FINDING,
      rule: "js/rule-a",
      ruleTitle: "Rule A",
    };
    const f2: ScanningFinding = {
      ...BASE_FINDING,
      id: "cql-2",
      rule: "js/rule-b",
      url: "https://github.com/owner/repo/security/code-scanning/2",
      ruleTitle: "Rule B",
    };
    const result = reconcileScanningSnapshot(PROVENANCE, undefined, [f1, f2], false, NOW);
    assert.strictEqual(result.snapshot.rules.length, 2);
    assert.strictEqual(result.snapshot.rules[0].id, "js/rule-a");
    assert.strictEqual(result.snapshot.rules[1].id, "js/rule-b");
  });

  test("validFinding rejects non-string fields", () => {
    assert.ok(!validFinding({ ...BASE_FINDING, id: 123 as never }));
    assert.ok(!validFinding({ ...BASE_FINDING, severity: null as never }));
  });

  test("reconcileScanningSnapshot keeps previous returned state for unchanged", () => {
    const previous = makeSnapshot([BASE_FINDING]);
    const { changes } = reconcileScanningSnapshot(PROVENANCE, previous, [BASE_FINDING], false, NOW);
    assert.strictEqual(changes.unchanged, 1);
  });

  test("reconcileScanningSnapshot changed when previously not returned", () => {
    const previous = makeSnapshot([BASE_FINDING]);
    const disappeared = reconcileScanningSnapshot(PROVENANCE, previous, [], false, NOW);
    const reappeared = reconcileScanningSnapshot(
      PROVENANCE,
      disappeared.snapshot,
      [BASE_FINDING],
      false,
      NOW,
    );
    assert.strictEqual(reappeared.changes.changed, 1);
  });

  test("scanningIdentity is deterministic for rule grouping", () => {
    const id1 = scanningIdentity({
      source: "codeql",
      scope: "owner/repo",
      grouping: "rule",
      target: "js/no-unsafe",
    });
    const id2 = scanningIdentity({
      source: "codeql",
      scope: "owner/repo",
      grouping: "rule",
      target: "js/no-unsafe",
    });
    assert.strictEqual(id1, id2);
  });

  test("writeScanningProvenance throws when frontmatter missing", () => {
    const snapshot = makeSnapshot([BASE_FINDING]);
    assert.throws(
      () => writeScanningProvenance("no frontmatter", snapshot, false),
      /frontmatter is missing/,
    );
  });
});
