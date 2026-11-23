---
status: pending
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

- [ ] Offer a clear “use last configuration” path for a repeated scanner import.
- [ ] Reuse the relevant previous choices (scanner source, branch where applicable, grouping, and scanner project/connection settings) in the appropriate project context.
- [ ] Allow users to re-open prompts and change any saved choice.
- [ ] Handle missing, invalid, or changed configuration by prompting for the required values rather than failing silently.
- [ ] Keep configuration scoped appropriately to the workspace/todo root and avoid exposing credentials in persisted settings.
- [ ] Add tests for first import, reuse, re-prompt/edit, and invalid or unavailable saved choices.

## Resume Context

**Current state:** Pending triage; some scanner settings persist, but the complete import choice set is not reusable.

**Next step:** Define which options are safe and useful to persist and how the reuse choice should appear in the import flow.

## Work Log

### 2026-11-14 - Todo Created

**By:** Agent

**Actions:**

- Compared the request with current scanner import prompts and settings.
- Recorded the missing repeat-import shortcut and its configuration-scope considerations.

**Learnings:**

- Saved scanner configuration must not include credentials and should be scoped to the relevant project context.
