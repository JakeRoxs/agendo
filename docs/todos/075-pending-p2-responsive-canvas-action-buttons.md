---
status: pending
priority: p2
issue_id: "075"
tags: [canvas, responsive, ux]
dependencies: []
---

# Make Canvas Action Buttons Responsive

Adapt the Edit, Copy Content, and Settings buttons so their labels collapse to their displayed icons when the canvas toolbar becomes too narrow.

## Problem Statement

Canvas action buttons currently take up space for both their icons and text labels. At smaller canvas widths, these controls can crowd the toolbar and reduce room for navigation and content. A responsive icon-only mode would preserve the actions while using less horizontal space.

## Acceptance Criteria

- [ ] Edit, Copy Content, and Settings buttons display only their existing icons when the canvas is below an appropriate width threshold.
- [ ] Button labels return when sufficient toolbar width is available.
- [ ] Icon-only controls retain accessible names and usable hover/focus tooltips.
- [ ] Responsive behavior works across relevant canvas views and does not cause toolbar overflow or obscure other controls.
- [ ] Tests cover the responsive breakpoint and preserve existing button behavior.

## Resume Context

**Current state:** Pending triage; requested responsive behavior is documented.

**Next step:** Inspect shared canvas toolbar markup and styles, then choose a breakpoint based on available toolbar space.

## Work Log

### 2026-11-16 - Todo Created

**By:** Kilo

**Actions:**

- Recorded the request for Edit, Copy Content, and Settings labels to collapse to icon-only controls on narrow canvases.
- Added acceptance criteria for restoring labels at wider widths, accessibility, and responsive tests.

**Learnings:**

- None yet
