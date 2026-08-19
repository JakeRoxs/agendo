---
status: backlogged
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
- `src/todos/todoTreeProvider.ts`
- `src/todos/statusService.ts`
- `src/extension.ts`
- related tree state persistence code in `src/todos/treeStateService.ts`

Related components:
- VS Code TreeView and other extension UI surfaces
- file lifecycle handling for state transitions

## Resources

- Existing task grouping logic in the tree view
- Current status transitions and folder movement logic
- README roadmap notes around visual task management

## Acceptance Criteria

- [ ] Board view is available as a first-class view or mode
- [ ] Tasks are grouped by status in a clear visual layout
- [ ] Moving a task updates the task file and frontmatter consistently
- [ ] Existing file-based conventions remain the source of truth
- [ ] The feature works without introducing a separate task database

## Work Log

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
