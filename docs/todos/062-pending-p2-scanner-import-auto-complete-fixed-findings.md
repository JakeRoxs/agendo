---
status: pending
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

- [ ] Import queries both open and fixed/closed alerts to determine finding state
- [ ] When all findings for a todo are fixed/closed, the import transitions the todo to completed
- [ ] When some findings are fixed and some remain open, the todo stays in its current status with updated evidence
- [ ] The import reports how many todos were auto-completed
- [ ] Tests cover auto-completion, partial fixes, and no-change scenarios

## Resume Context

**Current state:** Investigation complete. The import logic in `codeScanningService.ts` only queries `state: "open"` alerts and never updates todo status based on fixed findings.

**Next step:** Modify the import to query both open and fixed alerts, and auto-complete todos when all findings are resolved.

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
