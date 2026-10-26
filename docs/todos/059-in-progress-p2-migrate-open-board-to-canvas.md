---
status: in-progress
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

**Current state:** Implementation complete. `canvasViewer` passed to `CommandServices`, board commands updated to use `canvasViewer.open()`. Extension compiles, tests pass, lint passes, bundles successfully, and is reinstalled via VSIX.

**Next step:** Test in live VS Code that the board opens in the canvas and verify board interactions work correctly.

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