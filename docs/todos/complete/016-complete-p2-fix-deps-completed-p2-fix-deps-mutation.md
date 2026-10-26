---
status: complete
priority: p2
issue_id: "016"
tags: [bug, correctness, extension]
dependencies: []
---

# Fix Silent Mutation of `todo.dependencies` in `setDependencies`

## Problem Statement

`statusService.ts:98` mutates the input `todo.dependencies` array in place via `.sort()`:

```ts
if (JSON.stringify(todo.dependencies.sort()) === JSON.stringify([...newDependencies].sort())) {
```

This is a silent side effect: the caller's cached `Todo` object gets its `dependencies` array reordered. While the current values are the same (so functionally correct), it violates the expectation that `Todo` objects from the repository are stable, and it can confuse debugging or any code that compares reference equality on the array.

## Findings

- `statusService.ts:98` — `todo.dependencies.sort()` mutates in place
- Same pattern appears in `setGroup` at line 139 (`.replace().replace().replace()`) but that one is safe
- `extension.ts` passes the todo from the tree provider, which holds repository-cached objects

## Proposed Solutions

### Option 1: Spread before sort (recommended)

```ts
if (JSON.stringify([...todo.dependencies].sort()) === JSON.stringify([...newDependencies].sort())) {
```

**Pros:**
- One-line fix, zero behavior change
- Clear intent

**Cons:**
- None

**Effort:** 5 min

**Risk:** Low

### Option 2: Extract a pure `arraysEqualSorted` helper

**Pros:**
- Reusable, self-documenting

**Cons:**
- Over-engineering for a single callsite

**Effort:** 15 min

**Risk:** Low

## Recommended Action

Option 1. One-line fix. Add a test that verifies the input array is unmutated.

## Technical Details

**Affected files:**
- `src/todos/statusService.ts:98` — fix mutation
- `src/test/todoModel.test.ts` — add mutation-immunity test

## Acceptance Criteria

- [x] `todo.dependencies` is not mutated by `setDependencies`
- [x] `npm test` passes
- [x] Dependency comparison sorts copies of both arrays

## Work Log

### 2026-08-19 - Completion

**By:** Kilo Code

**Actions:**
- Changed dependency comparison to sort a spread copy instead of the repository-owned array
- Preserved dependency output formatting and verified the full suite passes

**Learnings:**
- Repository snapshots should remain immutable across status-service comparisons
