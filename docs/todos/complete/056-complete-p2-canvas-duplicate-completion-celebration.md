---
status: complete
priority: p2
issue_id: "056"
tags: [canvas, ux, celebration, confetti]
dependencies: []
---

# Deduplicate Canvas Completion Celebrations

When all acceptance criteria are checked, the todo status typically transitions to `complete` in
the same session. This triggers two separate celebrations: "All criteria met! ✅" (percent 0→100)
and then "Todo complete! 🎉" (status → complete), because the canvas reloads between the two
transitions and compares against the intermediate state stored in `sessionStorage`.

## Findings

`resources/canvas/agendo-work-session/assets/page.js:303-306` — the celebration logic checks both
conditions on every page load:

```js
if (status === 'complete' && last.status !== 'complete') celebrate('Todo complete! 🎉');
else if (Number(percent) === 100 && last.percent < 100) celebrate('All criteria met! ✅');
```

The `else if` was intended to prevent both, but it only works within a single load. Because the
canvas reloads when the todo file changes, the criteria-check happens on load N (celebrates),
then the status transition happens on load N+1 (celebrates again).

## Proposed Solutions

### Option 1: Prefer status transition, suppress criteria-only celebration when status also changed

**Approach:** If the status transitioned to `complete`, only show "Todo complete! 🎉" regardless of
whether percent also reached 100. The criteria celebration should only fire when percent reaches
100 but the status did *not* change to complete (edge case: user manually unchecked all criteria
then rechecked them without completing the todo).

**Pros:** Simple logic change, preserves the intent of both celebrations.

**Cons:** Still relies on sessionStorage across reloads; edge case where status changed to complete
but percent never hit 100 (e.g. todo with no criteria) would still show "Todo complete!".

**Effort:** Low — single condition change.

**Risk:** Minimal.

### Option 2: Add transition-type-aware celebration effects

**Approach:** Beyond deduplication, vary the visual effect by transition type (status change vs
criteria change). Different confetti colors, particle shapes, or banner styles.

**Pros:** Addresses user's secondary interest in differentiated transition effects.

**Cons:** More scope; the immediate ask is deduplication.

**Effort:** Medium.

**Risk:** Low, but increases test surface.

## Recommended Action

Implement Option 1 first (deduplication). Consider Option 2 as a follow-up if the user wants
distinct transition effects per status.

## Technical Details

- `resources/canvas/agendo-work-session/assets/page.js:299-307` — celebration logic
- `resources/canvas/agendo-work-session/assets/page.js:259-297` — `celebrate()` implementation
- `resources/canvas/agendo-work-session/assets/page.css:53-54` — celebration styles

## Acceptance Criteria

- [ ] Checking the final acceptance criterion that auto-sets status to `complete` shows exactly one celebration ("Todo complete! 🎉")
- [ ] Manually setting status to `complete` without changing criteria shows "Todo complete! 🎉"
- [ ] Checking criteria such that percent reaches 100 but status is not `complete` shows "All criteria met! ✅"
- [ ] Reopening an already-complete todo shows no celebration
- [ ] Reopening a todo with 100% criteria met but not complete shows no celebration

## Resume Context

**Current state:** Not started.

**Next step:** Triage and decide between Option 1 and Option 2 scope.

## Work Log

### 2026-10-26 - Todo Created

**By:** Agent

**Actions:**

- Created todo from user feedback about duplicate celebration on completion

**Learnings:**

- None yet