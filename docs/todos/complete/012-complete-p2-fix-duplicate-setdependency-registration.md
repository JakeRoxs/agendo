---
status: complete
priority: p2
issue_id: "012"
tags: [bug, code-quality, extension]
dependencies: []
---

# Fix Duplicate `SetDependency` Command Registration

## Problem Statement

`src/extension.ts` registers the `Command.SetDependency` handler twice (lines 245-278 and 280-313). The second registration silently overwrites the first. This is a copy-paste error that wastes ~70 lines of dead code and will confuse future maintainers who see two identical handlers.

## Findings

- `extension.ts:245-278` — first `register(Command.SetDependency, ...)` block
- `extension.ts:280-313` — second identical block, overwrites the first
- Both blocks have identical logic: show quick pick → parse labels → call `status.setDependencies` → refresh → warn on broken refs
- No functional bug for end users (second wins), but the codebase carries dead weight

## Proposed Solutions

### Option 1: Remove the first registration (recommended)

Delete lines 245-278, keep lines 280-313 as the single handler.

**Pros:**
- Minimal change, lowest risk
- Preserves the current (second) implementation exactly

**Cons:**
- Requires confirming the second block is intentionally kept (no subtle difference)

**Effort:** 15 min

**Risk:** Low

### Option 2: Extract shared logic into a helper

Pull the duplicate body into `registerSetDependency(services, todo)` and call it from both registrations during a transition period, then remove one.

**Pros:**
- Leaves a trace of the migration

**Cons:**
- Unnecessary intermediate step for a clear duplicate

**Effort:** 30 min

**Risk:** Low

## Recommended Action

Remove the first registration block (lines 245-278). Verify the second block (280-313) is identical in behavior by diffing them. Run the full test suite after.

## Technical Details

**Affected files:**
- `src/extension.ts:245-278` — remove
- `src/test/todoModel.test.ts` — test at line 821 calls `Command.SetDependency`; ensure it still hits the remaining handler

**Related components:**
- `StatusService.setDependencies` — the underlying method is unaffected

## Acceptance Criteria

- [x] Only one `register(Command.SetDependency, ...)` call remains in `extension.ts`
- [x] `npm test` passes
- [x] `biome check` passes with no errors

## Work Log

### 2026-08-19 - Completion

**By:** Kilo Code

**Actions:**
- Replaced the duplicate `SetDependency` registration with the intended `SetGroup` handler
- Added runtime registration coverage for both commands
- Ran `npm test`: 29 passing

**Learnings:**
- The duplicate was masking a missing group command rather than being dead code alone
