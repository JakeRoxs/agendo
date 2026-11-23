---
status: pending
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

- [ ] Each right-click status action receives or reliably resolves the selected todo from the VS Code tree view context.
- [ ] Invoking each status action updates the correct todo's filename, frontmatter, and folder consistently.
- [ ] Non-todo tree items and missing selections produce a safe, clear no-op or user-facing message.
- [ ] Tests invoke status commands with the same argument shape supplied by the VS Code context menu and verify the resulting status transition.
- [ ] Existing keyboard, command-palette, and other status-change entry points continue to work.

## Resume Context

**Current state:** Pending triage; investigation indicates a mismatch between menu arguments and handler resolution.

**Next step:** Reproduce through the tree context-menu invocation and implement a shared, tested argument-resolution path.

## Work Log

### 2026-11-14 - Todo Created

**By:** Agent

**Actions:**

- Compared the report with menu contributions, command handlers, and existing tests.
- Recorded the probable argument-shape mismatch and missing invocation coverage.

**Learnings:**

- Tests that call handlers directly with internal tree nodes do not validate actual VS Code menu invocation behavior.
