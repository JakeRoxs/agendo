---
status: complete
priority: p2
issue_id: "008"
tags: [groups, epics, organization, workflow]
dependencies: []
---

# Task Groups and Epic-Like Organization

Add grouping or epic-like task organization so related work can be rolled up and tracked together without losing the granular task detail underneath.

## Problem Statement

As the task list grows, some work naturally belongs together as a larger initiative. Without a way to group related items, the task list becomes harder to reason about and easier to lose context on what is a part of a broader effort.

## Findings

- The repo already has strong status and priority organization.
- A logical next layer is grouping related todos into a higher-level thematic container.
- This helps both human triage and AI handoff because the broader objective is explicit.
- The concept feels aligned with an “epic” model without requiring a full project management system.

## Proposed Solutions

### Option 1: Lightweight group tags and grouping

**Approach:** Add group/epic metadata to todo files and allow the tree view to build collapsible groups around it.

**Pros:**
- Simple, file-based, and easy to reason about
- Fits markdown conventions well
- Useful for both humans and agents

**Cons:**
- Group semantics must be carefully designed to avoid overcomplication
- Some tasks may belong to multiple groups

**Effort:** 3-5 hours

**Risk:** Low

---

### Option 2: Group hierarchy with epic summaries

**Approach:** Allow a group to have a summary file or title and nested subtasks.

**Pros:**
- Better for large initiatives
- Stronger for roadmap and planning work

**Cons:**
- More metadata and UI complexity
- Higher maintenance burden in the extension

**Effort:** 6-9 hours

**Risk:** Medium

## Recommended Action

Implement lightweight task groups using metadata tags or explicit grouping fields, with enough structure to support epic-like organization without turning Agendo into a full project tracker.

## Technical Details

Affected files:
- `src/todos/todoModel.ts`
- `src/todos/todoTreeProvider.ts`
- `src/todos/filterService.ts`
- task parsing and UI grouping logic

Related components:
- existing tag support
- future board and dependency features

## Resources

- current tag-based filtering in the repo
- skill and template conventions for metadata and work tracking

## Acceptance Criteria

- [x] Related tasks can be grouped under a common umbrella concept
- [x] Grouping remains lightweight and file-based
- [x] Users can still filter and manage tasks individually within a group
- [x] The pattern supports both human planning and agent handoff workflows

## Work Log

### 2026-08-13 - Initial Discovery

**By:** Copilot

**Actions:**
- Reviewed the repo's existing grouping model based on status and priority
- Identified "epic-like" grouping as the next conceptual layer for organization

**Learnings:**
- The extension already has a strong single-task model; group support should be additive
- This supports planning without overloading the product with project management features

### 2026-08-14 - Implementation

**By:** GitHub Copilot / jake.morgeson

**Actions:**
- Added `group?: string` field to `Todo` interface in `src/todos/todoModel.ts`
- Wired `group` parsing from frontmatter in `parseTodo()`
- Added `GroupNode` type to `src/todos/todoTreeProvider.ts`
- Updated `getChildren()` to surface group nodes under status groups when todos have groups
- Updated `getTreeNodeKey()` to handle `group:` prefixed keys
- Added `groupItem()` method to render group nodes with `symbol-class` icon
- Updated `getTreeItem()` to route group nodes to `groupItem()`
- Extended `TodoFilter` in `src/todos/filterService.ts` with `group?: string`
- Added group filtering logic to `matches()` in `FilterService`
- Added `setGroup()` to `StatusService` for programmatic group updates
- Added `agendo.setGroup` command to `src/commands.ts`
- Updated `package.json` with new command and context menu entry
- Updated `runFilterPicker()` in `extension.ts` to include group filter options
- Added "── Groups ──" separator and dynamic group picks in filter picker
- Added unit tests for group filter matching and `setGroup()` behavior
- Triage: moved `008` from `pending` → `ready`

**Commands registered:**
- `agendo.setGroup` — set or clear the group for a todo

**Acceptance Criteria Verification:**
- [x] Related tasks can be grouped under a common umbrella concept
- [x] Grouping remains lightweight and file-based
- [x] Users can still filter and manage tasks individually within a group
- [x] The pattern supports both human planning and agent handoff workflows
- [x] `npm run compile` succeeds
- [x] `npm run lint` passes (3 warnings — non-null assertions in tests, exit 0)

**Learnings:**
- Group nodes sit between status and priority in the tree hierarchy
- The `as const` literal type is needed to satisfy TypeScript's inference for union arrays
- Explicit node type arrays (`GroupNode[]`, `PriorityNode[]`) avoid spread-inference issues
- The filter picker dynamically pulls existing groups from the repository snapshot

### 2026-08-19 - Completion

**By:** Kilo Code

**Actions:**
- Replaced the accidental duplicate dependency handler with the missing `SetGroup` registration
- Verified group parsing, tree grouping, filtering, setting, and clearing behavior
- Confirmed the full VS Code extension suite passes with 29 tests

**Learnings:**
- Command registration coverage is necessary because contribution metadata alone cannot detect a missing runtime handler

## Notes

- Keep the user-facing model simple: a few group labels and optional metadata first
- The first version should help organization, not become a mini PM tool
