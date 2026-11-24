---
status: completed
priority: p2
issue_id: "069"
tags: [code-scanning, settings, import]
dependencies: []
---

# Make Code Scanning Opt-In Per Import

Code scanning should be inactive when it is not being used and enabled for an import when the user chooses it, rather than requiring a persistent enable/disable setting.

## Problem Statement

The current import flow asks the user to enable code scanning and persists the enabled setting. This creates a separate global feature toggle for behavior that should simply be selected when needed. Users should be able to choose a scanner import when they run it without leaving code scanning persistently enabled.

## Findings

- `agendo.codeScanning.enabled` is a persistent setting and the import command currently prompts for and saves it; the user has decided this gate should be removed entirely.
- Existing scanner todos should remain visible independently of whether a new scanner import is selected.
- Todo 066 mentions consolidating the code-scanning toggle, but does not cover changing its opt-in semantics.

## Recommended Action

- Remove the enabled/disabled toggle from configuration and the Settings canvas.
- Let the import command offer CodeQL/SonarQube source selection each time it is invoked; cancellation performs no import and persists no state.
- Keep SonarQube server/project defaults and CodeQL authentication/default behavior; scanner connection settings are separate from an on/off flag.

## Acceptance Criteria

- [x] Starting a code-scanning import offers the scanner workflow without requiring a persistent enable/disable state.
- [x] Choosing not to import code-scanning findings leaves scanner import inactive without changing a persistent enabled flag.
- [x] Existing CodeQL and SonarQube todos remain visible regardless of whether the user starts a scanner import.
- [x] Remove or migrate the obsolete setting and its configuration/UI references consistently.
- [x] Add or update tests for choosing and declining a scanner import, including verification that the choice is not persisted as an enabled state.

## Resume Context

**Current state:** The persistent enable setting and import gate are removed. Imports are selected per invocation; SonarQube connection defaults, CodeQL authentication, and existing scanner todo visibility remain. Full extension and canvas tests pass.

**Next step:** None; implementation and validation are complete.

## Work Log

### 2026-11-14 - Todo Created

**By:** Agent

**Actions:**

- Compared the request with existing settings and code-scanning todos.
- Recorded the gap: existing setting-consolidation work does not address per-use opt-in behavior.

**Learnings:**

- Scanner todo visibility is separate from permission to perform a new import.

### 2026-11-24 - Start per-invocation scanner selection

**By:** Kilo

**Actions:**

- Started work after the user clarified that scanning must not have a persistent on/off setting.
- Split implementation into import-command behavior and settings/configuration cleanup while preserving SonarQube/CodeQL defaults.
- Removed the enabled setting from the extension manifest, configuration/settings services, and Settings canvas; removed the import-command gate.
- Updated the import test to verify source selection happens per invocation, source cancellation does not fetch, and no configuration setting is written.
- Updated README, todo 066, and the 0.3.3 unreleased changelog entry to describe manual per-invocation imports.
- Added regression coverage confirming the scanner picker is available without a setting and cancelling the source picker neither fetches findings nor writes settings.
- `npm test`: 465 passing, 0 failing; compile and Biome lint stages pass.
- `npm run test:canvas`: 287 passing, 0 failing.
- `git diff --check`: passes.

**Learnings:**

- Scanner selection is an action taken per import; connection/project defaults and visibility of existing scanner todos remain independent.
