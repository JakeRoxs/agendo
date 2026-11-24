---
status: completed
priority: p1
issue_id: "073"
tags: [bug, vscode, status, context-menu]
dependencies: []
---

# Fix Status Changes from the Right-Click Menu

Make status-change commands invoked from the todo right-click menu reliably identify and update the selected todo.

## Problem Statement

Status changes initiated from the right-click menu appear not to work. A menu-invoked command may receive a tree item or no argument rather than the internal todo node expected by its handler, causing the command to resolve no todo and do nothing.

## Findings

- Status commands are contributed to the tree item's context menu.
- Their handlers resolve the argument as an internal `TreeNode`; current tests do not simulate invocation through the context menu.
- Existing context-menu reorganization work did not address this command-argument mismatch.

## Acceptance Criteria

- [x] Each right-click status action receives or reliably resolves the selected todo from the VS Code tree view context.
- [x] Invoking each status action updates the correct todo's filename, frontmatter, and folder consistently.
- [x] Non-todo tree items and missing selections produce a safe, clear no-op or user-facing message.
- [x] Tests invoke status commands with the same argument shape supplied by the VS Code context menu and verify the resulting status transition.
- [x] Existing keyboard, command-palette, and other status-change entry points continue to work.

## Resume Context

**Current state:** Status handlers now resolve VS Code context-menu `TreeItem`s by resource URI/URI identity while preserving internal `TreeNode` callers. All context-menu, compile, lint, and full-suite tests pass.

**Next step:** None; the argument-resolution fix and regression coverage are complete.

## Work Log

### 2026-11-14 - Todo Created

**By:** Agent

**Actions:**

- Compared the report with menu contributions, command handlers, and existing tests.
- Recorded the probable argument-shape mismatch and missing invocation coverage.

**Learnings:**

- Tests that call handlers directly with internal tree nodes do not validate actual VS Code menu invocation behavior.

### 2026-11-24 - Reconfirm status menu argument mismatch

**By:** Kilo

**Actions:**

- Reopened todo 073 after reviewing the status-lifecycle centralization; that change did not update context-menu argument resolution.
- Confirmed `resolveTodo` accepts only objects with internal `kind: "todo"`, while contributed `view/item/context` status commands receive a VS Code `TreeItem` whose resource URI identifies the selected todo.

**Learnings:**

- Status persistence can be correct while the menu action remains a no-op; tests must use the actual tree-item argument contract.

### 2026-11-24 - Resolve context-menu todo selection

**By:** Kilo

**Actions:**

- Added `resolveTreeItemTodo` for VS Code tree items, preferring exact `resourceUri` and using the stable URI item ID only as a fallback; bare todo IDs are never used to resolve ambiguous selections.
- Routed status commands through the new resolver after the existing internal TreeNode path, preserving keyboard/command-palette entry points.
- Added tests for all six status commands with TreeItem-shaped arguments, internal-node compatibility, missing/stale/non-todo items, ambiguous URI matches, and an end-to-end file transition.
- `npm test`: 507 passing, 0 failing; compile and lint stages succeeded.
- Confirmed tests cover each status, the menu TreeItem shape, duplicate URI ambiguity, safe no-op selections, internal TreeNodes, and a real file move.

**Learnings:**

- Tree context-menu commands receive the selected VS Code TreeItem, not the extension's internal tree node; matching by resource URI is necessary to preserve correctness when IDs can collide.
