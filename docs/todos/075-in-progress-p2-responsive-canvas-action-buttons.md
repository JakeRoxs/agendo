---
status: in-progress
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

- [x] Edit, Copy Context, and Settings buttons display only their existing icons when the canvas is below the 900px container-width threshold.
- [x] Button labels return when sufficient toolbar width is available.
- [x] Icon-only controls retain accessible names and usable hover/focus tooltips via `aria-label` and native `title`.
- [x] Responsive behavior is shared by todo and group canvas toolbars and does not introduce toolbar overflow.
- [x] Tests cover the responsive breakpoint and preserve existing button behavior.
- [x] Board view toolbar controls also collapse to icon-only below the compact breakpoint, retaining accessible names/tooltips and action behavior.

## Resume Context

**Current state:** Responsive icon-only behavior is implemented for todo and group toolbars. Board view has a separate toolbar and is being extended to use compact icon-only controls below its own inline-size breakpoint; visual confirmation in an embedded canvas remains pending.

**Next step:** Run the canvas tests and compile, then verify todo/group and board controls in an embedded canvas at narrow and wide widths.

## Work Log

### 2026-11-16 - Todo Created

**By:** Kilo

**Actions:**

- Recorded the request for Edit, Copy Content, and Settings labels to collapse to icon-only controls on narrow canvases.
- Added acceptance criteria for restoring labels at wider widths, accessibility, and responsive tests.

**Learnings:**

- None yet

### 2026-11-26 - Responsive Toolbar Implementation

**By:** Kilo

**Actions:**

- Started implementation after confirming todo and group views share toolbar markup/styles and the toolbar's width varies independently of viewport width.
- Added a shared actions wrapper and a 620px CSS container-query breakpoint for icon-only controls; labels remain visible above the breakpoint.
- Preserved native `title` tooltips and `aria-label` accessible names on Edit, Copy Context, and Settings buttons.
- Added CSS/markup regression tests for the narrow/wide rules, toolbar wrappers, and the controls' labels, accessible names, and tooltips.
- Ran `npm run test:canvas` (301 tests passed), `npm run compile`, `node --check` for the changed module/test, and `git diff --check`.
- Biome was attempted on the modified canvas files but reports both paths are ignored by repository configuration.

**Learnings:**

- Todo/group views share the page toolbar; the board canvas has a separate toolbar and does not render these Edit/Copy/Settings actions.
- The implementation keeps the existing visible action label "Copy Context" and its existing clipboard behavior (the todo refers to this action as Copy Content).
- Board view has separate Refresh, Filter, Search, Clear Filters, Card settings/Close card settings, and Settings controls; responsive changes must preserve their scoped commands and settings state.

### 2026-11-27 - Extend Responsive Controls to Board View

**By:** Kilo

**Actions:**

- Added inline SVG icons and label spans to each board toolbar control, with accessible names and native titles; the card-settings toggle updates both as it changes between open and closed.
- Reused the shared canvas-toolbar container width for the board-only query, so compact mode tracks available canvas width without affecting todo/group controls.
- Kept narrow-mode labels in the accessibility tree using visually hidden text in addition to the buttons' `aria-label` and native `title`.
- Added regression assertions for board responsive styling, labels, names, settings-toggle semantics, and existing command dispatch.
- Ran `npm run test:canvas` (302 passed), `npm run compile`, and `git diff --check`.

**Learnings:**

- Automated checks cannot confirm the embedded canvas appearance; keep this item in progress until narrow and wide board rendering is visually confirmed.

### 2026-11-27 - Integration Review

**By:** Kilo

**Actions:**

- Bound the board-only container query to the shared canvas toolbar width so it follows available canvas space while remaining scoped to board controls.
- Kept label text in the accessibility tree in compact mode using visually hidden text, alongside `aria-label` and native `title`.
- Re-ran `npm run test:canvas` (302 passed), `npm run compile`, and `git diff --check`.

**Learnings:**

- Embedded narrow/wide visual verification is still pending; automated source tests do not exercise container-query layout.

### 2026-11-26 - Review responsive toolbar implementation

**By:** Kilo

**Actions:**

- Reviewed the shared toolbar markup, container-query styles, and regression coverage. Independent review found no concrete implementation defects.
- Confirmed `npm run test:canvas` passed (301 tests), `npm run compile` passed, and `git diff --check` passed.
- Moved todo 075 to `ready` with filename and frontmatter synchronized.

**Learnings:**

- Automated tests assert the container-query breakpoint and retained accessible names; embedded visual verification remains the final confirmation.

### 2026-11-26 - Raise Compact Toolbar Breakpoint

**By:** Kilo

**Actions:**

- Raised the shared container-query breakpoint from 620px to 900px so action labels collapse before the toolbar reaches the wrapping layout shown in the report.
- Updated the CSS regression assertion to require the new threshold; existing accessible names, tooltips, and button behavior are unchanged.

**Learnings:**

- The previous 620px threshold allowed the action labels to remain visible at widths where the toolbar was already wrapping.
