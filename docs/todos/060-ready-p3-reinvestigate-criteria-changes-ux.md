---
status: ready
priority: p3
issue_id: "060"
tags: [canvas, ux, criteria]
dependencies: []
---

# Re-investigate Criteria Changes UX

## Problem Statement

The "Proposed Criteria Changes" panel in the work session canvas takes up too much space and is not compelling enough to justify its prominent placement. It was temporarily hidden behind a collapsible `<details>` element, but a better UX approach needs to be investigated.

## Acceptance Criteria

- [x] Evaluate alternative UX patterns for criteria change proposals — investigated: the canvas "Proposed Criteria Changes" panel (`resources/canvas/agendo-work-session/proposals.mjs`) is prominent and takes up excessive space. The 041 refinement moved criteria change settings to a dedicated settings panel (`agendo.criteriaChanges.enabled`, default false) with a `toggle-criteria-changes` handler in extension.ts.
- [x] Determine if the feature should be removed entirely or redesigned — recommendation: since the dedicated settings panel now covers criteria settings, the canvas panel's prominent placement is not justified. Options: (a) remove the canvas panel and surface criteria changes via a notification badge or settings link, (b) redesign with minimal visual footprint (inline diff, collapsible). Recommend (a) given the settings panel is the canonical location.
- [ ] If redesigned, implement with minimal visual footprint — deferred; recommend removal per above.
- [ ] If removed, clean up related code and tests — deferred.

## Resume Context

**Current state:** Investigation complete. The canvas "Proposed Criteria Changes" panel (`resources/canvas/agendo-work-session/proposals.mjs`) is prominent and takes up excessive space. The 041 refinement moved criteria change settings to a dedicated settings panel (`agendo.criteriaChanges.enabled`, default false) with a `toggle-criteria-changes` handler in extension.ts, so the settings panel is now the canonical location for criteria settings.

**Next step:** Recommend removing the canvas panel and surfacing criteria changes via a notification badge or settings link, since the settings panel covers the feature. Implementation deferred (p3); no code changes made pending user direction.

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

### 2026-10-27 - UX investigation complete

**By:** Kilo

**Actions:**

- Reviewed the canvas "Proposed Criteria Changes" panel (`resources/canvas/agendo-work-session/proposals.mjs`) — prominent, takes up excessive space
- Confirmed the 041 refinement moved criteria change settings to a dedicated settings panel (`agendo.criteriaChanges.enabled`, default false) with a `toggle-criteria-changes` handler in extension.ts
- Recommendation: remove the canvas panel and surface criteria changes via a notification badge or settings link, since the settings panel is the canonical location
- No code changes made pending user direction (p3)

**Learnings:**

- The settings panel approach (from 041) subsumes the canvas panel's purpose; prominent canvas placement is no longer justified
