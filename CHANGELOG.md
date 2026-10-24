# Change Log

All notable changes to the Agendo extension are documented here.

## [Unreleased]

### Added

- Optional native CodeQL and SonarQube imports through **Import Code-Scanning Todos...**, disabled by default and fetched only on request
- Source-specific `code-scanning/codeql` and `code-scanning/sonarqube` todo roots with independent `cql-001` / `sq-001` numbering and nested lifecycle folders
- Scanner todos participate in native discovery, groups, filters, dependencies, board, digest, link checks, and canvas; re-imports refresh only scanner evidence and preserve user-managed lifecycle and notes
- SonarQube credentials stored in VS Code SecretStorage; CodeQL uses the authenticated GitHub CLI

### Changed

- Work-session canvas version 0.1.2 recognizes scanner IDs and source-specific lifecycle folders, with explicit Todo, CodeQL, and SonarQube badges in the header, dependencies, and recent history
- Canvas edit action uses a consistent icon and labelled toolbar button instead of an overlapping, font-dependent pencil
- Bundled Agendo skill version 1.5.0 documents scanning discovery, independent IDs, source-specific lifecycle, and evidence ownership

## [0.1.16]

### Added

- **Open in Work Session Canvas** right-click action on todos in the tree and on board cards, available in any view mode
- Separate work-session canvas row in the Skill panel plus an **Install/Update Work Session Canvas** command, so the canvas installs and updates independently of the skill
- New `canvas` value for `agendo.viewMode`: opening a todo shows the work-session dashboard in a VS Code tab, served by the bundled canvas server (falls back to the text editor on failure)
- Work-session canvas shows the todo description (intro text and Problem Statement) under Acceptance Criteria, and every section is collapsible, with collapse state remembered per todo rather than across todos
- Work-session canvas adapts to status (for example `pending` leads with the description and triage sections and collapses Acceptance Criteria), has a status badge that doubles as the picker and renames and moves the todo file like the extension does, and a small pencil edit button (top right) in the VS Code tab that opens the todo markdown beside it. It honors `agendo.root` and the custom state folder names in `.agendo-config.json`. The history bar skips the current todo in its pills and colors the dropdown by status
- Bundled `agendo-work-session` Copilot canvas (v0.1.0, versioned independently of the extension and
  the skill through `.canvas-meta.json`) — an interactive dashboard for the active todo showing
  its title, status, priority, acceptance criteria (clickable), resume context, and work log, with
  a confetti celebration when a todo completes. Installing the skill now also installs the canvas
  at user level in `~/.copilot/extensions/agendo-work-session/` (honoring `COPILOT_HOME`), so it works in
  every workspace; an installed canvas is refreshed on activation only when the bundled version is
  newer, and a project-level `.github/extensions/` copy is migrated away
- Canvas navigation history (back, forward, a recent-todos dropdown, and status-accented recent chips with distinct status colors) so a single shared `agendo-work-session` panel can follow the active todo
- Canvas dependency panel (collapsible, opening automatically only when something is open, and hiding "Blocks" on finished todos) showing what blocks a todo and what it blocks, with live status, satisfied/unresolved/cancelled/circular markers, click-through navigation, and `get_dependencies` / `get_dependents` actions

### Changed

- Bumped bundled Agendo skill to version 1.4.8 — agents now open the shared `agendo-work-session` canvas (always with the fixed `instanceId` `agendo-work-session`)
  for the active todo when starting or resuming work, when the host provides it; the step is
  optional and skipped silently if the canvas is unavailable

### Fixed

- The skill status row now installs the bundled skill when the extension carries a newer version (it used to run "Update from Source", which fetches from GitHub and could not deliver the bundled version) and reads "Bundled vX available"
- The skill-update prompt no longer blocks extension activation; previously the tree views kept loading until the notification was dismissed

## [0.1.15]

### Added

- Automatic skill update check on extension activation — when enabled, Agendo checks for a newer
  skill version at startup and shows a notification with an "Update Skill" button if one is
  available
- `agendo.skillUpdateCheck` setting (default `true`) — toggle automatic skill update checks in
  user settings
- "Toggle Agendo Skill Update Check" command in the skill status view menu and command palette
- `agendo.sortByDate` setting (default `false`) — sort todos by last modified date (most recent
  first) instead of issue ID
- "Toggle Sort by Date Modified" command in the todos view menu and command palette

### Changed

- Skill status icon now uses `sync` icon when an update is available (previously `cloud-download`)
- Todos view now shows "Loading todos…" during initial repository scan instead of briefly
  displaying "No todos found" while todos are being loaded

## [0.1.14]

### Added

- Skill install/update notifications now display the version upgraded from and to
- Skill status panel displays whether the installed skill is from the extension or updated from source
- Clicking an installed skill in the status panel now prefers updating from source

### Changed

- Bumped bundled Agendo skill to version 1.4.6 — reduced prompt size by consolidating redundant
  instructions, externalizing the optional runSubagent workflow to a separate file, and trimming
  speculative integration documentation; all critical lifecycle and configuration instructions
  preserved
- Bumped bundled Agendo skill to version 1.4.5 — enabled automatic model invocation so agents can
  discover and invoke the skill without manual selection

## [0.1.13]

### Fixed

- Agendo no longer creates the todos root, `.agendo-config.json`, or `.gitignore` merely because
  the extension was activated or its settings changed. These files are initialized when the first
  todo is created or imported, while existing Agendo projects continue to receive config updates

### Changed

- Bumped bundled Agendo skill to version 1.4.4 — removed duplicate dependency-check section from
  reconciliation workflow, replaced arbitrary length thresholds with qualitative guidance, fixed
  PowerShell ID-detection command to avoid recursive directory traversal, and added missing skill
  frontmatter fields for consistency with other bundled skills
- Reconciliation skill now includes a multi-type recommendation example (status change and
  wording update) and the todo template marks optional sections with inline removal guidance
- Once explicitly invoked, an unscoped reconciliation request now reviews all non-terminal todos,
  automatically continues through stable issue-ID batches when needed, and consolidates completion,
  supersession, unchanged, and investigation recommendations for approval
- Enabled automatic model invocation for the Agendo skill so it can be discovered and invoked by
  agents when managing or reconciling todos

## [0.1.12]

### Fixed

- The todos root `.gitignore` no longer ignores `.agendo-config.json` (or itself), so the config
  stays visible to git-aware search tools and committable for team consistency — previously a
  blanket `*` ignore hid the config from file searches and caused skills/agents to miss it and
  start duplicate todo series from issue 001
- Bumped bundled Agendo skill to version 1.4.3 — config discovery now requires direct
  filesystem reads (never search/glob), and new todos include a duplicate-root guard that
  scans the workspace for an existing todo directory before creating one

## [0.1.11]

### Added

- `agendo.showDependencyNodes` setting (default `false`): when enabled, blocked todos appear as
  collapsible dependency nodes under their blockers in the tree view.

### Fixed

- Bumped bundled Agendo skill to version 1.4.2 — the `.skill-meta.json` version was stale at 1.4.1,
  causing the extension to report the wrong bundled version.

## [0.1.10]

### Added

- Gitignore toggle is now enabled by default.
- Dependency visualization in the tree view: blocked todos are indented under their blockers,
  making dependency chains visually clear.
- Import from clipboard command (`agendo.importFromClipboard`) that parses GitHub/GitLab issue
  URLs and creates todos with populated title, external key, and source reference.
- Extended reconciliation checks in the Agendo skill: Resume Context presence, orphaned
  `superseded_by` references, tag hygiene, dead link detection, and dependency consistency.
- Structured recommendation format for reconciliation output with confidence levels and
  evidence citations.

### Changed

- The gitignore toggle now ignores all agendo content in the todos root folder — every file including `.gitignore` is hidden from git.
- Updated the bundled Agendo skill to version 1.4.2.
- Performance test updated to account for dependency node grouping in the tree.

## [0.1.9]

### Added

- Delete todo option in the tree view context menu and on board cards (with confirmation).

### Changed

- Loading feedback now appears inline in the view instead of the status bar:
  - Toolbar buttons (task digest, skill install/update, refresh, open board, create todo)
    switch to a spinner icon in place while loading, rather than disappearing.
  - Tree operations (status, priority, group, and dependency updates) show a spinner on the
    specific todo item being updated.
- The "Set View Mode" picker now offers four distinct states with clarified behavior:
  - **VSCode Default** (new default): uses VS Code's own default open behavior, respecting
    your editor associations.
  - **Editor (source)**: forces the plain text editor, bypassing editor associations.
  - **Preview**: the rendered markdown preview.
  - **Preview editor (beta)**: VS Code's newer integrated markdown editor preview (now uses
    the correct `vscode.openWith` command).
- `.agendo-config.json` is now written only when settings differ from their defaults — a fully
  default workspace keeps no config file at all. The bundled skill documents the per-field
  defaults it falls back to when the file or an individual field is absent.
- Updated the bundled Agendo skill to version 1.4.1 to document the minimal config format.

## [0.1.8]

### Added

- Loading indicators for slow operations:
  - Task digest shows a status bar spinner while generating, blocks repeat clicks, and
    disables its toolbar button until it finishes.
  - Board cards show a busy overlay spinner when a status or priority change is in
    progress, blocking interaction with that card until the move completes.
  - Tree status, priority, group, and dependency changes show a status bar spinner
    while the todo file is written and the repository refreshes.
  - Skill install and update actions show a status bar spinner while the skill files
    are written.

### Changed

- Repository refreshes triggered by rapid Agendo configuration changes are now debounced,
  coalescing bursts of config edits into a single reload.

### Fixed

- Task digest no longer opens both a source editor and a preview — it now writes the
  digest to a real temp file and previews only that, matching how todos open.

## [0.1.7]

### Added

- Reconciliation / audit workflow in the bundled Agendo skill. It runs deterministic
  integrity checks (filename/frontmatter/folder sync, duplicate IDs, invalid or missing
  dependencies, cancelled hygiene, stale references, required sections) and an optional
  advisory semantic review, then proposes reviewable updates for approval.
- A `resources/skill/reconcile.md` reference file carrying the full reconciliation procedure,
  discovered via a short pointer in the skill so the main skill stays lean.

### Changed

- Updated the bundled Agendo skill to version 1.4.0 with the reconciliation workflow and an
  updated description.
- Reconciliation is advisory by design: it proposes changes but never auto-applies them,
  reserves `complete` for verified acceptance criteria, and preserves historical work logs.

## [0.1.6]

### Added

- `in-progress` lifecycle status between `pending` and `ready`, with tree, board,
  command palette, and filter support.
- Per-todo "Latest Updates & Next Steps" section in the task digest, sourced from
  each todo's Resume Context when filled.

### Changed

- Clarified status semantics: `ready` now means "likely done, being tweaked, still
  needs confirmation it works", while `complete` means fully finished and verified.
- Updated the bundled Agendo skill to version 1.3.1 with the new status lifecycle,
  config-aware paths, corrected ID and dependency commands, explicit filename
  authority, and clearer optional-integration guidance.
- Simplified the bundled todo template to use concise, neutral prompts without
  sample findings or decisions that could leak into newly created todos.

### Fixed

- Task digest no longer opens both an editor and a preview — it now shows a single
  markdown preview view.

## [0.1.5]

### Changed

- Moved skill install/enable and source-update actions into the Skill panel's
  overflow menu.
- Added an editor-window task board with status columns, drag-and-drop movement,
  filters, external-key metadata, and persisted controls for column and card
  field visibility and ordering, density, sorting, description previews, empty
  columns, metadata labels, date formatting, tag limits, title wrapping, and
  missing-value display, card accents, column widths, terminal-card limits,
  presets, per-column sorting, grouping, WIP indicators, and quick actions.

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
