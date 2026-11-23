---
status: pending
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

- `agendo.codeScanning.enabled` is a persistent setting and the import command currently prompts for and saves it.
- Existing scanner todos should remain visible independently of whether a new scanner import is selected.
- Todo 066 mentions consolidating the code-scanning toggle, but does not cover changing its opt-in semantics.

## Acceptance Criteria

- [ ] Starting a code-scanning import offers the scanner workflow without requiring a persistent enable/disable state.
- [ ] Choosing not to import code-scanning findings leaves scanner import inactive without changing a persistent enabled flag.
- [ ] Existing CodeQL and SonarQube todos remain visible regardless of whether the user starts a scanner import.
- [ ] Remove or migrate the obsolete setting and its configuration/UI references consistently.
- [ ] Add or update tests for choosing and declining a scanner import, including verification that the choice is not persisted as an enabled state.

## Resume Context

**Current state:** Pending triage; existing import flow persists a code-scanning enabled setting.

**Next step:** Decide the per-invocation UX and how to retire the persistent setting compatibly.

## Work Log

### 2026-11-14 - Todo Created

**By:** Agent

**Actions:**

- Compared the request with existing settings and code-scanning todos.
- Recorded the gap: existing setting-consolidation work does not address per-use opt-in behavior.

**Learnings:**

- Scanner todo visibility is separate from permission to perform a new import.
