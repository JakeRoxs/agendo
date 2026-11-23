---
status: pending
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

- [ ] Canvas work-log entries are displayed in reverse chronological order, newest first.
- [ ] Newly generated work-log headings include a consistent, more specific time (with an explicit or well-defined timezone convention).
- [ ] Existing date-only headings remain readable and sort deterministically without inventing timestamps.
- [ ] Entries with timestamps, including multiple entries on the same day, are sorted by the actual date/time.
- [ ] Tests cover ordering, same-day timestamps, legacy date-only entries, and any mixed-format behavior.

## Resume Context

**Current state:** Pending triage; canvas renders parsed work-log entries in source order and dates have day-level precision.

**Next step:** Choose a timestamp format and timezone convention, then update parsing/rendering and work-log creation paths compatibly.

## Work Log

### 2026-11-14 - Todo Created

**By:** Agent

**Actions:**

- Compared the request with canvas work-log parsing, rendering, and entry creation.
- Recorded compatibility needs for older date-only entries.

**Learnings:**

- Reliable chronological order requires a defined timestamp format while preserving legacy entries.
