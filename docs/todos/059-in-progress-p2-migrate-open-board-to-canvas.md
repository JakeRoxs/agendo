---
status: in-progress
priority: p2
issue_id: "059"
tags: [board, canvas, migration]
group: canvas
dependencies: [043]
---

# Migrate Open Board Commands to Canvas

Migrate the `agendo.openBoard` and `agendo.codeScanning.openBoard` commands from the standalone board webview panel to the Agendo canvas, completing the board-to-canvas integration planned in todo 043.

## Problem Statement

The board opens in a separate VS Code webview panel, duplicating the board rendering that already exists in the canvas. The board should open in the canvas to provide a unified workspace experience.

## Implementation

- Pass `canvasViewer` to `CommandServices` in `commandRegistration.ts`
- Update `registerBoardCommands` to call `canvasViewer.open(root, { kind: "board", scope })` instead of `boardViewProvider.open()`
- Pass `canvasViewer` from `extension.ts` into the command services

## Verification

- Extension compiles cleanly
- All 322 extension tests pass
- Lint passes
- Extension bundles successfully
- Extension reinstalled via VSIX

## TODO

- Test in live VS Code that the board opens in the canvas
- Verify board interactions (filtering, card actions) work correctly in canvas
- Verify "return to board" from canvas todo view works correctly