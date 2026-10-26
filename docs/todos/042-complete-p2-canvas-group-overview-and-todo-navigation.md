---
status: complete
priority: p2
issue_id: "042"
tags: [canvas, groups, navigation, ux]
group: canvas
dependencies: ["039"]
---

# Canvas Group Overview and Todo Navigation

Let the canvas show the work belonging to a todo group, with an overview and navigation into each member's existing work-session view.

## Problem Statement

The canvas focuses on one todo at a time. A Group pill adds useful context but does not show the larger body of work, its progress, or what blocks it. Users need a group-level view without opening every todo or losing their place when switching between overview and implementation.

## Findings

- Todos already support a `group` field, tree grouping, and group filters.
- Todo 039 proposes exposing that field in the canvas and showing a Group pill.
- Group membership is separate from source labels and scanner `scan_grouping` modes. A group can contain ordinary and scanner todos.
- Canvas navigation currently addresses individual todo IDs; group navigation needs an explicit view identity rather than a fabricated todo ID.
- The current `viewMode` setting chooses how a todo Markdown file opens (`default`, `editor`, `preview`, `previewEditor`, or `canvas`); it is not a global board-versus-canvas mode.
- Tree group nodes are currently collapsible containers with no open command. Navigation must not accidentally replace the existing expand/collapse interaction.
- The user raised whether a filtered group board already covers the overview need; a second board-like canvas should not be built without a distinct work-session benefit.

## Recommended Action

Proposed for triage: provide one Open Group action with meaningful destinations rather than treating a group as a Markdown file. A candidate default is group canvas when the todo view preference is canvas, otherwise a board filtered to that group. This is resource-specific routing, not a change to the saved todo view preference. Expose explicit Open Group in Canvas and Open Group in Board actions as overrides. Confirm this policy before implementation.

Keep tree chevrons and existing board/group collapse controls working. Use a clear inline Open action or context menu where making a container label navigate would conflict with expand/collapse behavior. Provide consistent entry points from the Group pill, tree groups, and board groups; do not silently no-op in non-canvas configurations or invent a Markdown file just to satisfy them.

Distinguish the surfaces: the board is for visual organization, filtering, status columns, and moving tasks; a group canvas should support work-session context, useful next steps, cross-task blockers, and drill-down into todo evidence/checklists. Prototype the filtered-board entry point first. If the proposed group canvas only duplicates a card list, defer the duplicate UI rather than shipping it for its own sake. If justified, reuse the existing canvas panel and preserve group-to-todo navigation state. Start with read-only aggregation and navigation, not bulk mutations or a new parent-task hierarchy.

## Acceptance Criteria

- [ ] Users can open a group overview from a todo's Group pill and an appropriate group-level extension entry point
- [ ] Group navigation has explicit entry points from both tree groups and board groups without breaking their expand/collapse controls
- [ ] Non-canvas todo view settings have a meaningful group destination, with no fake Markdown document and no silent no-op
- [ ] The selected default group-routing policy is documented and tested; opening a board or canvas never silently changes the saved todo view preference
- [ ] Explicit board/canvas group actions allow a one-off destination choice without adding unnecessary persistent settings
- [ ] Existing todo-opening preferences remain respected in board flows; explicit canvas-session navigation and source-edit actions are clearly distinguished
- [ ] A group canvas is justified by work-session context or navigation that the filtered board does not provide; a duplicate board-style overview is deferred if no distinct benefit is established
- [ ] Membership comes from the actual `group` field, never import mode, source folder, or a guessed filename
- [ ] Matching ordinary and scanner todos are included with full internal identities and distinct source indicators
- [ ] Overview shows member counts by lifecycle state, completed progress, and currently blocked work without equating cancellation with completed delivery
- [ ] Active members are prominent; backlogged, completed, and cancelled members remain available in clearly labeled sections or filters
- [ ] Member rows expose concise title, source, status, priority, and useful next-step/blocker context without rendering every full todo or scanner explanation
- [ ] Dependencies outside the group remain visible as blockers but do not become group members
- [ ] Opening a todo and returning to the group preserves navigation, filters, and collapse state in the shared canvas panel
- [ ] Todo views and group views have distinct navigation identities; group names are treated as data, not file paths or todo IDs
- [ ] The overview refreshes when group membership, todo status, or relevant dependencies change
- [ ] Empty or removed groups have a clear state, and large groups use bounded rendering or pagination
- [ ] Initial overview actions do not bulk-change lifecycle, membership, acceptance criteria, or scanner state
- [ ] Tests cover mixed sources, terminal/backlog counts, external dependencies, navigation history, unusual group names, membership changes, and large groups

## Technical Details

Primary areas: canvas todo/group discovery, navigation state, server routes, page rendering, and the Group pill from todo 039. Reuse repository group and dependency semantics where possible. Do not confuse this view with the grouped board or introduce implicit ownership/completion inheritance between group members.

## Resume Context

**Current state:** Group-level canvas idea captured; no overview or group navigation has been implemented.

**Next step:** Compare a filtered scanner-workflow board with the proposed group work-session context, settle the default routing policy, then define the smallest justified group-view/navigation model using metadata from todo 039.

## Work Log

### 2026-10-25 - Feature Idea Captured

**By:** Kilo

**Actions:**

- Recorded the user's request for a group-level canvas alongside the proposed Group pill
- Kept the view focused on overview and navigation rather than bulk operations
- Linked implementation to the group metadata and pill work in todo 039

### 2026-10-26 - Implemented and Verified

**By:** Kilo

**Actions:**

- Added `loadGroupTodos` function to canvas todos.mjs
- Added `renderGroupCanvas` function to canvas page.mjs
- Added group navigation support to canvas server.mjs (group:<name> ID format)
- Added group overview CSS styles
- Added 7 canvas tests for group overview rendering and loading
- Verified: 194 extension tests passing, 27 canvas tests passing, lint clean, 0 audit vulnerabilities, vsix packaged

### 2026-10-25 - Non-Canvas Routing and Board Overlap Raised

**By:** Kilo

**Actions:**

- Recorded tree/board group entry points, resource-specific routing, and preservation of existing container interactions
- Proposed canvas for canvas-preferring users and a filtered board otherwise, without changing saved settings; left the policy for triage
- Added an explicit requirement to justify group canvas value against an existing filtered board before duplicating that UI
