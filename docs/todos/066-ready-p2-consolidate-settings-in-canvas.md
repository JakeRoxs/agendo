---
status: ready
priority: p2
issue_id: "066"
tags: [canvas, settings, configuration, ux]
group: canvas
dependencies: [054, 055]
---

# Consolidate All Settings in the Settings Canvas

Move every user-facing setting into the consolidated settings canvas so it is the single hub for configuration. The skill/canvas update portions (check source, install from source) already live there and are left alone.

## Problem Statement

Settings are scattered between extension commands (`agendo.setViewMode`, `agendo.toggleSortDate`, `agendo.setGroupBy`, `agendo.chooseRoot`, `agendo.toggleGitignore`, `agendo.setDefault.*`) and the canvas settings page. The canvas settings page (`/settings`) currently shows version info, workspace settings, and component update actions, but has no UI for view mode, grouping, sorting, root folder, gitignore, or defaults. Users must leave the canvas to change these via command palette.

## Recommended Action

Flesh out the settings canvas page (`resources/canvas/agendo-work-session/settings.mjs`) with controls for every setting that currently lives only in extension commands:

- View mode switcher (default / editor / preview / previewEditor / canvas)
- Sort by date toggle
- Group by selector (status / priority / group / none)
- Root folder input
- Gitignore toggle
- Default root input
- Default priority selector
- Default preview selector
- Code scanning enabled toggle
- Lifecycle folder names, SonarQube connection preferences, dependency-node and criteria-change preferences
- Skill/canvas update source preferences and bundled-update notifications, outside the unchanged update action sections
- Independent Todos and Code Scanning board column visibility controls, replacing the board toolbar's Hidden/Show controls

Extend `resources/canvas/agendo-work-session/assets/settings.js` to POST explicit typed values to `/settings/action`. The extension delegates validated updates to `SettingsService`. Mutations reload the Settings page to show persisted values; navigation actions avoid reloading. Keep the old command-palette settings as fallbacks.

Leave untouched:
- Skill update section (check source, install from source)
- Canvas update section (check source, install from source)
- Open VS Code extension settings link
- Open board / open tree links

## Acceptance Criteria

- [x] Settings page has a dedicated section for each consolidated setting with a visible current value and an edit control
- [x] View mode switcher is present in the settings canvas (not only via command palette)
- [x] Sort by date, group by, root folder, gitignore, and defaults are all editable from the settings canvas
- [x] Each control POSTs to `/settings/action` and the extension handles the action, updating VS Code settings and refreshing affected views
- [x] Workspace settings remain clearly separated from extension user preferences (per todo 055)
- [x] Board column visibility toggles live in Settings, not the board toolbar, with independent Todos and Code Scanning preferences
- [x] Skill and canvas update sections are unchanged
- [x] Extension tests and canvas tests pass
- [x] Lint clean
- [ ] Rebuilt-extension smoke check confirms actual workspace/user settings persist and both boards reflect visibility changes in the user's VS Code session

## Technical Details

- `resources/canvas/agendo-work-session/settings.mjs` — add setting controls and action data attributes
- `resources/canvas/agendo-work-session/assets/settings.js` — typed checkbox/select/form saves, pending-save protection, accessible status and error feedback
- `resources/canvas/agendo-work-session/server.mjs` — already routes `/settings/action` to `handleSettingsAction`
- `src/todos/settingsService.ts` — validated setting/action allowlists, real navigation/update command delegation, workspace vs global targeting and per-board visibility
- `src/extension.ts` — wires SettingsService to the canvas action contract
- `src/todos/boardViewProvider.ts` — exposes persisted visibility per scope and opens consolidated Settings from the native fallback
- `src/todos/canvasViewer.ts` and `src/commands.ts` — reusable Settings opener and `agendo.openSettings` entry point
- `src/commandRegistration.ts` — the old extension commands (`SetViewMode`, `ToggleSortDate`, `SetGroupBy`, `ChooseRoot`, `ToggleGitignore`, `SetDefaultRoot`, `SetDefaultPriority`, `SetDefaultPreview`) can remain as fallbacks but the canvas is now the primary path

## Resume Context

**Current state:** Consolidated editable Settings and independent board column visibility controls are implemented. Toolbar Hidden/Show controls are removed; per-column Hide shortcuts remain. Native fallback and command palette can open the same Settings canvas. All automated tests and production bundles pass; browser-fixture saves and narrow layout pass. Installed-extension verification is still outstanding.

**Next step:** Rebuild/reload the extension used by VS Code. Verify a workspace preference and a global default persist, then hide/restore columns in each board independently using Settings. Confirm native fallback Settings navigation if that path is used; only then mark completed.

## Work Log

### 2026-10-27 - Implement consolidated controls and board visibility

**By:** Kilo

**Actions:**

- Added current-value selects, checkboxes, explicit Save forms, and section jump links to the Settings canvas
- Separated project configuration, extension preferences, global user defaults, and per-board column visibility; no token fields or secret reads added
- Moved toolbar Hidden/Show controls into independent Todos and Code Scanning visibility fieldsets; preserved column-header Hide shortcuts
- Added SettingsService with strict boolean/enum/scope/path/source validation, global-default inspection, workspace configuration updates, config projection refresh, and scoped board persistence
- Preserved existing skill/canvas check/install command flows and reload behavior, extension-settings link, and board/tree links
- Added `agendo.openSettings` and CanvasViewer.openSettings so native board users can restore hidden columns through the consolidated canvas
- Added native settings, canvas opener, rendered board, HTTP Settings, and actual client-script VM regression coverage
- Fixed test isolation and activation-fixture metadata exposed by the new service; final run has no failures
- Validation: `npm test` passed with 398 extension tests, compile and lint; all canvas suites passed with 283 tests; `npm run bundle` built extension and MCP bundles
- Browser fixture verified text Save, typed boolean saves, global-default/workspace separation, independent board visibility, and 12 visibility controls; at 420px no controls overflowed the viewport

**Learnings:**

- Persisted hidden-column preferences must be read directly, not from a collision-mode snapshot that temporarily displays all columns
- Lifecycle folder names must match the shared canvas loader's single-name format; root paths can be nested but must not escape the workspace lexically
- Keep live workspace configuration untouched during automated/browser-fixture validation; the user's rebuilt-extension smoke check remains explicit rather than claiming completion

### 2026-10-27 - Start settings consolidation

**By:** Kilo

**Actions:**

- Confirmed 054 and 055 have terminal completed files and inspected current Settings rendering/actions
- Added requested independent board column visibility controls to scope, replacing toolbar hidden-status controls
- Retain existing commands as fallbacks; do not change skill/canvas update sections

### 2026-10-27 - Todo Created

**By:** Kilo

**Actions:**

- Created the todo from the request to consolidate all settings in the settings canvas

**Learnings:**

- None yet
