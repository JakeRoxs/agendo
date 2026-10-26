---
status: pending
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

- `src/todos/boardViewProvider.ts` owns board snapshots, preferences, HTML/scripts, and VS Code webview messaging in one large provider.
- `src/todos/canvasViewer.ts` already hosts the SDK-free work-session server inside a normal VS Code webview without requiring an agent session.
- `resources/canvas/agendo-work-session/extension.mjs` supplies Copilot SDK registration and actions separately from the local server and rendering code.
- Copilot canvas host capabilities are harness-specific. Kilo and other agents do not gain direct access to those actions merely because Agendo can render the same application independently.
- The user wants deeper board integration but is concerned about future restrictions or changes to preview canvas APIs.
- Todo 042 covers group navigation and whether a group work-session view adds value beyond a filtered board. Todo 041 covers accomplishments reporting. These are potential consumers of shared view/selection infrastructure, not prerequisites for this integration.

## Recommended Action

Proposed for triage: treat board, group overview, and todo work session as views of one Agendo workspace UI, with shared selection/navigation and task operations. Keep the normal VS Code host as a supported first-class entry point. Let the Copilot adapter expose the same views and appropriate actions only when that host provides the capabilities.

Extract the board presentation incrementally while retaining its existing commands and behavior. Establish the smallest host boundary needed for snapshots, navigation, and mutations; do not build a generic plugin framework. Integrate board-to-todo navigation and return context before retiring the old standalone board renderer. Markdown remains the source of truth.

## Acceptance Criteria

- [ ] A documented boundary separates shared presentation/task operations from VS Code and Copilot-specific host adapters
- [ ] Core board and todo work-session functionality is usable through Agendo's normal VS Code extension with no Copilot harness, SDK session, or agent dependency
- [ ] Copilot registration/actions remain optional, capability-checked, and confined to supported harness APIs; non-Copilot hosts do not pretend to possess those capabilities
- [ ] Existing Open Board and todo-opening commands keep working during migration rather than disappearing behind a canvas-only entry point
- [ ] Shared navigation can represent board selection/filter context, a group, and an individual todo without fabricating Markdown files or overloading todo IDs
- [ ] Board-to-todo and return navigation preserve applicable filters, source scope, layout preferences, and work-session state
- [ ] Shared task operations preserve authoritative filename/frontmatter/folder lifecycle behavior, dirty-document safeguards, collision guards, and dependency semantics
- [ ] Board parity includes card fields, sorting, status columns/actions, filters/search, source separation, terminal limits, and existing configurable board controls
- [ ] Regular and code-scanning view state remain appropriately isolated; consolidation does not silently combine their preferences
- [ ] Host actions clearly distinguish normal todo view preferences from explicit work-session or board navigation and never silently rewrite saved preferences
- [ ] Local server/webview boundaries retain request validation, path confinement, CSP, trusted-workspace rules, and appropriate URI handling
- [ ] The legacy board renderer is retired only after parity is demonstrated; a fallback host does not become a permanently duplicated second UI implementation
- [ ] If Copilot preview APIs change or become unavailable, the adapter can be disabled or replaced without losing Markdown data or normal VS Code board/work-session access
- [ ] Regression tests cover existing board behavior, navigation round trips, state isolation, supported-host capabilities, and operation without Copilot

## Technical Details

Start with `src/todos/boardViewProvider.ts`, `src/todos/canvasViewer.ts`, and the SDK-free canvas server/rendering modules. Inventory duplicated filtering, parsing, and lifecycle logic before choosing shared contracts. Extract only what the first integrated flow needs. Coordinate with todo 042 for group navigation and avoid building a second board-like group page without a distinct work-session benefit.

## Release Target

Target canvas version **0.2.0** for the delivered group-view and board-integration milestone across todos 042 and 043. Keep the current canvas at **0.1.6** until that work is implemented and validated; intermediate fixes can remain on the 0.1.x line. At the milestone, update canvas metadata, the README badge, and the changelog consistently.

Target skill version **1.6.0** when the deeper canvas integration is delivered and documented. Cover shared board/group/todo navigation, available agent actions, host capability boundaries, and non-Copilot fallbacks as applicable to the implemented work. Keep the current skill at **1.5.1** until then; update `SKILL.md` frontmatter, skill metadata, the README badge, and the changelog together at release. These bundled component versions remain separate from the extension's **0.3.0** release target.

## Resume Context

**Current state:** Architecture direction captured; no board renderer has been moved or removed and no host capability has been assumed.

**Next step:** Inventory board features and current host-specific operations, then propose a minimal extraction plan that keeps Open Board working throughout the migration.

## Work Log

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
