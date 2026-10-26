---
status: pending
priority: p3
issue_id: "060"
tags: [canvas, ux, criteria]
dependencies: []
---

# Re-investigate Criteria Changes UX

## Problem Statement

The "Proposed Criteria Changes" panel in the work session canvas takes up too much space and is not compelling enough to justify its prominent placement. It was temporarily hidden behind a collapsible `<details>` element, but a better UX approach needs to be investigated.

## Acceptance Criteria

- [ ] Evaluate alternative UX patterns for criteria change proposals (e.g., notification badge, settings panel, separate view, inline diff)
- [ ] Determine if the feature should be removed entirely or redesigned
- [ ] If redesigned, implement with minimal visual footprint
- [ ] If removed, clean up related code and tests

## Resume Context

**Current state:** Proposal panel hidden behind collapsible details element. Only shown when proposals exist.

**Next step:** Investigate alternative UX patterns and decide on approach.

## Work Log

### 2026-10-26 - Initial Investigation

**By:** Copilot

**Actions:**

- Identified that the "Proposed Criteria Changes" panel takes up excessive space in the canvas
- Temporarily wrapped the panel in a `<details>` element so it only appears when proposals exist and is collapsed by default
- Created this todo to investigate a better long-term solution

**Learnings:**

- The feature may not be compelling enough to justify prominent placement
- Consider whether criteria changes should be a separate workflow rather than inline in the work session view
