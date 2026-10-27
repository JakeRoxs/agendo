---
status: in-progress
priority: p2
issue_id: "061"
tags: [config, ui, folder-structure]
dependencies: []
---

# Investigate Custom Folder Structure Support Across Extension/Skill/Canvas

## Problem Statement

The agendo config supports custom folder names for terminal/parked states (`completeFolder`, `backlogFolder`, `cancelledFolder`), but the extension, skill, and canvas may not consistently respect these custom values. When a user configures non-default folder names, the UI should:

1. Display the correct status labels matching the configured folder names
2. Properly discover and display todos in the configured folders
3. Use the configured folder names when moving todos between states
4. Be consistent across the extension, skill, and canvas

Additionally, the config key names themselves may need updating for consistency (e.g., `completeFolder` → `completedFolder` to match the status name).

## Acceptance Criteria

- [ ] Extension respects all configured custom folder names (`completeFolder`, `backlogFolder`, `cancelledFolder`)
- [ ] Skill documentation and behavior respect configured custom folder names
- [ ] Canvas respects configured custom folder names
- [ ] UI status labels reflect the configured folder names
- [ ] Todos in custom-named folders are discovered and displayed correctly
- [ ] Moving todos between states uses the configured folder names
- [x] Config key names are consistent with status names (investigate `completeFolder` → `completedFolder`)
- [ ] Tests cover custom folder configuration for all three states

## Resume Context

**Current state:** Config keys renamed from `completeFolder`/`backlogFolder` to `completedFolder`/`backloggedFolder` across extension source, tests, canvas, skill docs, package.json, and README. All 323 extension tests and 56 canvas tests pass.

**Next step:** Verify the extension works end-to-end with the renamed config keys. Consider adding backward compatibility for old key names.

## Work Log

### 2026-10-26 - Initial Investigation

**By:** Copilot

**Actions:**

- Updated `.agendo-config.json` to set `completeFolder: "completed"`
- Renamed `docs/todos/complete/` to `docs/todos/completed/`
- Renamed all 52 completed todo files from `-complete-` to `-completed-`
- Updated frontmatter `status: complete` to `status: completed` in all completed todos

**Learnings:**

- The skill was updated to use "completed" as the default, but the config was overriding it with "complete"
- The UI should dynamically use the configured folder name rather than hardcoding "completed"
- This issue likely affects all three configurable folder types, not just the complete folder

### 2026-10-26 - Rename config keys for consistency

**By:** Copilot

**Actions:**

- Renamed `completeFolder` → `completedFolder` and `backlogFolder` → `backloggedFolder` in:
  - `src/configuration.ts` (Settings enum)
  - `src/todos/configService.ts` (defaults, interface, getters, projection)
  - `src/extension.ts` (config projection)
  - `src/todos/statusService.ts` (folder resolution)
  - `resources/canvas/agendo-work-session/todos.mjs` (config reading)
  - `package.json` (settings schema)
  - `resources/skill/SKILL.md` (documentation)
  - All test files
- Updated `.agendo-config.json` to use new key names
- All 323 extension tests pass

**Learnings:**

- The extension and canvas already read config for folder names — the issue was key naming inconsistency
- Config keys now match status names: `completedFolder`, `backloggedFolder`, `cancelledFolder`
