---
status: complete
priority: p3
issue_id: "006"
tags: [ui, workflow, board, task-management]
dependencies: []
---

# Board View for Task Management

Add a lightweight board-style view that lets people move tasks between grouped columns without leaving the repo-managed task model.

## Problem Statement

The current tree view is strong for filtering and status organization, but it is still a hierarchical list. For larger task sets, a board view would make it easier to scan work by state and move items quickly between columns.

## Findings

- The extension already models status and priority as first-class dimensions.
- The file system remains the source of truth, so any board view should preserve file-based storage and not introduce a separate database.
- A board can make the workflow more visual without weakening the markdown-first approach.
- The main UX goal is to reduce cognitive load when many tasks are active at once.

## Proposed Solutions

### Option 1: Minimal status columns board

**Approach:** Add a second view that groups tasks by status into columns such as Pending, Ready, Backlog, Complete, and Cancelled.

**Pros:**
- Very low complexity
- Matches existing status model
- Works well with the current repo structure

**Cons:**
- Less rich than a full Kanban app
- Fewer advanced workflow features initially

**Effort:** 3-5 hours

**Risk:** Low

---

### Option 2: Board + drag-and-drop + inline metadata

**Approach:** Add drag-and-drop cards with compact metadata like priority and tags.

**Pros:**
- Better visual workflow for frequent task updates
- Feels more like a task management app

**Cons:**
- More UI complexity
- Harder to keep consistent with file-backed tasks and extension constraints

**Effort:** 6-10 hours

**Risk:** Medium

## Recommended Action

Implement a lightweight board view that groups tasks by status and supports drag-and-drop or quick status movement while preserving the underlying markdown files and state model. Keep the first version intentionally simple and file-backed.

## Technical Details

Affected files:
- `src/todos/boardViewProvider.ts`
- `src/commandRegistration.ts`
- `src/commands.ts`
- `src/extension.ts`
- `package.json`

Related components:
- VS Code TreeView and other extension UI surfaces
- file lifecycle handling for state transitions

## Resources

- Existing task grouping logic in the tree view
- Current status transitions and folder movement logic
- README roadmap notes around visual task management

## Acceptance Criteria

- [x] Board view is available as a first-class view or mode
- [x] Tasks are grouped by status in a clear visual layout
- [x] Moving a task updates the task file and frontmatter consistently
- [x] Existing file-based conventions remain the source of truth
- [x] The feature works without introducing a separate task database

## Resume Context

**Current state:** The editor-window board implementation is complete and validated.

**Next step:** No further implementation is required for this todo.

## Work Log

### 2026-08-26 - Completed and verified

**By:** Kilo Code

**Actions:**
- Reviewed the integrated editor-board implementation and removed a stale sidebar-webview test mock
- Confirmed status columns, filtering, card metadata, persisted layout controls, and file-backed status movement are wired through existing services
- Changed the expected missing `.gitignore` case to remain silent while preserving diagnostics for genuine filesystem errors
- Validated with `npm run compile`, `npm run lint`, and `npm test` (37 passing)

**Learnings:**
- The board implementation reuses the repository and status service cleanly, so no parallel persistence model is needed
- VS Code's test host can emit unrelated provider/authentication diagnostics while the extension suite still exits successfully

### 2026-08-26 - Board card file timestamps

**By:** Copilot

**Actions:**
- Added filesystem creation and modification timestamps to todo metadata from `workspace.fs.stat`
- Exposed both values through the board card hover tooltip without adding visual clutter to the card
- Validated with `npm run compile` and `npm run lint`

**Learnings:**
- Hover details preserve board scanability better than adding another visible metadata row

### 2026-08-26 - Consolidated board-view implementation progress

**By:** Copilot

**Actions:**
- Recovered and integrated an editor-window board provider using the existing repository, filter, status, and file-backed todo model
- Added the `agendo.openBoard` command and Todos view entry while removing the sidebar board contribution
- Added status columns for Pending, Ready, Backlog, Complete, and Cancelled with task cards showing title and compact metadata
- Moved the todo ID into the smaller metadata row alongside priority, group, blocked state, and tags
- Added drag-and-drop task movement between status columns through `StatusService`
- Added per-status hide/show controls and persisted hidden statuses in workspace state
- Added draggable status-column ordering and persisted the order in workspace state
- Fixed column dragging so the header is the grab handle and text selection does not interfere
- Added priority-based left accents (`p1`, `p2`, `p3`) while retaining a separate blocked-state indicator
- Fixed command-service wiring and formatting issues found during integration
- Updated the 0.1.5 changelog with a general editor-window-first board note
- Validated the implementation with `npm run compile` and `npm run lint`

**Learnings:**
- The board can reuse the existing file-backed lifecycle without introducing a separate task database
- Workspace state is appropriate for presentation preferences such as hidden statuses and column order
- The remaining board UX details can be refined independently of task persistence and status transitions

### 2026-08-26 - Priority-based board card accents

**By:** Copilot

**Actions:**
- Updated board card left flair styling to reflect todo priority (`p1`, `p2`, `p3`)
- Kept blocked-state signaling separate from priority by using a subtle inset blocked outline
- Validated with `npm run compile` and `npm run lint`

**Learnings:**
- Priority accents are easier to scan when the blocked signal is additive instead of overriding color

### 2026-08-26 - Board visibility and status ordering controls

**By:** Copilot

**Actions:**
- Added per-status hide/show controls in the editor board; hidden status columns can be restored from the board toolbar
- Added draggable status columns with persisted ordering in VS Code workspace state
- Kept task movement file-backed through the existing `StatusService` flow
- Validated with `npm run compile` and `npm run lint`

**Learnings:**
- “Task type” maps naturally to the board’s status columns for the current model
- Layout preferences can remain independent of todo files while task content and status remain file-backed

### 2026-08-25 - Reactivated from backlog and captured current direction

**By:** Copilot

**Actions:**
- Moved todo from backlog to active root and renamed it to `006-pending-p3-board-view-for-tasks.md`
- Synced frontmatter status with filename and active-folder placement (`pending`)
- Documented the current implementation direction as editor-window-first while interaction specifics remain open

**Learnings:**
- The feature is ready for active iteration again, but card interactions and final UX behavior should stay flexible until validated in day-to-day usage

### 2026-08-25 - Recovered implementation and aligned to editor window

**By:** Copilot

**Actions:**
- Recovered board implementation artifacts from working tree and chat session storage after crash
- Confirmed a functional board provider exists in `src/todos/boardViewProvider.ts` with status columns and drag-drop status movement
- Aligned integration to editor-window usage by removing sidebar webview contribution/registration and keeping board access via `agendo.openBoard`
- Added explicit `agendo.openBoard` command contribution and view-title entry so board opens from the Todos view toolbar and Command Palette

**Learnings:**
- The board feature can remain markdown-file-backed and status-service-driven without introducing new persistence layers
- Editor panel usage is a better fit for a board layout than a narrow sidebar host
- Crash recovery was possible via local workspace state and untracked source files

### 2026-08-19 - Backlogged

**By:** Kilo Code

**Actions:**
- Moved the board view out of active consideration at the user's direction
- Prioritized smaller workflow and maintainability improvements first

**Learnings:**
- The existing tree and digest surfaces cover current needs without adding board-level UI complexity

### 2026-08-13 - Initial Discovery

**By:** Copilot

**Actions:**
- Identified the current tree view as the main task UI
- Confirmed board view is the next natural improvement in the workflow
- Framed the feature as a lightweight, markdown-backed board instead of a separate app

**Learnings:**
- Status grouping already exists in the extension; a board would mainly improve visual flow
- The feature should preserve Agendo’s repo-native, file-first model

## Notes

- Keep the first version intentionally simple to avoid overbuilding the product
- This should support the core workflow without replacing the tree view entirely
- Current direction is editor-window-first for board usage, with final interaction details intentionally left open while behavior is refined
