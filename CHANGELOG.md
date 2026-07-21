# Change Log

All notable changes to the File Todos Manager extension are documented here.

## [0.0.1] - Unreleased

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
  file-todos skill config bridge.
