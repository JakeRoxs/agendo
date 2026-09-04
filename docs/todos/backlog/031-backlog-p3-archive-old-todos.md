---
status: backlog
priority: p3
issue_id: "031"
tags: [vscode, extension, automation, cleanup]
dependencies: []
---

# Archive Old Todos

## Problem Statement

As projects grow, the todo root folder accumulates completed and cancelled todos. While these are moved to subfolders, they still clutter the view and slow down searches. An archive feature would automatically move old todos to a separate location.

**Why it matters:** Keeping the active todo set lean improves focus and performance. Users shouldn't have to manually clean up old work.

## Proposed Solutions

### Option 1: Age-based auto-archive

**Approach:** Add a setting `agendo.archiveAfterDays` (default: 90) that auto-moves completed/cancelled todos older than X days to an `archive/` folder.

**Pros:**
- Automatic, requires no user action
- Keeps active view clean
- Configurable threshold

**Cons:**
- Irreversible without manual intervention
- May archive todos users want to keep visible
- Requires periodic background task

**Effort:** 3–5 hours
**Risk:** Medium

---

### Option 2: Manual archive command

**Approach:** Add a command "Archive Old Todos" that shows a picker of completed/cancelled todos and lets the user select which to archive.

**Pros:**
- User has full control
- No surprise deletions/moves
- Can archive specific subsets

**Cons:**
- Manual effort required
- User may forget to run it

**Effort:** 2–3 hours
**Risk:** Low

---

### Option 3: Hybrid approach

**Approach:** Combine both: auto-archive with a grace period, plus manual archive for fine-grained control.

**Pros:**
- Best of both worlds
- Flexible for different workflows

**Cons:**
- More complex implementation
- More settings to manage

**Effort:** 4–6 hours
**Risk:** Medium

---

## Recommended Action

**Option 2:** Start with manual archive command. It's safer, gives users control, and validates the UX before adding automation.

## Technical Details

**Affected files:**
- `src/commandRegistration.ts` — archive command handler
- `src/todos/statusService.ts` — move to archive folder
- `src/todos/configService.ts` — archive folder setting
- `package.json` — command and setting registration

**Related components:**
- `StatusService` — folder management
- `Repository` — refresh after archive

## Acceptance Criteria

- [ ] Archive command shows picker of eligible todos
- [ ] User can select multiple todos to archive
- [ ] Archived todos move to `{root}/archive/`
- [ ] Archive folder is created if needed
- [ ] Repository refreshes after archive
- [ ] Compile + lint + tests pass

## Resume Context

**Current state:** Awaiting implementation.

**Next step:** Implement archive command in `commandRegistration.ts`.
