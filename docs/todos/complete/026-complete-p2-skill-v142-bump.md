---
status: complete
priority: p2
issue_id: "026"
tags: [skill, agent, documentation]
dependencies: []
---

# Skill v1.4.2 — Bump Version and Update Docs

## Problem Statement

The skill version is currently 1.4.1, but the extension defaults for `gitignoreTodos` have changed to `true`. The skill's config table still shows `false` as the default. This inconsistency can confuse agents and users who rely on the skill documentation.

**Why it matters:** Agents use the skill as ground truth for Agendo conventions. Stale defaults lead to incorrect behavior (e.g., agents might not respect the new gitignore behavior).

## Proposed Solutions

### Option 1: Bump to 1.4.2 and update config table

**Approach:** Update `SKILL.md` frontmatter version to `1.4.2`, fix the `gitignored` default in the config table, and update any references.

**Pros:**
- Fixes the inconsistency
- Clear version bump for downstream consumers
- Low effort

**Cons:**
- Minor change

**Effort:** 30 minutes
**Risk:** Very Low

---

### Option 2: Add changelog to skill

**Approach:** Add a changelog section to `SKILL.md` documenting version changes.

**Pros:**
- Helps agents track skill evolution
- Useful for debugging

**Cons:**
- Adds maintenance overhead
- May be overkill for a single-field fix

**Effort:** 1 hour
**Risk:** Low

---

## Recommended Action

**Option 1:** Bump to 1.4.2, fix the config table, verify the skill still works end-to-end.

## Technical Details

**Affected files:**
- `resources/skill/SKILL.md` — version bump, config table fix
- `resources/skill/reconcile.md` — potentially update if any logic changed
- `package.json` — verify bundled version matches

**Related components:**
- `SkillManager` — version tracking
- Extension tests — verify skill integration

## Acceptance Criteria

- [ ] SKILL.md frontmatter version is `1.4.2`
- [ ] Config table shows `gitignored: true` as default
- [ ] Skill loads and functions correctly in an agent host
- [ ] Extension bundled version matches
- [ ] Tests pass

## Resume Context

**Current state:** Awaiting implementation.

**Next step:** Update SKILL.md version and config table.
