---
status: ready
priority: p2
issue_id: "059"
tags: [board, canvas, migration]
group: canvas
dependencies: [043]
---

# Migrate Open Board Commands to Canvas

## Problem Statement

The board opens in a separate VS Code webview panel, duplicating the board rendering that already exists in the canvas. The board should open in the canvas to provide a unified workspace experience.

## Acceptance Criteria

- [x] `agendo.openBoard` command opens the board in the canvas instead of a standalone webview panel
- [x] `agendo.codeScanning.openBoard` command opens the code scanning board in the canvas
- [ ] Board interactions (filtering, card actions) work correctly in the canvas
- [ ] "Return to board" from canvas todo view works correctly
- [x] Extension compiles cleanly
- [x] All extension tests pass
- [x] Lint passes
- [x] Extension bundles successfully

## Resume Context

**Current state:** Board and digest commands route through the canvas viewer. The partial 067 regression that removed board styling and blocked its replacement stylesheet is repaired. Native fallback and HTTP canvas share the same board template and CSS. Compile, lint, extension-host tests, canvas tests, and bundles pass; installed-extension verification remains outstanding.

**Next step:** Rebuild/reload the extension used by VS Code and smoke test both board scopes and digest with real workspace data, especially scanning source sections and scoped filters/actions. Browser-fixture round trips pass but do not verify the user's installed extension.

## Work Log

### 2026-10-27 - Repair board regression and verify migration boundary

**By:** Kilo

**Actions:**

- Confirmed `registerBoardCommands` routes both scopes to `CanvasViewer.open` rather than the legacy board panel
- Traced the unstyled screenshot to removed board CSS and an HTTP CSP blocking the replacement stylesheet
- Repaired shared stylesheet loading for HTTP and native fallback without broadening native CSP permissions; added actual HTTP stylesheet/CSP regression tests for both scopes
- `npm test`: compile and lint passed, 364 extension tests passed
- All canvas `*.test.mjs` suites passed: 297 tests
- `npm run bundle`: extension and MCP bundles succeeded
- Browser-tested a read-only fixture at 1206px and 800px: grid/cards, card settings, work-session navigation to real todo 059, return to board, recent-menu open/Escape dismissal

**Learnings:**

- Shared HTML alone does not establish presentation parity; both hosts must receive shared CSS under their own CSP rules
- VS Code test cache is now available and the extension-host suite ran successfully, superseding the earlier environment limitation
- Browser-fixture validation does not replace checking the rebuilt extension's real command/filter wiring; retain ready rather than completed

### 2026-10-26 - Implementation

**By:** Copilot

**Actions:**

- Passed `canvasViewer` to `CommandServices` in `commandRegistration.ts`
- Updated `registerBoardCommands` to call `canvasViewer.open(root, { kind: "board", scope })` instead of `boardViewProvider.open()`
- Passed `canvasViewer` from `extension.ts` into the command services
- Verified extension compiles cleanly
- All 322 extension tests pass
- Lint passes
- Extension bundles successfully
- Extension reinstalled via VSIX

**Learnings:**

- Board rendering already exists in the canvas, so this is a routing change rather than a new feature

### 2026-10-27 - Verification

**By:** Kilo

**Actions:**

- Verified all implementation changes described in resume context are present in code (`commandRegistration.ts`, `extension.ts`, `workspaceNavigation.ts`, `canvasViewer.ts`, `server.mjs`, `digest.mjs`).
- `npm run compile` (tsc): clean.
- `npm run lint` (biome): 55 files, no issues.
- `npm run test:canvas`: 254 pass / 0 fail / 41 suites (includes digest canvas server flow, board navigation, digest navigation via history pill).
- `npm run bundle` (esbuild): extension + MCP server bundle successfully.

**Remaining:** Live VS Code testing that both board and digest open in the canvas and interactions work correctly; cannot be performed in this environment (no VS Code test cache available).

### 2026-10-26 - Task Digest Migration

**By:** Copilot

**Actions:**

- Added `digest` view kind to `WorkspaceView` type in `workspaceNavigation.ts`
- Created `digest.mjs` renderer with polling for `/digest-snapshot` endpoint
- Added `digest` view kind support in `server.mjs` (normalizeView, assertViewSupported, route handling)
- Added `getDigest` action to `CanvasViewer` interface and `extension.ts` implementation
- Updated `ShowDigest` command in `commandRegistration.ts` to open canvas with `{ kind: "digest", scope }`
- Removed old temp-file markdown preview approach and unused imports (`buildTodoDigest`, `os`)
- Updated tests: digest concurrent-runs test now verifies canvas open, extension activation test adjusted for new digest flow
- All 323 tests pass, lint passes, bundles successfully

**Learnings:**

- Digest migration followed the same pattern as board: add view kind, create renderer, wire action, update command
- The digest renderer polls for updates every 5 seconds, similar to the board's refresh pattern
