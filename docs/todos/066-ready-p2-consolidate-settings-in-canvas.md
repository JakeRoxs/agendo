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

Add `resources/canvas/agendo-work-session/settings.js` to handle button/link clicks by POSTing to `/settings/action`. The canvas server already routes `/settings/action` to `actions.handleSettingsAction`, which the extension implements. Add new action handlers for the consolidated settings (e.g. `set-view-mode`, `toggle-sort-date`, `set-group-by`, `set-root`, `toggle-gitignore`, `set-default-*`).

Leave untouched:
- Skill update section (check source, install from source)
- Canvas update section (check source, install from source)
- Open VS Code extension settings link
- Open board / open tree links

## Acceptance Criteria

- [ ] Settings page has a dedicated section for each consolidated setting with a visible current value and an edit control
- [ ] View mode switcher is present in the settings canvas (not only via command palette)
- [ ] Sort by date, group by, root folder, gitignore, and defaults are all editable from the settings canvas
- [ ] Each control POSTs to `/settings/action` and the extension handles the action, updating VS Code settings and refreshing affected views
- [ ] Workspace settings remain clearly separated from extension user preferences (per todo 055)
- [ ] Skill and canvas update sections are unchanged
- [ ] Extension tests and canvas tests pass
- [ ] Lint clean

## Technical Details

- `resources/canvas/agendo-work-session/settings.mjs` — add setting controls and action data attributes
- `resources/canvas/agendo-work-session/settings.js` — new file; wire clicks to `fetch('/settings/action', {...})`
- `resources/canvas/agendo-work-session/server.mjs` — already routes `/settings/action` to `handleSettingsAction`
- `src/extension.ts` — `handleSettingsAction` switch: add cases for the new actions; each updates the corresponding setting and returns `{ success: true, reload: false }`
- `src/commandRegistration.ts` — the old extension commands (`SetViewMode`, `ToggleSortDate`, `SetGroupBy`, `ChooseRoot`, `ToggleGitignore`, `SetDefaultRoot`, `SetDefaultPriority`, `SetDefaultPreview`) can remain as fallbacks but the canvas is now the primary path

## Resume Context

**Current state:** Not started. Settings button and page exist (todo 054 completed). Workspace/extension separation proposed (todo 055 not started). Consolidation not yet done.

**Next step:** Implement settings canvas controls + settings.js + extension action handlers. Then deprecate the now-redundant extension commands.

## Work Log

### 2026-10-27 - Todo Created

**By:** Kilo

**Actions:**

- Created the todo from the request to consolidate all settings in the settings canvas

**Learnings:**

- None yet
