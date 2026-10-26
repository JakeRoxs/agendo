---
status: complete
priority: p2
issue_id: "022"
tags: [ui, board, settings, customization]
dependencies: []
---

# Board Card Customization

Add board-local controls for choosing which metadata appears on task cards and in what order.

## Problem Statement

Board cards currently use a fixed metadata row. External keys now appear there, but users cannot reduce clutter or prioritize the metadata most useful to their workflow.

## Findings

- Column visibility and order already persist through VS Code workspace state.
- Card metadata is presentation state and should not be written into todo files.
- The board webview can render settings from the same snapshot used for columns and cards.
- The initial settings scaffold now supports metadata visibility and ordering.
- Additional options should be staged by value so the panel does not become an unrestricted layout editor.

## Proposed Solutions

### Option 1: Board-local settings panel

Add a compact settings panel to the board toolbar with field visibility controls and drag ordering.

**Pros:** Immediate feedback, discoverable, workspace-specific.

**Cons:** Adds webview interaction and persistence code.

**Effort:** Medium

**Risk:** Low

### Option 2: VS Code configuration settings

Expose arrays and booleans through the extension settings page.

**Pros:** Native settings synchronization and validation.

**Cons:** Poor preview of card changes and awkward ordering controls.

**Effort:** Low

**Risk:** Low

### Additional customization scope

Extend the board-local panel incrementally with:

- Card density: compact, comfortable, or spacious
- Column sorting by default order, priority, ID, title, created time, or modified time
- Description previews with hidden, one-line, and two-line modes
- Automatic hiding of empty columns
- Reset-to-defaults support
- Optional metadata labels
- Relative, short, or full date formatting
- Configurable tag limits with overflow counts
- Card accent modes for priority, status, blocked state, or none
- Narrow, standard, or wide columns
- Limits for completed and cancelled cards
- Missing-value and title-wrapping behavior
- Saved board presets
- Per-column sorting
- Work-in-progress indicators
- Quick card actions for status, priority, and external-ticket opening
- Optional grouping within columns by priority, group, or epic

## Recommended Action

Continue the board-local settings panel backed by workspace state. Implement reset defaults, card density, column sorting, and description previews next, then evaluate the remaining polish and workflow options without changing todo persistence.

## Acceptance Criteria

- [x] The board exposes a settings control.
- [x] Card metadata fields can be shown or hidden.
- [x] Card metadata fields can be reordered.
- [x] Preferences persist in workspace state.
- [x] External tracking keys remain visible by default.
- [x] Existing board status controls continue to work.
- [x] Settings can be reset to defaults.
- [x] Card density can be changed.
- [x] Cards can be sorted within columns.
- [x] Description preview length can be configured.
- [x] Empty columns can be hidden automatically.
- [x] Metadata label and date-format presentation can be configured.
- [x] Tag count, title wrapping, and missing-value behavior can be configured.
- [x] Card accent and column width can be configured.
- [x] Completed and cancelled card counts can be limited.
- [x] Saved presets and per-column sort rules are evaluated or implemented.
- [x] WIP indicators, quick actions, and within-column grouping are evaluated or implemented.

## Resume Context

**Current state:** Board customization and workflow controls are implemented and validated.

**Next step:** No further implementation is required for this todo.

## Work Log

### 2026-08-26 - Webview coverage

**By:** Kilo Code

**Actions:**
- Added a mocked webview-panel integration test that renders the real board HTML and exercises every layout preference message
- Covered panel reuse, snapshot publication, workspace-state persistence, presets, and reset behavior
- Ran the CI-equivalent `npm run test:coverage` command
- Increased `boardViewProvider.ts` line coverage from 29.7% (475/1,598) to 94.1% (1,504/1,598)
- Validated the added test with a zero-issue Sonar snippet scan

**Learnings:**
- The prior coverage gap was primarily the unexecuted multiline webview template, not untested pure board calculations
- Opening a mocked panel exercises generated HTML accurately without excluding production code from coverage

### 2026-08-26 - Message dispatcher cleanup

**By:** Kilo Code

**Actions:**
- Split the webview message dispatcher into layout routing, todo-action routing, and focused action methods
- Reduced the reported cognitive complexity below the configured Sonar threshold
- Validated with `npm test` (40 passing) and a zero-issue Sonar snippet scan

**Learnings:**
- Keeping validation and error handling inside individual todo actions prevents the top-level router from accumulating complexity as board capabilities grow

### 2026-08-26 - Advanced workflow controls completed

**By:** Kilo Code

**Actions:**
- Added Default, Compact, Focus, and Review presets backed by existing workspace preferences
- Added per-column sort overrides with global-sort fallback
- Added optional grouping by priority, group, or epic
- Added Pending and Ready WIP limits with over-limit column indicators
- Added inline status and priority actions on cards
- Added external-ticket actions that open URL keys or copy non-URL identifiers
- Added pure coverage for column-specific sorting and WIP projection
- Validated with `npm test` (40 passing, including compile and lint)

**Learnings:**
- Built-in presets provide predictable saved workspace layouts without introducing user-defined schema migration concerns
- Quick actions can reuse `StatusService`, preserving the same file lifecycle guarantees as drag-and-drop
- Per-column overrides remain understandable when global sorting stays the explicit fallback

### 2026-08-26 - Terminal card limits

**By:** Kilo Code

**Actions:**
- Added shared limits of 10, 25, 50, 100, or all cards for Complete and Cancelled columns
- Applied limits after the selected card sort so recent or prioritized terminal work remains meaningful
- Preserved total counts and rendered limited columns as `visible / total`
- Added coverage confirming active columns are not limited and terminal totals remain intact

**Learnings:**
- Applying terminal limits after sorting makes the setting predictable across sort modes
- Retaining total counts avoids making a capped terminal column look artificially small

### 2026-08-26 - Card accents and column widths

**By:** Kilo Code

**Actions:**
- Added priority, status, blocked-state, and no-accent card modes
- Added narrow, standard, and wide column layouts
- Preserved priority accents and standard columns as defaults
- Included both preferences in workspace persistence and reset behavior

**Learnings:**
- Keeping the blocked outline independent from the selected accent preserves workflow warnings in every visual mode
- Column-width presets provide useful density control without introducing fragile free-form CSS values

### 2026-08-26 - Card content controls

**By:** Kilo Code

**Actions:**
- Added configurable tag limits with overflow counts
- Added one-line, two-line, and unlimited title wrapping
- Added omit and placeholder behavior for missing optional metadata
- Added explicit status-transition assertions for synchronized folder, filename, frontmatter status, cancellation metadata, and preserved Markdown title

**Learnings:**
- Board drag-and-drop delegates to `StatusService`, which already keeps lifecycle filename, folder, and frontmatter fields synchronized while preserving todo content
- Tag overflow counts retain useful density information without rendering every tag

### 2026-08-26 - Column and metadata presentation

**By:** Kilo Code

**Actions:**
- Added automatic hiding for empty status columns
- Added optional metadata labels and relative, short, and full date formats
- Included the new preferences in workspace persistence and reset behavior
- Replaced default hidden-field array lookups with a set
- Refactored layout-message handling into focused validators and persistence helpers to reduce cognitive complexity

**Learnings:**
- Delegating each webview message to a small handler keeps preference growth from increasing dispatcher complexity
- Automatically hidden empty columns should remain separate from manually hidden statuses so they reappear as soon as matching tasks exist

### 2026-08-26 - Core appearance controls

**By:** Kilo Code

**Actions:**
- Added compact, comfortable, and spacious card density settings
- Added default, priority, ID, title, created-time, and modified-time sorting with stable ID tie breakers
- Parsed the first prose paragraph of each todo as an optional summary and added hidden, one-line, and two-line previews
- Added reset behavior for column layout and card presentation workspace state
- Added summary extraction, snapshot-default, and sorting coverage
- Validated with `npm test` (39 passing, including compile and lint)

**Learnings:**
- Filename descriptions are persistence slugs, so board previews need a separate prose summary projection
- Resetting all board presentation keys together gives users a predictable recovery path

### 2026-08-26 - Reopened for expanded customization

**By:** Kilo Code

**Actions:**
- Moved todo 022 from complete back to ready and synchronized its frontmatter status
- Added the recommended high-value, presentation-polish, and workflow customization options
- Prioritized reset defaults, density, sorting, and description previews as the next implementation slice

**Learnings:**
- Keeping broad ideas in one staged customization todo preserves the direction while allowing incremental implementation

### 2026-08-26 - Card settings completed

**By:** Kilo Code

**Actions:**
- Added a board-toolbar settings panel for card metadata
- Added visibility toggles and drag ordering for ID, external key, priority, group, blocked state, tags, and timestamps
- Persisted hidden fields and field order in VS Code workspace state
- Kept external keys visible by default and timestamps available but hidden by default
- Added snapshot defaults and field-order normalization coverage
- Validated with `npm test` (38 passing, including compile and lint)

**Learnings:**
- Presentation-only preferences fit the existing workspace-state model without affecting markdown todo data
- A normalized field list lets future releases add metadata fields without breaking saved workspace preferences

### 2026-08-26 - Scaffold started

**By:** Kilo Code

**Actions:**
- Created the approved work item after adding external-key metadata to board cards
- Selected a board-local settings panel backed by workspace state

**Learnings:**
- The existing hidden-status and status-order persistence provides a suitable pattern for card presentation preferences
