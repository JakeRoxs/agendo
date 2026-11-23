---
status: pending
priority: p1
issue_id: "071"
tags: [vscode, workspace, multi-root, configuration]
dependencies: []
---

# Support Multiple Todo Roots in VS Code Workspaces

Handle multi-root VS Code workspaces by supporting separate todo roots per workspace folder and letting users select or switch the directory they are viewing.

## Problem Statement

In a VS Code workspace containing multiple separate project folders, Agendo currently resolves a single workspace folder and todo root. Users need to manage todos in more than one folder and switch between those roots without opening a separate VS Code window or confusing one project's todos with another's.

## Findings

- Workspace resolution currently uses the first workspace folder in relevant configuration and canvas paths.
- No existing todo tracks multiple todo roots or active-root switching.

## Acceptance Criteria

- [ ] Discover and represent todo roots associated with each applicable workspace folder in a multi-root workspace.
- [ ] Provide a clear way to choose and switch the active todo root, and make the active root apparent in the UI.
- [ ] Scope listing, creation, status changes, search, canvas views, and scanner imports to the selected root.
- [ ] Preserve current behavior for single-folder workspaces and define behavior for folders without a configured todo root.
- [ ] Avoid collisions or accidental cross-root status changes when different roots contain the same todo ID.
- [ ] Document and test root selection, switching, and per-root configuration in a VS Code multi-root workspace.

## Resume Context

**Current state:** Pending triage; workspace-folder selection is effectively limited to the first folder.

**Next step:** Design the active-root model and enumerate extension, canvas, and settings consumers that must honor it.

## Work Log

### 2026-11-14 - Todo Created

**By:** Agent

**Actions:**

- Compared the request with workspace configuration and existing todos.
- Recorded the need for root selection and consistent scoping across extension features.

**Learnings:**

- Multi-root support must account for operations beyond displaying the todo list, especially duplicate IDs and scanner imports.
