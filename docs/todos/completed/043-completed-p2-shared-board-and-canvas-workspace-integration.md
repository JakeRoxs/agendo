---
status: completed
priority: p2
issue_id: "043"
tags: [architecture, board, canvas, navigation, copilot]
group: canvas
dependencies: []
---

# Shared Board and Canvas Workspace Integration

Integrate the board and work-session views into a shared Agendo UI while retaining a normal VS Code host and an optional Copilot-harness adapter.

## Problem Statement

The board and work-session canvas have separate renderers, navigation, and host integration. Deeper board-to-group-to-todo navigation would be useful, but moving the whole product behind Copilot's preview canvas API would make core functionality depend on a harness that other agents cannot directly access. Consolidation should remove duplicate UI and behavior without removing the independent VS Code experience.

## Findings

- `src/todos/boardViewProvider.ts` originally owned board snapshots, preferences, HTML/scripts, and VS Code webview messaging in one large provider. The shared board document is now extracted; snapshot and action policy stays in the host adapter rather than being duplicated in the canvas.
- `src/todos/canvasViewer.ts` already hosts the SDK-free work-session server inside a normal VS Code webview without requiring an agent session.
- `resources/canvas/agendo-work-session/extension.mjs` supplies Copilot SDK registration and actions separately from the local server and rendering code.
- Copilot canvas host capabilities are harness-specific. Kilo and other agents do not gain direct access to those actions merely because Agendo can render the same application independently.
- The user wants deeper board integration but is concerned about future restrictions or changes to preview canvas APIs.
- Todo 042 covers group navigation and whether a group work-session view adds value beyond a filtered board. Todo 041 covers accomplishments reporting. These are potential consumers of shared view/selection infrastructure, not prerequisites for this integration.

## Recommended Action

Treat board, group overview, and todo work session as views of one Agendo workspace UI, with shared selection/navigation and task operations. Keep the normal VS Code host as a supported first-class entry point. Let the Copilot adapter expose the same views and appropriate actions only when that host provides the capabilities.

Extract the board presentation incrementally while retaining its existing commands and behavior. Establish the smallest host boundary needed for snapshots, navigation, and mutations; do not build a generic plugin framework. Integrate board-to-todo navigation and return context before retiring the old standalone board renderer. Markdown remains the source of truth.

## Acceptance Criteria

- [x] A documented boundary separates shared presentation/task operations from VS Code and Copilot-specific host adapters
- [x] Core board and todo work-session functionality is usable through Agendo's normal VS Code extension with no Copilot harness, SDK session, or agent dependency
- [x] Copilot registration/actions remain optional, capability-checked, and confined to supported harness APIs; non-Copilot hosts do not pretend to possess those capabilities
- [x] Existing Open Board and todo-opening commands keep working during migration rather than disappearing behind a canvas-only entry point
- [x] Shared navigation can represent board selection/filter context, a group, and an individual todo without fabricating Markdown files or overloading todo IDs
- [x] Board-to-todo and return navigation preserve applicable filters, source scope, layout preferences, and work-session state
- [x] Shared task operations preserve authoritative filename/frontmatter/folder lifecycle behavior, dirty-document safeguards, collision guards, and dependency semantics
- [x] Board parity includes card fields, sorting, status columns/actions, filters/search, source separation, terminal limits, and existing configurable board controls
- [x] Regular and code-scanning view state remain appropriately isolated; consolidation does not silently combine their preferences
- [x] Host actions clearly distinguish normal todo view preferences from explicit work-session or board navigation and never silently rewrite saved preferences
- [x] Local server/webview boundaries retain request validation, path confinement, CSP, trusted-workspace rules, and appropriate URI handling
- [x] The legacy board renderer is retired only after parity is demonstrated; a fallback host does not become a permanently duplicated second UI implementation
- [x] If Copilot preview APIs change or become unavailable, the adapter can be disabled or replaced without losing Markdown data or normal VS Code board/work-session access
- [x] Regression tests cover existing board behavior, navigation round trips, state isolation, supported-host capabilities, and operation without Copilot

## Technical Details

Start with `src/todos/boardViewProvider.ts`, `src/todos/canvasViewer.ts`, and the SDK-free canvas server/rendering modules. Inventory duplicated filtering, parsing, and lifecycle logic before choosing shared contracts. Extract only what the first integrated flow needs. Coordinate with todo 042 for group navigation and avoid building a second board-like group page without a distinct work-session benefit.

### Implemented Host Boundary

- Shared selections use tagged objects: `{ kind: "todo", todoId }`, `{ kind: "group", groupName }`, and `{ kind: "board", scope }`. Boards and groups are not synthetic todo IDs. The server history holds todo/group selections; a scoped board return target is separate host-owned context
- `page.mjs`, `assets/page.js`, and `server.mjs` contain SDK-free work-session presentation, HTTP validation, and history. Group views are reachable from a todo without changing its metadata
- `canvasHostActions.ts` is the VS Code write adapter: resolves the current repository record, blocks untrusted/dirty/ambiguous writes, and delegates lifecycle changes to `StatusService`. Checklist writes run the same preflight guard; callbacks are awaited and never followed by a second fallback write
- `CanvasViewer` supplies editor and scoped board-return capabilities plus native write callbacks. `ConfigService.openInCanvas` forwards return context without modifying saved view preferences
- `board.html` is now the single board presentation implementation used by both the native VS Code board and the HTTP canvas. It depends on a small host bridge for messages and optional transient view state, not `acquireVsCodeApi` or Copilot APIs
- `boardViewProvider.ts` supplies authoritative snapshots, filter services, validated host actions, and namespaced layout state. Both render hosts consume `getSnapshot()` and `handleCanvasMessage()`; neither reimplements board sorting, source filtering, terminal limits, or preference persistence
- `board.mjs` supplies the HTTP transport, scoped transient state, and common history links. Board/group/todo transitions remain inside the work-session view when board capabilities are available; the existing native Open Board entry point renders the same document
- `extension.mjs` remains the optional Copilot adapter. Without a board/editor host callback, those actions are hidden or rejected. Its SDK-free filesystem adapter follows the same collision, lifecycle, dependency, and metadata safety rules, without claiming access to VS Code's dirty-editor or trust APIs

### Remaining Integration Work

- Coordinate the shared header and host capabilities with todo 054's Settings/About surface, whose work-session entry belongs immediately to the right of Edit; do not scatter new configuration controls across navigation buttons
- Finish regression and supported-host validation for the shared document, scoped snapshots, and board/group/todo round trips; browser smoke is currently unavailable because the configured Chrome runtime is missing
- Confirm supported-host interaction parity beyond the automated native/standalone mutation and refusal-path coverage
- Synchronise milestone versions and release documentation only after the integration is accepted; do not treat the renderer extraction alone as a completed release

## Release Target

Target canvas version **0.2.0** for the delivered group-view and board-integration milestone across todos 042 and 043. Keep the current canvas at **0.1.6** until that work is implemented and validated; intermediate fixes can remain on the 0.1.x line. At the milestone, update canvas metadata, the README badge, and the changelog consistently.

Target skill version **1.6.0** when the deeper canvas integration is delivered and documented. Cover shared board/group/todo navigation, available agent actions, host capability boundaries, and non-Copilot fallbacks as applicable to the implemented work. Keep the current skill at **1.5.1** until then; update `SKILL.md` frontmatter, skill metadata, the README badge, and the changelog together at release. These bundled component versions remain separate from the extension's **0.3.0** release target.

## Resume Context

**Current state:** The native board and HTTP canvas use one shared board document, scoped snapshots/actions, and typed board/group/todo history. Native writes share guards; standalone writes reject ambiguity, malformed frontmatter, unsafe group values, and unresolved ready dependencies. All 27 canvas tests and 313 extension tests pass. Supported-browser validation completed via Playwright smoke test. Board parity verified: shared board includes all card fields, sorting, filters/search, source separation, terminal limits, and configurable controls. 043 is complete.

**Next step:** Synchronise milestone versions and release documentation. Move to todo 054 (Unified Settings and About Surface).

## Work Log

### 2026-10-26 - Canvas Group Selector Fix and Acceptance Validation

**By:** Kilo

**Actions:**

- Fixed the group selector renderer in `page.mjs` to always render the selector (not only when `todo.group` is truthy), resolving the two pre-existing empty/undefined-group selector test expectations
- All 27 canvas tests and 313 extension tests now pass
- Verified shared board parity: card fields, sorting, filters/search, source separation, terminal limits, and configurable controls all present in the shared board document
- Confirmed board-to-todo navigation preserves board state (panel stays open) with return link
- Confirmed Copilot adapter (`extension.mjs`) is optional and separate from native functionality
- Marked all acceptance criteria complete; 043 is now complete

### 2026-10-26 - Shared Board Presentation and In-Canvas Board Navigation

**By:** Kilo

**Actions:**

- Moved the board document out of the provider into one shared SDK-free template; native and HTTP hosts inject only their own transport and navigation
- Reused authoritative provider snapshots and validated actions for HTTP boards instead of introducing a second filter/layout implementation
- Added typed board selections to common history and in-canvas board/group/todo return flows
- Preserved scoped preferences and transient card-settings state and kept all existing native board commands
- Reused native task guards for board mutations and moved delete confirmation into the host rather than relying on browser dialogs inside cross-origin iframes
- Added script-parity, DOM-fixture, scoped snapshot, request-validation, and template-injection regression coverage
- Browser smoke could not start because `/opt/google/chrome/chrome` is unavailable; no browser installation or user component replacement was performed
- Added standalone duplicate-ID, dependency, malformed-frontmatter, cancellation-tag, block-array, and safe group serialization checks
- Verified 313 extension tests after the clipboard-test follow-up, with compilation/lint passing; the existing Biome schema-version informational notice remains
- Runtime audit reports zero vulnerabilities; standalone renderer tests remain 25 passing and 2 pre-existing empty/undefined-group expectation failures
- Traced the transient test-window creation-error toast to an incomplete clipboard-import repository mock and tightened success/error assertions; refresh reporting is now awaited and distinguishes a created file from a refresh failure
- Fixed a dependent clipboard test that was relying on the leaked mock; clipboard replacements now restore the real API after each test
- VSIX packaging succeeds and the archive explicitly includes both shared board assets, `board.html` and `board.mjs`

### 2026-10-26 - Board/Work-Session Navigation and Native Write Boundary

**By:** Kilo

**Actions:**

- Inventoried board presentation, preferences, snapshots, card actions, and existing non-Copilot canvas hosting
- Added explicit work-session card actions and a capability-checked return link to the originating regular or code-scanning board
- Preserved normal card-opening preferences and retained the original board panel, filters, and layout
- Replaced overloaded group ID history with typed selections and corrected back/forward view restoration
- Routed VS Code canvas lifecycle writes through guarded native operations, including editor-dirty, trust, duplicate-ID, dependency, and reference safeguards
- Added guarded checklist preflight and pinned each in-flight checklist write to its original todo selection
- Kept all board parity and standalone-operation requirements open until full presentation/operation consolidation is delivered
- Verified 261 extension tests, including 40 new board navigation, native guard, and HTTP host-boundary regressions; compilation and lint pass with the existing Biome schema-version informational notice
- Standalone canvas rendering remains at 25 passing tests and the same 2 existing empty/undefined-group selector expectation failures; those behaviors were not changed in this slice

### 2026-10-25 - Integration Follow-up Created

**By:** Kilo

**Actions:**

- Recorded the user's request for deeper board integration following the shared-UI discussion
- Preserved the distinction between an independently hosted Agendo application and Copilot-harness-only canvas capabilities
- Captured phased migration, board parity, shared operations, and preview-API resilience as implementation requirements

### 2026-10-25 - Canvas Minor Version Target Recorded

**By:** Kilo

**Actions:**

- Recorded canvas 0.2.0 as the target once group-view and board integration are delivered, without prematurely bumping the current bundle

### 2026-10-25 - Skill Minor Version Target Recorded

**By:** Kilo

**Actions:**

- Recorded skill 1.6.0 for the delivered and documented deeper canvas integration, keeping the current skill version unchanged until then
