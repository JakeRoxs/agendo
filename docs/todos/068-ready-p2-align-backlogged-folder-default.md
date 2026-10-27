---
status: ready
priority: p2
issue_id: "068"
tags: [config, naming, backlogged, canvas, skill]
dependencies: []
---

# Align the Backlogged Folder Default with the Lifecycle Name

## Problem Statement

The completed-folder alignment and todo 061 renamed lifecycle/config keys, but the default value of `backloggedFolder` remains `backlog`. This differs from the canonical `backlogged` status and from `completed`/`cancelled` defaults. This workspace already configures `backlogged` while its four parked todos still reside in `backlog/`, creating a discovery mismatch.

## Recommended Action

- Use `backlogged` as the default folder in the extension, canvas, Settings, skill, and configuration documentation
- Align the canonical board/Settings status label with the tree's Backlogged label
- Keep explicitly configured custom names, including `backlog`, supported; do not add silent directory migration or old-key aliases
- Move this workspace's four parked files into its already-configured `backlogged/` directory without changing IDs, filenames, frontmatter, or work history
- Document that existing installations can retain `backlog/` with an explicit folder setting or rename their folder

## Acceptance Criteria

- [x] New/default workspaces discover and write backlogged todos under `backlogged/`
- [x] Default config projection omits `backloggedFolder` when it equals `backlogged`
- [x] Explicit custom folder `backlog` continues to work in extension and standalone canvas
- [x] Board/Settings labels and bundled skill documentation reflect canonical naming
- [x] Workspace todos 028, 029, 030, and 032 live under the configured `backlogged/` folder, unchanged in content
- [x] Regression suites, compile, lint, and bundles pass
- [ ] Rebuilt extension and installed skill/canvas use the updated default in the live host

## Resume Context

**Current state:** Defaults and labels are aligned across native code, schema, standalone canvas, Settings, README, and bundled skill. The four workspace files are moved byte-for-byte into `backlogged/`, and the actual workspace loader discovers them. Custom `backlog` remains supported. Native/canvas suites and bundles pass; installed-host smoke verification remains outstanding.

**Next step:** Rebuild/reload the extension and update installed bundled components when convenient (skill 1.6.2, canvas 0.1.10). Confirm the live board/tree show Backlogged and newly backlogged work uses the new default, then mark completed.

## Work Log

### 2026-10-27 - Align defaults and migrate this workspace

**By:** Kilo

**Actions:**

- Changed `DEFAULT_TODOS_CONFIG`, package schema, standalone loader fallback, and Settings fallback to `backlogged`
- Aligned board and Settings canonical labels to Backlogged; updated README and bundled skill defaults/layout examples
- Documented that other workspaces retain `backlog/` through an explicit folder setting or can rename it after checking for conflicts; no silent migration or legacy-key alias added
- Moved 028, 029, 030, and 032 from `docs/todos/backlog/` to `docs/todos/backlogged/`; verified each file's Git object hash matches its original content and removed only the empty old directory
- Preserved existing workspace configuration and todo IDs/status/priority/history; assets were not moved
- Bumped bundled component metadata to skill 1.6.2 and canvas 0.1.10 so installed copies can detect an available update; no installed copy was overwritten
- Added/strengthened native default/projection/custom-name tests and standalone regular/CodeQL/SonarQube status round-trip tests for default, explicit `backlog`, and custom `parked` folders
- `npm test`: 399 extension tests passed, compile and lint passed
- Full canvas tests: 287 passed, zero failed; `npm run bundle` succeeded; `git diff --check` passed
- Exercised `loadTodo` against this actual workspace: all four moved IDs resolve with status `backlogged`

**Learnings:**

- Todo 061 handled the configuration-key rename, not the remaining default-value mismatch
- This workspace already selected `backlogged` in VS Code settings and `.agendo-config.json`; the folder move repairs discovery without changing user preferences
- Default changes need matching bundled skill/canvas version updates because those installed components can otherwise retain the previous fallback

### 2026-10-27 - Start backlogged default alignment

**By:** Kilo

**Actions:**

- Read completed todos 057/061 and current native/schema/canvas/skill defaults
- Confirmed workspace settings and agent projection explicitly select `backlogged`, while files remain in `docs/todos/backlog/`
- Confirmed no existing dedicated open todo covers the default-value change; allocated 068 after listing active and terminal numeric todos
