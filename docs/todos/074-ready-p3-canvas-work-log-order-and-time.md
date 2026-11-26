---
status: ready
priority: p3
issue_id: "074"
tags: [canvas, work-log, ux]
dependencies: []
---

# Order Canvas Work Logs Newest First and Show Time

Make canvas work-log entries easier to scan by showing the newest entries first and including a more specific date/time for reliable ordering.

## Problem Statement

Canvas work-log items currently appear in file order, placing older activity before recent activity, and their date headings provide only day-level precision. Recent work can be difficult to find, and same-day entries cannot be ordered reliably by their displayed date.

## Findings

- The canvas parser retains work-log entries in source order and the page renders them in that order.
- Work-log headings are generally written with date-only precision.
- No existing todo tracks reverse ordering or timestamp precision.

## Acceptance Criteria

- [x] Canvas work-log entries are displayed in reverse chronological order, newest first.
- [x] Newly generated work-log headings include a consistent, more specific time (UTC via ISO-8601 `Z`).
- [x] Existing date-only headings remain readable and sort deterministically at day start UTC, without changing their displayed headings.
- [x] Entries with timestamps, including multiple entries on the same day, are sorted by the actual instant.
- [x] Tests cover ordering, same-day timestamps, legacy date-only entries, and mixed-format behavior.

## Resume Context

**Current state:** All implementation criteria are met. Work-log entries sort newest-first, and automated writers emit ISO-8601 UTC headings.

**Next step:** Verify behavior in the canvas and confirm the completed acceptance criteria.

## Work Log

### 2026-11-26 - Integrate and verify work-log ordering

**By:** Kilo

**Actions:**

- Reviewed the parser, scanner and clipboard-import writers, regression tests, and synchronized todo status.
- Ran `npm run test:canvas` (300 tests passed), `npm test -- --grep 'Clipboard import refresh reporting'` (560 tests passed), `npm run compile` (passed), and `git diff --check` (passed).

**Learnings:**

- All identified automated work-log writers now produce timestamped headings compatible with canvas ordering.

### 2026-11-26 - Align clipboard-import work-log timestamps

**By:** Agent

**Actions:**

- Changed clipboard import to write its existing created-from URL text under an ISO-8601 UTC `###` heading, compatible with canvas ordering.
- Extended clipboard import regression coverage to inspect the generated file content and assert the timestamp format and URL.
- Ran `npm test -- --grep 'Clipboard import refresh reporting'` (560 tests passed) and `npm run compile` (passed).

**Learnings:**

- Clipboard import was the remaining identified automated writer using an inline date-only bullet instead of a dated work-log heading.

### 2026-11-26 - Implement timestamped newest-first canvas work logs

**By:** Agent

**Actions:**

- Transitioned todo 074 from `pending` to `in-progress`, synchronizing filename and frontmatter.
- Updated `resources/canvas/agendo-work-session/todos.mjs` to sort entries newest-first; ISO timestamps sort by actual instant, and legacy date-only headings use deterministic day-start UTC while retaining their original display text.
- Updated scanner auto-completion heading generation in `src/todos/codeScanningService.ts` to use ISO-8601 UTC timestamps.
- Added tests for mixed formats, date-only ordering, same-day timestamp ordering, timezone offsets, and stable ordering for equivalent instants.
- Ran `npm run test:canvas` (300 tests passed) and `npm run compile` (passed).

**Learnings:**

- A legacy date-only heading is ordered as midnight UTC on its stated day; this gives a deterministic comparison without pretending the entry has a known time.
- The first regression run exposed an incorrect test expectation: a timestamp after midnight correctly sorts after that date's legacy day-start. Corrected the assertion and reran successfully.

### 2026-11-14 - Todo Created

**By:** Agent

**Actions:**

- Compared the request with canvas work-log parsing, rendering, and entry creation.
- Recorded compatibility needs for older date-only entries.

**Learnings:**

- Reliable chronological order requires a defined timestamp format while preserving legacy entries.
