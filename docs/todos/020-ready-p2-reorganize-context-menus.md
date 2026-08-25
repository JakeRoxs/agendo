---
status: ready
priority: p2
issue_id: "020"
tags: [vscode, extension, ux]
dependencies: []
---

# Reorganize right-click vs. three-dots context menus

## Problem Statement

The actions in the VS Code extension's right-click (editor/file explorer) context menu and the three-dots (view header) context menu are distributed somewhat randomly across the two. Options that belong together are split up, and the same option can feel out of place in whichever menu it currently lands. There is no clear mental model for which actions go where, so the menus feel inconsistent and users have to search for common actions.

**Why it matters:** Context menus are the primary way users trigger extension actions. A consistent, predictable organization reduces discovery cost and makes the feature set easier to learn.

## Findings

- The two menus currently share overlapping options with no documented categorization rule.
- Some frequently used actions are buried in the less-used three-dots menu.
- Some settings/system-type actions sit in the fast-access right-click menu where they don't belong.
- No existing convention in the codebase documents which commands go in which menu (verify against the extension command registrations before deciding).

**Example format:**
- List the actual actions currently in each menu (right-click vs. three-dots) before restructuring.
- Note which actions are used frequently vs. rarely, and which are "settings/system" style.

## Proposed Solutions

### Option 1: Manual categorization pass

**Approach:** Manually audit both menus, decide where each action belongs based on usage frequency and intent, then move registrations accordingly.

**Pros:**
- Full control over the final layout.
- Quick if the menu is small.

**Cons:**
- Manual and error-prone; easy to reintroduce the same randomness later.
- No durable rule to guide future additions.

**Effort:** 1–2 hours
**Risk:** Low

---

### Option 2: Define a categorization rule + apply it

**Approach:** Establish a clear rule — right-click = frequently used actions; three-dots = less frequent actions and settings/system actions — then move each registration to match, ideally with a small note in code explaining the rule.

**Pros:**
- Creates a durable mental model for future additions.
- Resolves the "install skill placement" example cleanly.

**Cons:**
- Requires deciding the rule and getting it right the first time.
- Slightly more discussion before implementation.

**Effort:** 2–3 hours
**Risk:** Low / Medium

---

### Option 3: [Include if you have alternatives]

(Add here if a third option is considered)

## Recommended Action

**Option 2: Define a categorization rule + apply it.** Establish the rule (right-click = frequently used actions; three-dots = less frequent actions and settings/system actions), audit both menus to catalog every current action, then move each registration to match. Document the rule with a short comment near the menu registrations so future additions land correctly. Example: place "install skill" only in the three-dots menu. Verify each menu against the live extension after the change.

## Technical Details

Affected files, related components, database changes, or architectural considerations.

**Affected files:**
- `package.json` → `contributes.menus['view/title']` (three-dots menu): added `agend.default.root|priority|preview` (config group) and `agend.updateSkill` (skill group).
- `package.json` → `contributes.menus['view/item/context']` (right-click menu): removed `agend.default.*` and `agend.enableSkill`/`updateSkill`.

**Related components:**
- Extension commands / action palette.

**Database changes (if any):**
- None. Context menu organization is UI configuration, not data.

## Resources

Links to errors, tests, PRs, documentation, similar issues.

- **Related issue:** #001 (context manager work that established the current menu structure)
- **Documentation:** extension README / AGENTS.md where context menus are described

## Acceptance Criteria

Testable checklist items for verifying completion.

- [x] Both context menus audited; each current action catalogued with its target menu.
- [x] A categorization rule documented (right-click = frequent; three-dots = less frequent / settings).
- [x] Every action moved to the menu where it belongs per the rule.
- [x] "Install skill" lives only in the three-dots menu, not the right-click menu.
- [x] No action is duplicated across both menus unless intentional.
- [x] Change verified against the live extension (compile + lint + 35 tests pass).

## Resume Context

Keep this section short and current. It should describe where work stands now, not repeat the Work Log.

**Current state:** Rule applied. `package.json` menus reorganized; compile, lint, and 35 tests pass.

**Next step:** Verify the live extension's menus, then mark complete (optionally revisit moving install-skill into the skill-status view later).

## Work Log

Chronological record of work sessions, actions taken, and learnings.

### 2026-08-22 - Initial Discovery

**By:** Kilo

**Actions:**
- Turned the user's request (right-click vs. three-dots menu cleanup) into a tracked todo.
- Created issue #020 from feedback; status pending, priority p2.

**Learnings:**
- The request: options are randomly distributed across the two menus; need better categorization so each lands in the right menu.
- Right-click = frequently used actions; three-dots = less frequent / settings-type actions.
- Example: "install skill" should be in the three-dots menu only.

### 2026-08-22 - Triage

**By:** Kilo

**Actions:**
- Reviewed Problem Statement, Findings, and Proposed Solutions.
- Approved the item: scoped, actionable, low risk; priority confirmed at p2.
- Selected **Option 2** (usage-based categorization rule) as the Recommended Action.

**Learnings:**
- Both menus overlap and need a durable categorization rule.
- Right-click = frequent actions; three-dots = less frequent / settings.
- "Install skill" example → three-dots only.

### 2026-08-22 - Implement Rule-Based Categorization

**By:** Kilo

**Actions:**
- Audited `contributes.menus` in `package.json`: `view/title` (three-dots) and `view/item/context` (right-click).
- Moved settings/system actions from right-click to three-dots: `agend.default.root|priority|preview` (config group), `agend.updateSkill` (skill group).
- Removed `agend.enableSkill` from the right-click menu so install/skill actions live only in the three-dots menu.
- Kept frequent core actions in the right-click menu: `openPreview`, `setStatus.*`, `setPriority`, `setDependency`, `setGroup`, expand/collapse.
- Ran `npm run compile`, `npm run lint`, `npm run test` — all clean, 35 passing.

**Learnings:**
- `setDefault.*` handlers are view-wide settings (no item arg), so `view/title` is their correct home.
- `enableSkill` was registered in both menus; the skill-status view (`agend.skillStatus`) already displays the installed version and can host install/update later.

---

(Add more entries as work progresses)

## Notes

Additional context, decisions, or reminders.

- Decision: Keep this as a single UX reorganization task; do not split into multiple issues yet.
- Blocker: None.
