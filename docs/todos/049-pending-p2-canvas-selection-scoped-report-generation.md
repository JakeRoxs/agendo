---
status: pending
priority: p2
issue_id: "049"
tags: [canvas, copilot, reporting, context, ux]
group: copilot-integration
dependencies: ["041", "045"]
---

# Canvas Selection-Scoped Report Generation

Let users preview a reporting selection in the canvas, request agent synthesis, and inspect the resulting report alongside its supporting todos.

## Problem Statement

Todo 041 proposes bounded accomplishments packets, but users also need a natural way to select scope, inspect what will be included, request synthesis, and return from a report claim to its evidence. This should be a focused integration of the reporting compiler and contextual request flow, not a second reporting engine or a new model-provider dependency.

## Findings

- Todo 041 owns selection/date semantics, bounded evidence compilation, batching, and report provenance.
- Todo 045 owns explicit user-triggered requests to the owning session and Copy Context fallback.
- Session APIs support sending requests and receiving responses/events, subject to installed host/runtime support.
- Reporting context must remain bounded and disclose exclusions; a completion label alone is not proof of a verified delivered outcome.

## Recommended Action

Add a report flow for the current group/filter or an explicit reporting period. Preview the selected evidence packet, let the user initiate synthesis, and display the report with source references and coverage information. Reuse the compiler from 041 and the request bridge from 045. Keep generation, saving/exporting, and todo mutation as separate user decisions.

## Acceptance Criteria

- [ ] A report can start from an explicit canvas selection/group/filter or a chosen reporting period without silently expanding scope
- [ ] The preview shows matched/included/omitted counts, date uncertainty, and applicable size/batch limits before submission
- [ ] Agent synthesis uses 041's bounded packets and preserves source references and coverage across batches
- [ ] Direct generation uses the supported owning-session bridge; unsupported hosts offer Copy Context rather than creating another provider integration
- [ ] Busy, queued, failed, partial, and completed requests have clear states and are not confused with completed todo work
- [ ] Report claims link back to supporting todos/evidence while preserving the reporting selection and navigation context
- [ ] Reports distinguish recorded completion, verification evidence, cancellations, and overlapping scanner work according to 041
- [ ] Saving/exporting is explicit and does not overwrite an existing report or change todo lifecycle as a side effect of generation
- [ ] No continuous regeneration or unbounded sequence of agent requests is triggered by filters, file changes, or view rendering
- [ ] Tests cover scope retention, bounded batches, unsupported hosts, request recovery, source links, and read-only behavior

## Technical Details

Primary areas: reporting selection/preview UI, 041's context compiler, 045's host request adapter, and a report-result view within shared navigation where available. Reuse 043's workspace infrastructure as it develops, but do not duplicate packet compilation or force the full board migration before an initial report handoff works.

## Resources

- https://docs.github.com/en/copilot/how-tos/github-copilot-app/working-with-canvas-extensions
- https://unpkg.com/@github/copilot-sdk@1.0.26/dist/session.d.ts

## Resume Context

**Current state:** Pending. No canvas reporting controls or agent-generated report view have been implemented.

**Next step:** After 041 and 045 provide the compiler/request contracts, prototype one selected-group report with preview, source links, and Copy Context fallback.

## Work Log

### 2026-10-25 - Todo Created

**By:** Kilo

**Actions:**

- Captured the canvas-to-agent reporting integration separately from the evidence compiler in 041
- Reused the explicit request/fallback design from 045 rather than adding a reporting-specific provider client
