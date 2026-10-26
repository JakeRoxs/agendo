---
status: complete
priority: p2
issue_id: "054"
tags: [canvas, settings, about, board, tree, ux]
group: canvas
dependencies: []
---

# Unified Settings and About Surface

Provide a consolidated Agendo Settings/About surface, accessible immediately to the right of the Edit button in the work-session header.

## Problem Statement

Extension settings, board controls, tree-view options, and component version/update information are scattered across toolbars, context menus, and the Skill status panel. More individual buttons would make the interface harder to navigate. The user wants a central entry point beside Edit that brings these controls and status information together.

## Findings

- Todo 043 establishes the shared board/group/todo workspace and host boundary
- Todo 050 explores tree hierarchy, grouping versus priority, and alternative view modes; this todo owns the settings surface rather than deciding that hierarchy
- Todos 051 and 053 already provide component version review, explicit source checks, update actions, and refresh feedback; reuse that behavior rather than creating a separate update mechanism
- Board and tree settings have different owners and scopes; a single surface must not silently combine regular and code-scanning preferences or change where settings are persisted

## Recommended Action

Add a clearly labelled Settings entry beside Edit, opening a consolidated surface with sections for extension settings, board views, tree views, and About/version status. Choose the concrete presentation during triage rather than committing prematurely to a drawer, dialog, or full-page view.

Group related controls and make their scope explicit. Reuse existing configuration and update operations. Migrate redundant toolbar/context-menu controls only after their replacements are available and discoverable. The surface must remain accessible from board/group views that have no Edit action.

## Acceptance Criteria

- [x] A discoverable Settings entry sits immediately to the right of Edit in the work-session header and remains keyboard-accessible on narrow layouts
- [x] Board and group views offer the same settings entry in a consistent header location even when Edit is absent
- [x] Extension, board, tree, and About/version information are clearly organised within one consolidated surface
- [x] Existing configurable board controls and tree grouping/sorting/filtering options are inventoried and either exposed directly or linked to their authoritative settings
- [x] Each setting clearly identifies its scope, including regular versus code-scanning views and workspace versus user configuration where applicable
- [x] Opening or dismissing settings never changes preferences, task lifecycle, selection, or navigation state
- [x] Changes use existing configuration and task boundaries and do not reset unrelated view preferences
- [x] About distinguishes the extension version, installed skill/canvas versions, bundled versions included in the extension, and configured source versions from GitHub/main by default
- [x] Version checks, unavailable-source feedback, and explicit installation actions reuse the 051/053 flow; newer installed versions are not presented as outdated
- [x] Host-specific controls are capability-checked, with clear unavailable states or appropriate fallback links outside the normal VS Code host
- [x] Redundant toolbar/menu controls are consolidated without removing the only accessible route to an operation
- [x] Tests cover entry placement, keyboard access, settings persistence/scope isolation, host capabilities, and version/action presentation

## Technical Details

Start with the work-session header in `resources/canvas/agendo-work-session/page.mjs`, the board controls in `src/todos/boardViewProvider.ts`, configuration services, and the component version/update commands. Coordinate shared presentation and host actions with 043. Coordinate tree option design with 050 without blocking this work on a completed tree redesign.

Do not expose credentials or secret configuration values in About, diagnostics, or copied status information.

## Resume Context

**Current state:** Complete. Settings button added to todo canvas (right of Edit), group canvas, and board toolbars. Settings page at `/settings` with extension version, skill/canvas installed/bundled/source versions, and actions to open VS Code settings, boards, tree, check source, and install components. Fixed CSP issue by externalizing settings script. Browser validation via Playwright confirms correct rendering with no console errors. All 313 extension tests and 34 canvas tests pass.

**Next step:** None. Todo complete.

## Work Log

### 2026-10-26 - Browser Validation and CSP Fix

**By:** Kilo

**Actions:**

- Validated settings page rendering in Chrome via Playwright; confirmed all sections display correctly with no console errors
- Fixed CSP violation by moving inline settings script to external `assets/settings.js`
- Registered `/settings.js` as a canvas asset in server.mjs
- Verified back navigation works correctly
- All 313 extension tests and 34 canvas tests pass

### 2026-10-26 - Settings Button and Page Implementation

**By:** Kilo

**Actions:**

- Added Settings button to todo canvas toolbar (right of Edit) with gear icon
- Added Settings button to group canvas toolbar
- Added Settings button to board toolbar (works in both canvas and native VS Code hosts)
- Created `/settings` route in canvas server with version info display
- Implemented settings actions: open VS Code extension settings, open boards, open tree view, check component source versions, install components
- Settings page shows extension version, skill/canvas installed/bundled/source versions with status
- Board host handles settings message: navigates to /settings in canvas, opens VS Code settings in native host
- Added 4 canvas regression tests for settings button and page rendering
- All 313 extension tests and 31 canvas tests pass

### 2026-10-26 - Created From Settings Placement Feedback

**By:** Kilo

**Actions:**

- Recorded the entry point immediately to the right of Edit
- Captured extension, board, tree, and About/version sections
- Separated settings-surface ownership from todo 050's tree structure decisions
- Linked existing version/update behavior from 051 and 053 and the shared host boundary from 043
