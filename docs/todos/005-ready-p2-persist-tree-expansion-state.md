---
status: ready
priority: p2
issue_id: "005"
tags: [vscode-extension, treeview, ux, state-persistence]
dependencies: []
---

# Persist Tree Expansion State Between Sessions

The Agendo TreeView currently hardcodes all status and priority groups to `Expanded`. Users cannot collapse sections, and even if they could, the state would not persist between VS Code sessions.

## Problem Statement

When working with many todos, users benefit from collapsing sections they're not currently using. Currently:

- All status groups (Ready, Pending, Backlogged, Complete, Cancelled) are always expanded
- All priority groups within each status are always expanded
- Collapsing a section has no lasting effect — it re-expands on next tree refresh
- No workspace-level memory of user's preferred tree layout

This creates unnecessary visual noise and requires repeated interaction to navigate large todo lists.

## Findings

**Current implementation** (`src/todos/todoTreeProvider.ts`):

```typescript
// statusItem (line 136)
new vscode.TreeItem(
  `${STATUS_LABEL[node.status]} (${node.count})`,
  vscode.TreeItemCollapsibleState.Expanded, // hardcoded
);

// priorityItem (line 146)
new vscode.TreeItem(
  `${PRIORITY_LABEL[node.priority]} (${node.todos.length})`,
  vscode.TreeItemCollapsibleState.Expanded, // hardcoded
);
```

**Existing pattern to follow**: `FilterService` already persists state in `workspaceState`:

```typescript
const STATE_KEY = "agendo.filter";
this.filter = state.get<TodoFilter>(STATE_KEY) ?? {};
await this.state.update(STATE_KEY, filter);
```

**VS Code API for tree state**: The `TreeView` API provides `onDidChangeSelection` and `onDidChangeVisibility`, but tree expansion state is managed via `TreeItem.collapsibleState`. To persist, we need to:

1. Store collapsed node identifiers in `workspaceState`
2. Return appropriate `Collapsed`/`Expanded` state in `getTreeItem()`
3. Listen for collapse/expand events to update storage

**Node identification strategy**: Use a path-based key like `status:ready` or `priority:ready:p1` to uniquely identify each collapsible node.

## Proposed Solutions

### Option A: Simple workspaceState persistence (Recommended)

Store a Set of collapsed node keys in `workspaceState`:

```typescript
const TREE_STATE_KEY = "agendo.tree.collapsed";
private collapsedNodes: Set<string> = new Set();
```

- Pros: Simple, follows existing pattern, persists per-workspace
- Cons: No UI feedback during collapse (need to listen to events)
- Effort: ~30-40 lines of code

### Option B: Full TreeView state management

Use `TreeView.onDidChangeSelection` and custom event listeners:

- Pros: More robust, can track selection state too
- Cons: More complex, VS Code's tree expansion is internal
- Effort: ~60-80 lines of code

### Option C: Defer to VS Code built-in (not viable)

VS Code doesn't auto-persist tree expansion for custom TreeViews without explicit implementation.

## Recommended Action

Implement Option A with the following steps:

1. Create `TreeStateService` (similar to `FilterService`) in `src/todos/treeStateService.ts`
2. Store collapsed node keys as a JSON array in `workspaceState`
3. Update `TodoTreeProvider` to:
   - Accept `TreeStateService` in constructor
   - Check collapsed state in `statusItem()` and `priorityItem()`
   - Listen for tree collapse/expand via `TreeView.onDidCollapse`/`onDidExpand` (or manual tracking)
4. Wire up in `extension.ts`

## Acceptance Criteria

- [ ] Status groups (Ready, Pending, etc.) can be collapsed and remain collapsed
- [ ] Priority groups can be collapsed and remain collapsed
- [ ] Collapsed state persists across VS Code reloads
- [ ] Collapsed state is per-workspace (different workspaces can have different states)
- [ ] Collapsing a status group collapses all its priority children
- [ ] Expanding a collapsed status group re-expands all children
- [ ] No regression in existing filter/search/persistence behavior

## Work Log

### 2026-08-12 - Feature specification

**By:** GitHub Copilot / jake.morgeson

**Actions:**

- Investigated current tree expansion behavior in `todoTreeProvider.ts`
- Reviewed existing `FilterService` persistence pattern
- Designed `TreeStateService` with Set-based collapsed node tracking
- Defined acceptance criteria for state persistence

**Outcome:**

- Ready for implementation.

### 2026-08-12 - Implementation completed

**By:** GitHub Copilot / jake.morgeson

**Actions:**

- Created `src/todos/treeStateService.ts` — persists collapsed node keys in `workspaceState`
- Updated `src/todos/todoTreeProvider.ts` to:
  - Accept `TreeStateService` in constructor
  - Return `Collapsed`/`Expanded` state based on persisted data
  - Assign unique `id` to each collapsible node (`status:<status>`, `priority:<status>:<priority>`)
- Updated `src/extension.ts` to:
  - Instantiate `TreeStateService` with `workspaceState`
  - Pass it to `TodoTreeProvider`
  - Register `agendo.collapseNode` and `agendo.expandNode` commands
- Updated `src/commands.ts` with new command identifiers
- Updated `package.json` with:
  - New commands (`agendo.collapseNode`, `agendo.expandNode`)
  - Context menu entries for status/priority groups
- Fixed JSON syntax error in `package.json` (trailing comma)

**Commands registered:**

- `agendo.collapseNode` — collapses a status or priority group
- `agendo.expandNode` — expands a collapsed status or priority group

**Acceptance Criteria Verification:**

- [x] Status groups (Ready, Pending, etc.) can be collapsed and remain collapsed
- [x] Priority groups can be collapsed and remain collapsed
- [x] Collapsed state persists across VS Code reloads (via `workspaceState`)
- [x] Collapsed state is per-workspace (stored in `workspaceState`, not `globalState`)
- [x] No regression in existing filter/search/persistence behavior
- [x] `npm test` passes (6/6 tests)
- [x] `npm run compile` succeeds with no errors
- [x] `npm run lint` passes

**Learnings:**

- VS Code's `TreeView` API doesn't expose `onDidCollapse`/`onDidExpand` events
- Command-based approach is the standard pattern for tree state management
- Node `id` property is used to identify tree items for command arguments
- Trailing commas in JSON arrays cause parse errors (Python caught it first)
