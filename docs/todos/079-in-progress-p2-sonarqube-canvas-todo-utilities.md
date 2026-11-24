---
status: in-progress
priority: p2
issue_id: "079"
tags: [sonarqube, code-quality, canvas]
dependencies: []
---

# Refactor Sonar findings in canvas todo utilities

Address the current SonarQube/SonarLint diagnostics in `resources/canvas/agendo-work-session/todos.mjs` without changing todo discovery, serialization, or status semantics.

## Problem Statement

The live VS Code Problems snapshot reports 24 SonarQube rule warnings in this recently changed canvas utility file, including several regex performance findings and high-complexity functions. The diagnostics do not include stable server issue IDs, so this is tracked as a regular todo rather than an `sq-*` scanner import.

## Findings

- Snapshot source: live VS Code SonarLint diagnostics (`source: sonarqube`), captured 2026-11-24T18:58:05Z; no stable issue identifiers were supplied.
- `S8786` regex backtracking warnings at lines 16, 46, 52, 102, 179, and 432.
- `S3776` cognitive complexity findings at lines 37, 225, 246, 280, 302, 324, 346, 466, and 718.
- Other findings: `S3358` nested ternary (86), `S7752` map/flat (140), `S2871` sort comparisons (164, 242), `S1481`/`S1854` unused `filePath` (257), `S6557` use `startsWith` (319), `S7780` string raw literal (588), and `S7754` use `some` (737).

## Recommended Action

Refactor the flagged helpers into small, named functions, simplify or bound the regular expressions, and apply the mechanical style fixes only where they preserve current parsing/sort behavior. Keep status lifecycle, root scoping, and filesystem safety semantics unchanged.

## Resources

- Live Problems capture: SonarQube source, workspace `agendo`, captured 2026-11-24T18:58:05Z.
- No stable scanner issue IDs were returned; do not create `scan_identity` or mark independent `sq-*` findings resolved.

## Acceptance Criteria

- [ ] Address the current `S8786`, `S3776`, `S3358`, `S7752`, `S2871`, `S1481`/`S1854`, `S6557`, `S7780`, and `S7754` findings in this file or document a behavior-based disposition for any intentionally retained finding.
- [ ] Preserve filename matching, todo discovery, root/manual-root scoping, lifecycle transitions, and sort ordering.
- [ ] `npm run test:canvas` passes.
- [ ] Biome lint passes and a fresh scoped Problems check no longer reports the addressed diagnostics.

## Resume Context

**Current state:** Findings captured from the live SonarQube Problems snapshot; no code edits yet.

**Next step:** Inspect the flagged functions and refactor the regex/complexity findings in small verified groups.

## Work Log

### 2026-11-24 - Start changed-file Sonar remediation

**By:** Kilo

**Actions:**

- Captured 24 SonarQube diagnostics in this changed canvas utility file via `agendo_get_problems`.
- Recorded the live findings as a regular todo because no stable Sonar issue IDs were provided.

**Learnings:**

- Most findings concentrate in root resolution, todo lookup, status mutation, and parsing helpers; these need regression tests to preserve multi-root behavior.
