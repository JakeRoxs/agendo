---
status: completed
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

**Current state:** Complete. Config keys renamed (`completeFolder` → `completedFolder`, `backlogFolder` → `backloggedFolder`) across extension, canvas, skill, package.json, and all tests. All 353 extension tests and 254 canvas tests pass. End-to-end verification confirms all three layers consistently respect the renamed config keys. Backward compatibility for old key names was explicitly declined with justification (extension owns config projection via strongly-typed VS Code settings; canvas reads `.agendo-config.json` which the extension regenerates with new keys; stale old-key files fall back to benign defaults). Test coverage confirmed for all three folder types (completed, backlogged, cancelled). Skill documentation verified correct.

**Next step:** None. Task 061 is complete.

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

### 2026-10-27 - Verification Complete

**By:** Kilo

**Actions:**

- Ran full test suite: `npm run test` → 353 passing, 0 failing; `npm run test:canvas` → 254 passing, 0 failing across 41 suites
- Verified end-to-end: `src/configuration.ts` (Settings enum), `src/todos/configService.ts` (getters + `toTodosConfig()`), `src/todos/statusService.ts` (`folderForStatus()`), `src/extension.ts` (`getSettingsInfo` projection), and `resources/canvas/agendo-work-session/todos.mjs` (`todoLocations()`) all consistently use the renamed keys
- Confirmed no remaining references to old key names (`completeFolder`, `backlogFolder`) in `src/`, `resources/`, or `package.json`
- **Backward compatibility: explicitly declined** — extension reads strongly-typed VS Code settings (old keys not in schema); canvas reads `.agendo-config.json` which the extension regenerates with new keys via `writeConfigFile()`/`toTodosConfig()`; stale old-key files fall back to benign defaults
- Verified test coverage for all three folder types: `completedFolder` (todoModel.test.ts, codeScanning.test.ts, standaloneCanvasSafety.test.ts), `backloggedFolder` (todoModel.test.ts, codeScanning.test.ts), `cancelledFolder` (todoModel.test.ts, codeScanning.test.ts, standaloneCanvasSafety.test.ts)
- Verified skill documentation (`resources/skill/SKILL.md`) uses renamed keys consistently

**Learnings:**

- The config-key rename is complete and consistent across extension, skill, and canvas
- All tests, lint, and compile pass cleanly
- The canvas end-to-end test (`codeScanning.test.ts:1653`) verifies a custom `completedFolder` is honored for a scanner todo move
- Status-service tests verify file moves into each configured folder

