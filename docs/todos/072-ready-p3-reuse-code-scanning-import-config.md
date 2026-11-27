---
status: ready
priority: p3
issue_id: "072"
tags: [code-scanning, import, settings, ux]
dependencies: []
---

# Reuse the Previous Code-Scanning Import Configuration

Let users repeat a scanner import using the configuration they already selected for the project instead of stepping through the same prompts each time.

## Problem Statement

Re-importing code-scanning findings requires users to confirm several options again, even when they want to reuse the same source, branch, grouping, and project configuration selected previously.

## Findings

- The import flow prompts for source, branch, and grouping on each run.
- Some SonarQube connection/project values are saved, but there is no complete previous-import configuration with a quick reuse path.
- No existing todo tracks reuse of the previous import choices.

## Acceptance Criteria

- [x] Offer a clear “use last configuration” path for a repeated scanner import.
- [x] Reuse the relevant previous choices (scanner source, branch where applicable, grouping, and scanner project/connection settings) in the appropriate project context.
- [x] Allow users to re-open prompts and change any saved choice.
- [x] Handle missing, invalid, or changed configuration by prompting for the required values rather than failing silently.
- [x] Keep configuration scoped appropriately to the workspace/todo root and avoid exposing credentials in persisted settings.
- [x] Add tests for first import, reuse, re-prompt/edit, and invalid or unavailable saved choices.

## Resume Context

**Current state:** Reusable scanner-import choices are implemented and tested, scoped by canonical todo-root identity; credentials remain in VS Code secure storage only. Invalid/stale choices fall back to prompts.

**Next step:** Verify the reuse/edit experience in the VS Code import flow, then complete the todo.

## Work Log

### 2026-11-14 - Todo Created

**By:** Agent

**Actions:**

- Compared the request with current scanner import prompts and settings.
- Recorded the missing repeat-import shortcut and its configuration-scope considerations.

**Learnings:**

- Saved scanner configuration must not include credentials and should be scoped to the relevant project context.

### 2026-11-26 - Implement Repeat Import Configuration

**By:** Kilo

**Actions:**

- Started implementation after inspecting scanner import flow and existing folder-scoped SonarQube settings.
- Added a workspaceState-backed config keyed by the resolved root path; it stores source, branch, grouping, and Sonar server/project/auth mode only.
- Added “Use last configuration” / “Choose configuration” flow, live branch validation with picker fallback, and coverage for first-run/edit/reuse/invalid config.
- Validation: `npm run compile`; focused test command `npm test -- --grep "scanner selection is per invocation"` (562 passing in extension suite); `git diff --check`.
- Follow-up review hardened Sonar validation: invalid URLs/empty projects are discarded, and a changed Sonar CLI server triggers fresh authentication/settings prompts. Persistence keys use the root registry's canonical ID (with normalized-path fallback).
- Extended command coverage for stale branch fallback and isolation across two workspace roots. Added a Sonar direct-token reuse test that verifies the sentinel token remains only in secure storage and is absent from workspace state.
- Final validation: `npm run compile` and `npm test` passed (563 tests); `git diff --check` passed.

**Learnings:**

- Reuse should retain only scanner source, branch, grouping, and non-secret SonarQube server/project/auth mode; token retrieval remains through existing secret storage.

### 2026-11-26 - Verify Sonar reuse and credential isolation

**By:** Kilo

**Actions:**

- Confirmed Sonar server/project/auth mode are reused and direct-token credentials are retrieved through the secure secret store, not persisted in workspace state.
- Verified tests for first import, edit, reuse, invalid stored data, stale branch fallback, and separate root state.
- Ran `npm run compile`, `npm test` (563 passing), and `git diff --check` (all passed).
- Moved todo 072 to `ready` with filename/frontmatter synchronized.

**Learnings:**

- Branches must be fetched again before reuse; a missing saved branch falls back to the current branch picker. Credentials remain separate from reusable non-secret choices.
