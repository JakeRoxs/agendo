---
status: ready
priority: p2
issue_id: "070"
tags: [code-scanning, import, ux]
dependencies: []
---

# Show Progress During Code-Scanning Imports

Provide useful progress feedback while importing SonarQube or CodeQL findings so users can tell that work is continuing and understand how much remains.

## Problem Statement

Code-scanning imports can take a while, but current progress feedback is high-level and does not indicate which file or finding is being processed or how many have been imported. This makes a slow import appear stalled.

## Findings

- The import path already uses a progress notification, but does not report granular per-file, per-finding, or count progress.
- Existing scanner-refresh and finding-checklist todos cover related scanner behavior but not import progress.

## Acceptance Criteria

- [x] SonarQube and CodeQL imports report meaningful progress as import groups are processed, with current group and completed/total counts.
- [x] Progress updates advance for each group; success, failure, and cancellation are reported without claiming uncommitted groups were written.
- [x] Fetch remains indeterminate until findings are available; determinate group progress starts once group totals are known.
- [x] Cancellation is checked after preflight and immediately before writes; once sequential mutation begins it runs to completion.
- [x] Tests cover group progress for both scanner sources, empty totals, cancellation before mutation, and successful completion.

## Resume Context

**Current state:** Both native scanner imports report indeterminate progress during fetch and determinate group counts during import. Cancellation is checked immediately before mutation, and regression coverage passes.

**Next step:** Verify progress and cancellation behavior in the VS Code notification UI, then complete the todo.

## Work Log

### 2026-11-26 - Add Scanner Import Progress

**By:** Agent

**Actions:**

- Transitioned todo 070 from pending to in-progress with synchronized filename and frontmatter.
- Added import-group progress callbacks to the shared CodeQL/SonarQube import pipeline and wired them into the import notification.
- Added regression coverage for advancing group counts in both sources and empty imports.
- `npm run compile` passed.
- `npm test -- --grep "scanner import progress"` passed the full extension suite: 561 passing; the test harness does not filter by grep.
- `git diff --check` passed.

**Learnings:**

- Import-group totals are known after finding grouping; CodeQL scanner-fetch totals are not available until pagination completes, so the existing notification remains indeterminate during fetch.
- Cancellation is checked before any todo writes begin; once writing starts, the mutation sequence is allowed to finish to avoid inconsistent partial state.
- The first test run found and corrected a fixture collision with pre-existing groups; the subsequent full suite passed.

### 2026-11-26 - Close Staging Cancellation Race

**By:** Agent

**Actions:**

- Added a cancellation predicate to the shared import service and check it after write preflight, immediately before `writeImportResults`.
- The command reports cancellation without starting mutations; the sequential write loop has no cancellation checks.
- Added regression coverage that requests cancellation on the final staging progress callback, asserts the import creates no files, then confirms a non-cancelled import completes.
- `npm run compile && npm test` passed: 562 extension tests, including the new staging-cancellation regression.
- `git diff --check` passed.

**Learnings:**

- Checking only before invoking the import service leaves a race while refresh/group/staging/preflight are running; the checkpoint must be at the service's mutation boundary.

### 2026-11-14 - Todo Created

**By:** Agent

**Actions:**

- Compared the request with existing scanner-related todos and import behavior.
- Recorded the missing granular progress feedback.

**Learnings:**

- Progress should reflect actual pipeline work and avoid inventing a total when none is known.

### 2026-11-26 - Close scanner import cancellation race

**By:** Kilo

**Actions:**

- Added a cancellation checkpoint after preflight and immediately before `writeImportResults`; the sequential write phase is not interrupted once started.
- Added regression coverage proving cancellation after staging leaves files unchanged and that a normal import still succeeds.
- Ran `npm run compile` (passed), `npm test` (562 passing), and `git diff --check` (passed).
- Moved todo 070 to `ready`, synchronizing filename and frontmatter.

**Learnings:**

- Fetch progress remains indeterminate until findings are materialized; group counts become reliable after grouping. Cancellation must be checked at the final pre-mutation boundary to avoid partial writes.
