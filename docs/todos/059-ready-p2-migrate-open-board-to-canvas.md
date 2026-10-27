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

- [ ] `agendo.openBoard` command opens the board in the canvas instead of a standalone webview panel
- [ ] `agendo.codeScanning.openBoard` command opens the code scanning board in the canvas
- [ ] Board interactions (filtering, card actions) work correctly in the canvas
- [ ] "Return to board" from canvas todo view works correctly
- [ ] Extension compiles cleanly
- [ ] All extension tests pass
- [ ] Lint passes
- [ ] Extension bundles successfully

## Resume Context

**Current state:** Board and task digest both migrated to canvas. Board commands route through `canvasViewer.open()` with `{ kind: "board", scope }`. Digest commands now open `{ kind: "digest", scope }` in the canvas with a dedicated `digest.mjs` renderer that polls `/digest-snapshot`. `getDigest` action added to `CanvasViewer` and `extension.ts`. Old temp-file markdown preview approach removed.

**Verification performed:**
- `npm run compile` (tsc): clean
- `npm run lint` (biome): 55 files, no issues
- `npm run test:canvas`: 254 pass / 0 fail / 41 suites
- `npm run bundle` (esbuild): extension + MCP server bundle successfully

**Next step:** Test in live VS Code that both board and digest open in the canvas and verify interactions work correctly (cannot be performed in this environment; no VS Code test cache available).

## Work Log

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