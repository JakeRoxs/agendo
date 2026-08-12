# Change Log

All notable changes to the Agendo extension are documented here.

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
- `.todos-config.json` projection and `*` `.gitignore` toggle for the
  Agendo skill config bridge.
- Bundled `agendo` skill (`resources/skill/`) with install/enable and
  update-from-source commands (`agendo.enableSkill`, `agendo.updateSkill`)
  and a `agendo.skillUpdateSource` setting.
- Broken-link flagging: moving/renaming a todo warns when other todos still
  reference its old filename (no auto-rewrite).
- Optional generic `key` frontmatter for Jira, GitHub, and other external
  trackers, with create-flow, tree display, and search integration. Legacy
  `jira` frontmatter remains supported.
