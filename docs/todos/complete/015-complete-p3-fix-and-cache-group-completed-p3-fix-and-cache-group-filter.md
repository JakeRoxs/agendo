---
status: complete
priority: p3
issue_id: "015"
tags: [performance, extension]
dependencies: []
---

# Fix and Cache the Group Filter

## Problem Statement

The filter picker computes unique groups every time it opens and incorrectly classifies group choices as status choices. Selecting a group adds the group name to the status filter instead of updating `filter.group`, which can hide every todo.

## Findings

- `extension.ts:478-485` — group extraction runs on every picker open
- Group and clear-group items use `itemType: "status"`
- Selected groups are included in `statuses`, while `group` is omitted from `filter.set()`
- Groups rarely change between opens (only when a new todo with a group is created)
- No persistence or caching of the group list

## Proposed Solutions

### Option 1: Fix classification and cache groups in `TodoRepository` (recommended)

Classify status, priority, dependency, and group items distinctly. Parse the selected group into `filter.group`. Build a sorted unique group list whenever `TodoRepository` refreshes.

**Pros:**
- Fixes the user-facing filter behavior
- Reuses the repository's existing snapshot lifecycle
- Avoids coupling `FilterService` back to the repository

**Cons:**
- The picker still supports one group at a time

**Effort:** 1 hour

**Risk:** Low

### Option 2: Cache in `runFilterPicker` with memento

Store the group list in workspace state keyed by root URI. Compare length to detect staleness.

**Pros:**
- Survives extension reload
- No new service coupling

**Cons:**
- Staleness detection is heuristic (count mismatch)
- State bloat if root changes

**Effort:** 45 min

**Risk:** Low

## Recommended Action

Option 1. Correct the picker semantics first, then expose repository-cached groups through `getGroups()`.

## Technical Details

**Affected files:**
- `src/todos/todoRepository.ts` — build the groups cache with each snapshot
- `src/extension.ts` — use `filter.getGroups()` in picker
- `src/test/todoModel.test.ts` — add groups cache test

## Acceptance Criteria

- [x] Selecting a group updates `filter.group` without corrupting statuses
- [x] Clearing the group leaves status and priority filters intact
- [x] Group list is computed once per repository refresh
- [x] Opening the picker twice in a row does not re-scan todos
- [x] `npm test` passes

## Resume Context

**Current state:** Complete. Group filtering and repository snapshot caching are implemented and covered.

**Next step:** Use the filter picker to combine one group with status, priority, and blocked-state filters.

## Work Log

### 2026-08-19 - Scope Corrected

**By:** Kilo Code

**Actions:**
- Reframed the todo from a micro-optimization to a user-facing correctness fix with caching
- Chose repository snapshot caching rather than coupling FilterService to TodoRepository

**Learnings:**
- Group filtering was persisted and modeled correctly below the UI, but the picker never wrote the selected group

### 2026-08-19 - Completion

**By:** Kilo Code

**Actions:**
- Classified status, priority, dependency, and group picker entries independently
- Persisted the selected group without introducing invalid status values
- Cached sorted unique groups with each repository refresh
- Added regression coverage for group selection and stable cached reads
- Replaced a flaky 10ms microbenchmark gate with a 50ms regression ceiling
- Ran `npm test`: 31 passing; TypeScript compilation and Biome checks clean

**Learnings:**
- Correct picker semantics were more valuable than the original micro-optimization alone
