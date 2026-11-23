---
status: pending
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

- [ ] SonarQube and CodeQL imports report meaningful progress as findings are processed, such as current file and imported/total counts when available.
- [ ] Progress updates advance during long imports and finish or report cancellation/failure accurately.
- [ ] Indeterminate progress is used when totals are not available; the UI does not imply inaccurate percentages.
- [ ] Cancellation behavior is preserved or explicitly handled without leaving partial state inconsistent.
- [ ] Tests cover progress reporting for both scanner sources, including empty or unknown totals where applicable.

## Resume Context

**Current state:** Pending triage; import progress exists only at a high level.

**Next step:** Trace both import pipelines and identify the units of work and totals available for progress reporting.

## Work Log

### 2026-11-14 - Todo Created

**By:** Agent

**Actions:**

- Compared the request with existing scanner-related todos and import behavior.
- Recorded the missing granular progress feedback.

**Learnings:**

- Progress should reflect actual pipeline work and avoid inventing a total when none is known.
