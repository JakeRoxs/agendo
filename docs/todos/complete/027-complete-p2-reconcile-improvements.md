---
status: complete
priority: p2
issue_id: "027"
tags: [skill, agent, audit, reconcile]
dependencies: []
---

# Reconcile Improvements

## Problem Statement

The reconciliation workflow (in `reconcile.md`) provides deterministic integrity checks and semantic review. However, the deterministic checks could be more comprehensive, and the semantic pass could produce more actionable recommendations.

**Why it matters:** Better reconciliation means stale or inconsistent todos are caught earlier, reducing technical debt and improving workflow hygiene.

## Proposed Solutions

### Option 1: Add more deterministic checks

**Approach:** Extend the integrity checks in `reconcile.md` to catch additional issues:
- Todos with no Resume Context (should have one if non-trivial)
- Todos with dependencies but no blocked indicator
- Orphaned `superseded_by` references
- Todos missing required sections
- Inconsistent tag formatting

**Pros:**
- Catches more issues automatically
- No model required
- Straightforward to implement

**Cons:**
- May increase false positives
- Requires maintaining the check list

**Effort:** 2–4 hours
**Risk:** Low

---

### Option 2: Improve semantic pass recommendations

**Approach:** Enhance the semantic review section to:
- Produce structured recommendation formats (JSON-like)
- Include confidence scores
- Suggest specific wording changes
- Link evidence to recommendations more explicitly

**Pros:**
- More actionable output
- Easier for agents to parse
- Better UX for human reviewers

**Cons:**
- More complex prompt engineering
- May require model capability assumptions

**Effort:** 3–5 hours
**Risk:** Medium

---

### Option 3: Add reconciliation history

**Approach:** Track reconciliation runs and their recommendations, allowing users to see what changed over time.

**Pros:**
- Audit trail for todo evolution
- Helps track when todos were last verified
- Can surface trends (e.g., "this todo was recommended for update 3 times")

**Cons:**
- New data model
- Storage considerations
- May be overkill

**Effort:** 4–6 hours
**Risk:** Medium

---

## Recommended Action

**Option 1 + Option 2:** Start with more deterministic checks (high value, low risk) and improve the semantic pass output format (moderate effort, good value).

## Technical Details

**Affected files:**
- `resources/skill/reconcile.md` — add checks, improve recommendations
- `resources/skill/SKILL.md` — potentially update if workflow changed
- `src/todos/linkService.ts` — if new deterministic checks need code
- `src/todos/todoModel.ts` — utility functions for checks

**Related components:**
- `StatusService` — for applying recommendations
- `Repository` — for reading todo state

## Acceptance Criteria

- [ ] New deterministic checks run without model
- [ ] Semantic recommendations are structured and actionable
- [ ] Recommendations include evidence citations
- [ ] Workflow remains prompt-driven and advisory
- [ ] Skill v1.4.2 bump included (see #026)
- [ ] Tests pass

## Resume Context

**Current state:** Awaiting implementation.

**Next step:** Extend reconcile.md with additional checks.
