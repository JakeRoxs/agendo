---
status: complete
priority: p2
issue_id: "013"
tags: [performance, extension]
dependencies: []
---

# Precompute Dependency Graph in TodoRepository

## Problem Statement

`isBlocked(todo, allTodos)` and `getBlockedBy(todo, allTodos)` in `todoModel.ts` scan the full `allTodos` array on every call. They are invoked repeatedly:

- `FilterService.matches()` — for every todo when a blocked/dependsOn/blocking filter is active
- `TodoTreeProvider.getTreeItem()` — for every todo node to compute the blocked icon and tooltip

This is O(n²) across the tree render path and O(n·f) under filter (n = total todos, f = filter-active todos). For a workspace with hundreds of todos this becomes noticeable.

## Findings

- `todoModel.ts:66-74` — `isBlocked` builds a `Set<TERMINAL_STATUSES>`-filtered ids from scratch each call
- `todoModel.ts:79-83` — `getBlockedBy` filters `allTodos` each call
- `filterService.ts:83-98` — both called per-todo inside `matches()`
- `todoTreeProvider.ts:250-288` — `isBlocked` called per todo in `todoItem()`, plus inline dep filter at line 282

## Proposed Solutions

### Option 1: Add cached maps to `TodoRepository` (recommended)

Add `blockedByMap: Map<string, string[]>` and `blocksMap: Map<string, string[]>` computed in `refresh()`. Expose them via getters. Replace callsites to use the maps.

**Pros:**
- O(n) build, O(1) lookup
- Single source of truth for the graph
- Clean API change

**Cons:**
- Requires updating all callers to pass the map or read from repository

**Effort:** 2-3 hours

**Risk:** Low

### Option 2: Memoize in `FilterService` and `TodoTreeProvider`

Cache the result of `isBlocked` / `getBlockedBy` per-todo-id within a single render cycle.

**Pros:**
- Smaller surface change
- No repository API change

**Cons:**
- Still recomputes across refresh cycles
- Cache invalidation is fragile

**Effort:** 1 hour

**Risk:** Low

## Recommended Action

Option 1. Add `computeDependencyGraph()` to `TodoRepository` called at the end of `refresh()`. Export `getBlockedByMap()` and `getBlockingMap()`. Update `FilterService` and `TodoTreeProvider` to accept the maps (or read from repository). Update tests.

## Technical Details

**Affected files:**
- `src/todos/todoRepository.ts` — add graph computation
- `src/todos/filterService.ts` — accept graph, use maps
- `src/todos/todoTreeProvider.ts` — accept graph, use maps
- `src/test/todoModel.test.ts` — update mocks and add graph tests

**Related components:**
- `StatusService` — may also benefit from the graph for the "incomplete deps" warning

## Acceptance Criteria

- [x] `TodoRepository` exposes dependency maps
- [x] `FilterService.matches()` uses the map instead of `isBlocked`/`getBlockedBy`
- [x] `TodoTreeProvider` uses the map for blocked checks and tooltip
- [x] `npm test` passes
- [x] Benchmark shows < 10ms tree render for 200 todos

## Work Log

### 2026-08-19 - Implementation Started

**By:** Kilo Code

**Actions:**
- Reviewed current dependency call sites in the repository, filters, tree provider, and status service
- Began replacing repeated full-array scans with repository-owned dependency indexes

**Learnings:**
- The graph must preserve current semantics for missing dependencies and terminal todos while supporting O(1) blocked and reverse-dependency lookups

### 2026-08-19 - Completion

**By:** Kilo Code

**Actions:**
- Added repository-owned `blockedBy` and `blocking` maps rebuilt atomically with each refresh
- Migrated dependency-aware filtering, blocked icons, context values, and tooltips to map lookups
- Added repository graph assertions and a 200-item tree render benchmark
- Added regression coverage proving dependency comparisons do not mutate repository-owned arrays
- Ran `npm test`: 30 passing; TypeScript compilation and Biome checks clean

**Learnings:**
- Missing dependency IDs remain visible as unmet blockers, while terminal dependencies are treated as satisfied
- Building the graph once during refresh removes repeated full-repository scans from render and filter paths
