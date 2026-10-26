---
status: pending
priority: p2
issue_id: "055"
tags: [canvas, settings, configuration, ux]
dependencies: []
---

# Separate workspace and extension settings in canvas settings panel

The canvas settings panel should clearly separate workspace-level configuration (visible to agents) from extension-level user preferences.

## Problem Statement

The canvas settings panel currently mixes workspace configuration (root folder, folder names, gitignored, code scanning) with extension user preferences (view mode, grouping, sorting, skill/canvas sources). Agents need to easily discover workspace settings that affect the current project, while user preferences are personal and not project-relevant. The `.agendo-config.json` file already serves as the agent-visible projection of workspace settings, but the canvas UI doesn't surface these workspace settings or clearly distinguish them from extension preferences.

## Findings

- `package.json` defines all settings under the `agendo` namespace without scope separation
- `.agendo-config.json` in the todos root is a projection containing only non-default workspace settings: `root`, `gitignored`, `backlogFolder`, `cancelledFolder`, `completeFolder`, `codeScanning`
- The canvas settings page (`resources/canvas/agendo-work-session/settings.mjs`) shows: View Options (groupBy), Extension info, Workspaces (board links), Skill info, Canvas info
- `configService.ts` bridges VS Code settings and `.agendo-config.json`, with VS Code settings as source of truth
- `getSettingsInfo()` in `extension.ts` provides settings data to the canvas but doesn't distinguish workspace vs extension settings
- The canvas settings page doesn't currently display workspace configuration values at all

## Proposed Solutions

### Option 1: Reorganize existing settings into two sections

**Approach:** Split the canvas settings panel into "Workspace Settings" and "Extension Settings" sections. Workspace Settings shows the current values from `.agendo-config.json` (or VS Code settings if the file is absent). Extension Settings shows user preferences.

**Pros:** Minimal implementation, reuses existing settings infrastructure, immediately improves clarity

**Cons:** Doesn't add editing capability for workspace settings from the canvas

**Effort:** Small

**Risk:** Low

---

### Option 2: Add workspace settings editing with config file sync

**Approach:** In addition to displaying workspace settings, allow editing them from the canvas (root folder, gitignored toggle, folder names). Changes write back to VS Code settings and sync to `.agendo-config.json`.

**Pros:** Complete settings management in one place, agents and users can configure from the canvas

**Cons:** More complex, requires handling edge cases (path validation, gitignore file updates)

**Effort:** Medium

**Risk:** Medium

## Recommended Action

Start with Option 1: display workspace settings clearly separated from extension settings. The canvas already has the data through `getSettingsInfo()` — it just needs to be organized and presented differently. Workspace settings should show their current values and note that they are projected to `.agendo-config.json` for agent visibility.

## Technical Details

- `resources/canvas/agendo-work-session/settings.mjs` — canvas settings page rendering
- `src/extension.ts` — `getSettingsInfo()` provides data to canvas
- `src/todos/configService.ts` — settings service and `.agendo-config.json` projection
- `package.json` — VS Code settings definitions
- `src/configuration.ts` — settings access helpers

## Acceptance Criteria

- [ ] Canvas settings page has a distinct "Workspace Settings" section showing root folder, gitignored, folder names, and code scanning status
- [ ] Canvas settings page has a distinct "Extension Settings" section for user preferences (view mode, grouping, sorting)
- [ ] Workspace settings display indicates they are projected to `.agendo-config.json` for agent visibility
- [ ] Extension settings are not presented as workspace/project configuration
- [ ] Existing settings actions (set-group-by, open-extension-settings, etc.) continue to work
- [ ] Extension tests pass

## Resume Context

**Current state:** Not started.

**Next step:** Triage and select approach (display-only vs editable), then implement canvas settings page reorganization.

## Work Log

### 2026-10-26 - Todo Created

**By:** Agent

**Actions:**

- Created the todo based on user request for workspace/extension settings separation

**Learnings:**

- None yet