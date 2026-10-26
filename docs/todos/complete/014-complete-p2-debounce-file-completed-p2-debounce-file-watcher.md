---
status: complete
priority: p2
issue_id: "014"
tags: [performance, extension]
dependencies: []
---

# Debounce File Watcher Events in TodoRepository

## Problem Statement

`TodoRepository.startWatching()` (`todoRepository.ts:88-101`) triggers a full `refresh()` synchronously on every create/change/delete file system event. Rapid file operations (e.g., save-with-format, multi-file save, git operations rewriting files) can fire 5-20 events in under 100ms, causing that many redundant directory scans and parses.

## Findings

- `todoRepository.ts:97-100` — three watcher listeners all call `trigger` which calls `refresh()` directly
- No debounce/coalesce logic exists
- VS Code's `FileSystemWatcher` events can fire in rapid bursts during a single editor save

## Proposed Solutions

### Option 1: Simple setTimeout debounce (recommended)

Add a private `_refreshTimer: NodeJS.Timeout | undefined`. On each event, clear the prior timer and schedule a new `refresh()` after 300-500ms. Dispose the timer in `dispose()`.

**Pros:**
- Simple, well-understood pattern
- Batches all rapid events into a single refresh
- 300-500ms is imperceptible for file-based todos

**Cons:**
- Slight delay before the tree updates after a change

**Effort:** 30 min

**Risk:** Low

### Option 2: Queue-based coalescing

Maintain a pending-refresh queue; only schedule one refresh when the queue drains.

**Pros:**
- Guarantees exactly one refresh after a burst

**Cons:**
- More code, more edge cases (queue drain on dispose)

**Effort:** 1 hour

**Risk:** Low

## Recommended Action

Option 1. Use a 400ms debounce. Add `_scheduleRefresh()` helper. Clean up timer in `dispose()`.

## Technical Details

**Affected files:**
- `src/todos/todoRepository.ts` — add debounce logic
- `src/test/todoModel.test.ts` — add test verifying rapid events coalesce

**Pattern to follow:**
```ts
private _refreshTimer: ReturnType<typeof setTimeout> | undefined;
private _scheduleRefresh(): void {
  clearTimeout(this._refreshTimer);
  this._refreshTimer = setTimeout(() => void this.refresh(), 400);
}
```

## Acceptance Criteria

- [x] Rapid successive file events (5 in 200ms) trigger only one `refresh()`
- [x] A single event still triggers `refresh()` within 500ms
- [x] Timer is cleared on `dispose()`
- [x] `npm test` passes

## Work Log

### 2026-08-19 - Implementation Started

**By:** Kilo Code

**Actions:**
- Reviewed the repository watcher lifecycle and existing watcher test coverage
- Began adding a single coalescing timer shared by create, change, and delete events

**Learnings:**
- Pending refreshes must be cancelled both when the watcher is restarted and when the repository is disposed

### 2026-08-19 - Completion

**By:** Kilo Code

**Actions:**
- Added a 400ms coalescing timer shared by create, change, and delete watcher events
- Cancelled pending refreshes when restarting or disposing the watcher
- Logged asynchronous refresh failures instead of allowing unhandled rejections
- Added coverage for event bursts, single events, and disposal cancellation
- Ran `npm test`: 30 passing; TypeScript compilation and Biome checks clean

**Learnings:**
- Keeping debounce ownership in the repository preserves one refresh policy across every watcher event source
