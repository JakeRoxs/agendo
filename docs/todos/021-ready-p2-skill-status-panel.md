---
status: ready
priority: p2
issue_id: "021"
tags: [vscode, extension, skill, ux]
dependencies: []
---

# Set up skill status/install/update info in the dedicated skill panel

## Problem Statement

The Agendo extension shows skill health in a dedicated footer view beneath the Todos panel (`agendo.skillStatus`, driven by `SkillStatusTreeProvider`). The view must reliably report the three states the user cares about — installed **status**, **install** (not yet installed), and **update** available — and each state should expose a clear, single-click action. The implementation exists but its tests only cover the update-available and installed states, so the unknown and install paths are unverified.

**Why it matters:** The skill panel is the user's at-a-glance indicator of whether the bundled companion skill is present, up to date, or needs installing. Gaps in coverage mean those paths could regress silently.

## Findings

- `SkillStatusTreeProvider.getTreeItem` branches into four states: unknown, update-available, installed, not-installed.
- `SkillManager.getStatus()` returns `{ installed, installedVersion, bundledVersion, updateAvailable }`; `updateAvailable` is true only when installed and the bundled version is newer.
- Extension wiring (`extension.ts`) creates the `agendo.skillStatus` tree view and passes `refresh()` back into the skill commands (`EnableSkill`, `UpdateSkill`) so install/update refresh the panel.
- `package.json` registers the `agendo.skillStatus` view named "Skill" and the command palette entries `agendo.enableSkill` / `agendo.updateSkill`.
- Existing tests (todoModel.test.ts) cover only update-available + installed; unknown + install states are untested.

**Example format:**
- Confirm each state renders a distinct label, description, icon, tooltip, and command.
- Confirm clicking the panel actually performs install / update / check and refreshes the view.

## Proposed Solutions

### Option 1: Add verification coverage for all four states

**Approach:** Add focused unit tests for the unknown and not-installed (install) states alongside the existing update/installed tests, asserting label, description, icon, tooltip, and command for all four. Keep the single-row provider as-is.

**Pros:**
- Low risk; verifies the status/install/update behavior the user asked for.
- Fast, deterministic, no UI changes.

**Effort:** 1–2 hours
**Risk:** Low

---

### Option 2: Redesign the panel to separate status from actions

**Approach:** Split the single row into persistent rows — e.g. an "Installed" row (version + check action) and a "Bundled" row (version + install/update action) — so status and install/update are always visible together.

**Pros:**
- Richer info at a glance.
- Distinct, always-present actions.

**Cons:**
- Larger UX change; more design discussion.
- More surface area to test.

**Effort:** 3–4 hours
**Risk:** Medium

---

### Option 3: [Include if you have alternatives]

(Add here if a third option is considered)

## Recommended Action

**Option 1: Add verification coverage for all four states.** Add focused unit tests for the unknown and not-installed (install) states next to the existing update/installed tests, asserting label, description, icon, tooltip, and command for every state. Compile, lint, and run the full test suite. Keep the single-row provider as-is; treat any redesign as a follow-up.

## Technical Details

Affected files, related components, database changes, or architectural considerations.

**Affected files:**
- `src/todos/skillStatusTreeProvider.ts` — the single-row tree provider rendering the four states.
- `src/todos/skillManager.ts` — `getStatus()` / `install()` / `updateFromSource()`.
- `src/extension.ts` — view creation + `refresh()` wiring.
- `package.json` — `contributes.views` (`agendo.skillStatus`) + `contributes.commands`.
- `src/test/todoModel.test.ts` — existing skill status provider tests.

**Related components:**
- `SkillManager` (version/install/update), `Command.EnableSkill`, `Command.UpdateSkill`.

**Database changes (if any):**
- None. The panel reads on-disk skill state; no DB.

## Resources

Links to errors, tests, PRs, documentation, similar issues.

- **Related issue:** #020 (context-menu reorg; skill actions now live in the three-dots menu)
- **CHANGELOG:** `[0.1.4]` — "Skill version, installation, and update status in a dedicated footer view"

## Acceptance Criteria

Testable checklist items for verifying completion.

- [x] Unknown state renders ("Skill status unknown", warning icon, check action).
- [x] Not-installed state renders ("Install Agendo skill", bundled version, install action).
- [x] Installed state renders (version + "Installed", check action).
- [x] Update-available state renders (installed version + "v{bundled} available", update action).
- [x] Each state exposes the correct command (EnableSkill / UpdateSkill).
- [x] Compile + lint + full test suite pass.

## Resume Context

Keep this section short and current. It should describe where work stands now, not repeat the Work Log.

**Current state:** Implemented and verified. Added unit tests for the unknown + install states; all four panel states covered. Compile + lint clean, 36 tests passing.

**Next step:** Optionally follow up with Option 2 (redesign the panel to separate status from actions) if richer at-a-glance info is desired.

## Work Log

Chronological record of work sessions, actions taken, and learnings.

### 2026-08-22 - Initial Discovery

**By:** Kilo

**Actions:**
- Tracked the user's request (set up status/install/update info in the skill panel) as issue #021.
- Audited `SkillStatusTreeProvider`, `SkillManager`, `extension.ts`, `package.json`.

**Learnings:**
- The panel has four states: unknown, update-available, installed, not-installed.
- `updateAvailable` is true only when installed and bundled version is newer.
- Existing tests cover only update-available + installed; unknown + install are untested.

### 2026-08-22 - Triage

**By:** Kilo

**Actions:**
- Reviewed Problem Statement, Findings, and Proposed Solutions.
- Approved: scoped, actionable, low risk; priority p2.
- Selected **Option 1** (verification coverage for all four states) as the Recommended Action.

**Learnings:**
- Panel states: unknown, update-available, installed, not-installed.
- `updateAvailable` requires installed + newer bundled version.
- unknown + install states are implemented but untested.

### 2026-08-22 - Verify All Four Panel States

**By:** Kilo

**Actions:**
- Added `skill status provider renders unknown and install states` test to `src/test/todoModel.test.ts`.
- Asserted label, description, tooltip, and command for the unknown and not-installed (install) states.
- Ran `npm run compile`, `npm run lint`, `npm run test` — 36 passing (up from 35), all clean.

**Learnings:**
- `getChildren` returns `[{}]` when `getStatus()` throws → renders the unknown state.
- Not-installed state falls through to "Install Agendo skill" with the bundled version.
- Both unknown and install use `Command.EnableSkill`; the update state reuses the same command with an "Update" title.

---

(Add more entries as work progresses)

## Notes

Additional context, decisions, or reminders.

- Decision: Start with Option 1 (verification coverage) to lock in status/install/update behavior before any redesign.
- Blocker: None.
