---
status: complete
priority: p2
issue_id: "051"
tags: [canvas, updates, ux]
group: canvas
dependencies: []
---

# Canvas Update Notification and Unified Update Cleanup

Add a canvas update/update notification function similar to the skill update check, and clean up the existing unified update notification to be clearer about version sources.

## Problem Statement

There is no canvas update notification similar to the skill update mechanism. The existing unified update notification has unintuitive click behavior and displayed information. It should be more distinct and clear about:
- Source being from github/main
- Bundled being included in the extension
- The currently installed version
- Versions newer than current should not be labeled as "older" or "needing update" but should be aware they don't match source or bundled

## Findings

- Skill update mechanism exists in `src/todos/skillManager.ts` with status checking, install, and update from source
- Canvas version is tracked in `resources/canvas/agendo-work-session/.canvas-meta.json`
- The canvas is installed via the extension's install canvas command
- Current update notification combines skill and canvas updates in a way that is not intuitive

## Recommended Action

Implemented explicit skill/canvas version review and replacement actions, distinguishing:
- Installed canvas version
- Bundled canvas version (included in extension)
- Source canvas version (from github/main)

Status rows open review without modifying files. Source checks fetch metadata only; bundle/source installation is a separate explicit action with confirmation before replacing an installed copy. Activation notifications compare installed and bundled versions without automatically installing or fetching GitHub source.

## Acceptance Criteria

- [x] Canvas update status check implemented similar to skill update
- [x] Clear distinction between installed, bundled, and source canvas versions
- [x] Versions newer than current not labeled as "older" or "needing update"
- [x] Updated version shown as not matching source/bundled but not as broken
- [x] Click behavior on update notification is intuitive
- [x] Displayed information is clear about version sources

## Technical Details

Primary areas: `src/todos/canvasManager.ts`, `src/todos/skillManager.ts`, update notification UI components.

## Resume Context

**Current state:** Version/action pickers, explicit source checks, clearer status rows, and confirmed replacements are implemented and covered by extension tests. Version differences do not imply installation origin.

**Next step:** No remaining work for 051. The standalone canvas suite has two unrelated missing-group selector expectation failures; no canvas renderer changes were made as part of this update work.

## Work Log

### 2026-10-26 - Version Review and Safe Update Actions

**By:** Kilo

**Actions:**

- Resumed the partial implementation and removed inferred source provenance from version mismatches
- Added explicit skill/canvas version review commands and metadata-only checks of the configured source
- Distinguished installed versions, bundles included in the extension, and GitHub/main defaults
- Removed activation-time canvas overwrites and added explicit replacement confirmation
- Added bounded network reads and download preflight before source files are replaced
- Verified: 215 extension tests pass; compilation and lint pass with the existing Biome schema-version informational notice
- Runtime dependency audit reports zero vulnerabilities and VSIX packaging succeeds
- Standalone canvas tests: 25 pass and 2 fail on existing empty/undefined-group selector expectations, outside this change; left untouched
- Tests use fixtures and injected responses; no real installed skill/canvas was replaced for verification

### 2026-10-26 - Implemented

**By:** Kilo

**Actions:**

- Added `agendo.canvasUpdateSource` setting (default: GitHub raw URL for canvas files)
- Added `fromSource` flag to `CanvasStatus` interface to distinguish source-updated from bundled
- Added `updateFromSource()` method to `CanvasManager` for fetching canvas files from GitHub
- Added `UpdateCanvas` command and its loading variant
- Registered `UpdateCanvas` command with proper busy indicator and success/error messaging
- Created `promptForCanvasUpdate()` in extension.ts, called alongside skill update check on activation
- Updated canvas tree item to show `(Source)` suffix and distinguish newer-than-bundled from needing-update
- Refactored `EnableSkill` command to be skill-only, removing implicit canvas install behavior
- Exported `fetchText` from skillManager.ts for reuse by CanvasManager
- All 194 tests pass

### 2026-10-26 - Created

**By:** Kilo

**Actions:**

- Created todo based on user feedback about canvas updates and notification UX
- Identified need for clearer version source distinctions in update notifications
