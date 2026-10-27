---
status: ready
priority: p2
issue_id: "062"
tags: [code-scanning, import, lifecycle]
dependencies: []
---

# Scanner Import Should Auto-Complete Todos When All Findings Are Fixed

## Problem Statement

When a scanner import runs and all findings for a todo are no longer returned (i.e., they've been fixed), the import marks them as "not returned" but does not automatically transition the todo to completed status. The user must manually complete the todo even though the scanner confirms all findings are resolved.

Currently, the import only queries for `state: "open"` alerts, so it cannot distinguish between a finding that's been fixed and one that's just not returned for other reasons.

## Acceptance Criteria

- [x] Import queries both open and fixed/closed alerts to determine finding state — `fetchCodeQL` now fetches `state=open` and `state=closed` alerts, merging and deduplicating by alert number; each finding gains a `resolved` field. `fetchPaginatedIssues` (SonarQube) no longer filters `resolved: "false"`, fetching all issues; `SonarIssue` gained a `resolved` field.
- [x] When all findings for a todo are fixed/closed, the import transitions the todo to completed — `processImportGroup` computes `allResolved` (every snapshot finding has `resolved === true`) and, when the todo is not already completed, updates frontmatter to `completed`, appends an auto-completion work log entry, and moves the file to the configured completed folder.
- [x] When some findings are fixed and some remain open, the todo stays in its current status with updated evidence — `allResolved` is false if any finding lacks `resolved === true`, so status is unchanged and only evidence is refreshed.
- [x] The import reports how many todos were auto-completed — `ScanningImportResult` gained `autoCompleted`; `ImportGroupWrite` gained `autoCompleted`; `accumulateImportResult` increments it; `writeImportResults` handles the file rename via `sourceUri`.
- [x] Tests cover auto-completion, partial fixes, and no-change scenarios — 3 new tests in `src/test/codeScanning.test.ts`.

## Resume Context

**Current state:** Auto-complete feature implemented and verified in `src/todos/codeScanningService.ts`. `fetchCodeQL` queries both `state=open` and `state=closed` alerts (finding gains `resolved` field); `fetchPaginatedIssues` fetches all SonarQube issues (no `resolved: "false"` filter). `processImportGroup` auto-completes a todo to `completed` when all its findings are `resolved === true`, moves the file to the configured completed folder, and records `autoCompleted` in the import result. Partial fixes leave status unchanged. All 3 new tests pass; compile and lint clean.

**Next step:** No further action required; the import auto-completes scanner todos when all findings are resolved. End-to-end verification requires a live scanner import (CodeQL/SonarQube credentials), which cannot be performed in this environment.

## Work Log

### 2026-10-26 - Investigation

**By:** Copilot

**Actions:**

- Identified that `codeScanningService.ts` line 368 only queries `state: "open"` alerts
- Found that `reconcileScanningSnapshot` marks missing findings as `returned: false` but never triggers status changes
- Confirmed that cql-002 was manually completed when it should have been auto-completed by the import

**Learnings:**

- The import needs to query both open and fixed alerts to get a complete picture
- Auto-completion should only happen when ALL findings for a todo are fixed
- Partial fixes should update the evidence but not change status

### 2026-10-27 - Implemented auto-complete on scanner import

**By:** Kilo (delegated to subagent, verified)

**Actions:**

- Modified `fetchCodeQL` to fetch `state=open` and `state=closed` alerts, merging/deduplicating by alert number; each finding gains a `resolved` field (`true` when `alert.state === "closed" || alert.state === "fixed"`).
- Modified `fetchPaginatedIssues` (SonarQube) to fetch all issues (removed `resolved: "false"` filter); `SonarIssue` gained a `resolved` field; `sonarIssueFinding` sets `resolved: Boolean(issue.resolved)`.
- Added auto-complete logic in `processImportGroup`: when all snapshot findings have `resolved === true` and the todo is not already completed, transitions frontmatter to `completed`, appends an auto-completion work log entry, and moves the file to the configured completed folder.
- Added `autoCompleted` counter to `ScanningImportResult`, `ImportGroupWrite`, and `ImportContext`; `writeImportResults` handles the file rename via `sourceUri`.
- Added helpers `updateFrontmatterStatus` and `addWorkLogEntry`.
- Added 3 tests in `src/test/codeScanning.test.ts`: auto-completes when all resolved, keeps status when some resolved, no auto-complete when unchanged.
- Verified: `npm run compile` clean, `npm run lint` clean, `npm test` 364 passing.

**Learnings:**

- The `resolved` field is preserved through `reconcileScanningSnapshot` (spread of `fields` for new findings, spread of `missing` for not-returned findings), so `allResolved` correctly requires every finding to be explicitly resolved.
- Auto-completion only fires when ALL findings are resolved; any not-returned (unconfirmed) finding blocks it, which is the conservative correct behavior.
