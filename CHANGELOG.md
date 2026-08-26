# Change Log

All notable changes to the Agendo extension are documented here.

## [0.1.5]

### Changed

- Moved skill install/enable and source-update actions into the Skill panel's
  overflow menu.
- Added an editor-window task board with status columns, drag-and-drop movement,
  filters, card metadata, and persisted column visibility and ordering.

## [0.1.4] - 2026-08-21

### Added

- Skill version, installation, and update status in a dedicated footer view
  beneath the Agendo Todos panel.

### Fixed

- Extension tests no longer display expected failure-path notifications as
  visible alerts in the VS Code test window.

## [0.1.3] - 2026-08-19

### Added

- Dependency editing, blocked-state indicators, reverse dependency filtering,
  and repository-level dependency indexes.
- Lightweight task groups with tree grouping and group filtering.
- Deterministic task digest for next actions, high-priority work, blockers, and
  recently updated todos.
- Individual-first Resume Context guidance in the bundled Agendo skill.
- Search-aware empty states and dedicated clear-search action.

### Fixed

- Status transitions now rename files before editing so VS Code and AI tooling
  follow the authoritative path without recreating stale copies.
- Markdown preview opening now registers the source document before switching
  to preview.
- File watcher bursts are debounced and watcher startup occurs during extension
  activation.
- Group filtering no longer corrupts status filters.
- Blocked todos retain their context-menu actions, missing blockers trigger the
  ready-state warning, and dependency editing preserves existing terminal or
  missing dependencies.
- Extension tests launch Electron correctly from extension-host environments.

### Changed

- Extracted command registration from `extension.ts` into a dedicated command
  orchestration module.
- Added shared UTF-8 filesystem reads and repository-cached group lists.
- Expanded extension regression coverage to 32 tests.
- Updated the bundled Agendo skill to version 1.2.0.

## [0.1.2] - 2026-08-13

### Fixed

- Persisted tree collapse/expand state now survives reloads by writing the
  VS Code TreeView node IDs back to workspace state and restoring them reliably
  after activation.
- Resolved the reload bug where collapsed groups were not restored because the
  UI node objects did not match the internal model shape used for persistence.

### Changed

- Simplified the CI test flow by removing duplicate test execution and keeping a
  single headless VS Code run with the right Xvfb setup.
- Added npm caching to the CI workflow to speed dependency installs in repeated
  runs.
- Expanded regression coverage around configuration, repository refresh, filter
  logic, link validation, skill installation, and extension activation.

## [0.1.1] - 2026-08-13

### Added

- Tree expansion state persistence (collapsed status/priority groups remembered)
- SonarQube analysis job in CI workflow
- `.gitattributes` and `.editorconfig` to prevent line ending issues

### Changed

- Renamed `.todos-config.json` → `.agendo-config.json` for better branding

## [0.1.0] - 2026-08-12

### Added

- Initial v1 scaffold built from the VS Code extension template.
- Activity Bar TreeView grouping todos by status → priority.
- Filter (status/priority) and free-text search with persisted state.
- Open-in-preview default behavior.
- Status transition engine (frontmatter + filename token + folder move) with
  contextual `CANCELLED` banner handling.
- Set-priority command with file rename.
- Create-todo command with next-id allocation and a built-in template.
- `.agendo-config.json` projection and `*` `.gitignore` toggle for the
  Agendo skill config bridge.
- Bundled `agendo` skill (`resources/skill/`) with install/enable and
  update-from-source commands (`agendo.enableSkill`, `agendo.updateSkill`)
  and a `agendo.skillUpdateSource` setting.
- Broken-link flagging: moving/renaming a todo warns when other todos still
  reference its old filename (no auto-rewrite).
- Optional generic `key` frontmatter for Jira, GitHub, and other external
  trackers, with create-flow, tree display, and search integration. Legacy
  `jira` frontmatter remains supported.
