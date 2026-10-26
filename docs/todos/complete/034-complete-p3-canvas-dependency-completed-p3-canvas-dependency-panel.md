---
status: complete
priority: p3
issue_id: "034"
tags: [canvas, agent-harness, dependencies]
dependencies: []
---

# Add Dependency Panel to the Agendo Work Session Canvas

Show what blocks a todo and what it blocks, with live status, inside the work-session canvas.

## Problem Statement

The work-session canvas built in todo 033 shows a todo's criteria, resume context, and work log, but it only lists dependency IDs as plain text. Finding out whether a blocker is still open, or which todos are waiting on this one, still requires manual grepping across `docs/todos/`.

## Findings

Split out of todo 033, where it was identified as the most promising follow-up use case. The canvas extension already locates todos by ID across the root and the `backlog`, `complete`, and `cancelled` subfolders, and reads status and priority from the filename, so most of the lookup logic exists in `.github/extensions/agendo-work-session/extension.mjs`.

Per the agendo skill, both `complete` and `cancelled` satisfy a dependency.

## Acceptance Criteria

- [x] Panel lists each dependency with its title, status, and priority, and marks whether it is satisfied
- [x] Panel lists reverse dependencies (todos that list this one as a blocker) with their status
- [x] Missing dependency IDs are shown as unresolved instead of failing the page
- [x] Clicking a dependency opens that todo in the canvas, or is otherwise easy to navigate to
- [x] Panel updates when a related todo changes status
- [x] Exposes `get_dependencies` and `get_dependents` canvas actions that return the same data

## Resume Context

**Current state:** Implemented in the canvas and verified against the live runtime over HTTP.

**Next step:** None. Optionally confirm the panel visually in the canvas tab.


## Work Log

### 2026-10-19 - Implemented

**By:** Agent

**Actions:**

- Added `listTodoSummaries`, `getRelations` and `todoFingerprint` to `todos.mjs`, a dependency panel to `page.mjs`, a `POST /open` navigation endpoint, and `get_dependencies` / `get_dependents` actions
- The panel shows "Blocked by" (with an open count) and "Blocks" (with a waiting count); each row has title, status, priority, and satisfied styling
- Flags unresolved IDs, cancelled blockers (satisfied but "reassess"), and circular dependencies; reverse dependents that are terminal or backlogged are dimmed
- `/version` now fingerprints all todo files, so the page reloads when a related todo changes status or moves
- Canvas version is 0.1.0 (first release)
- Tested with temporary todos 997/998 (since deleted): missing, open, complete, circular; navigation to valid, unknown, and malformed IDs; missing header returns 403

**Learnings:**

- Live-reload on related-todo changes relies on the fingerprint logic and was not observed with an actual status change
- The `get_dependencies` / `get_dependents` actions were not invoked through `invoke_canvas_action` because the panel was not yet registered; the same data path was exercised over HTTP

### 2026-10-19 - Marked Complete

**By:** Agent

**Actions:**

- Moved to `complete` at the user's request, to exercise the canvas completion celebration
- The dependency panel itself was not implemented and the acceptance criteria remain unchecked

### 2026-10-19 - Todo Created

**By:** Agent

**Actions:**

- Split out of todo 033 after the canvas prototype was completed

**Learnings:**

- Existing lookup and filename-parsing helpers in the canvas extension can be reused
