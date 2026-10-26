---
status: completed
priority: p2
issue_id: "037"
tags: [code-scanning, import, reconciliation]
group: scanner-workflow
dependencies: []
---

# Scanner Refresh Provenance and Change Summary

Make refresh a clearly identified operation on an existing import scope, with a useful summary of what changed instead of an implicit merge of todo documents.

## Problem Statement

The importer supports file, rule, and individual-finding grouping, but the user cannot easily distinguish refreshing an existing import from creating another view of the same findings. It reports created/updated todo counts without explaining added findings, changed locations, or findings absent from the latest result. Source observations need to be reconciled without taking ownership of the user's work plan.

## Findings

- `src/todos/codeScanningService.ts` matches `scan_identity` and replaces only the marked Scanner Evidence block. It does not merge notes, acceptance criteria, or lifecycle state.
- New todos record `scan_source`, `scan_grouping`, and `scan_target`; the repository/project scope is included in the identity hash but is not stored as explicit provenance.
- `src/commandRegistration.ts` warns in the grouping picker that changing grouping creates separate todos. There is no targeted refresh action using the selected todo's provenance.
- Source APIs currently fetch open/unresolved findings. Absence from that result is not proof that a local change resolved an issue.
- Importing retrieves existing scanner results; it does not run a new SonarQube analysis or CodeQL scan.

## Recommended Action

Approved for implementation in the user's methodical triage/investigation sequence: define the refresh unit as source, repository/project scope, grouping, and target. Store sufficient provenance to refresh it explicitly. Reconcile source observations by stable finding ID, not Markdown prose. Report changes after routine non-destructive refresh; reserve confirmation for any future operation that would discard or repartition user-owned work. Keep different grouping modes independent. Finding checklists and local dispositions remain in todo 038.

## Acceptance Criteria

- [ ] Explicit provenance identifies the source, repository/project scope, grouping, and target without storing credentials
- [ ] A selected imported todo can request a refresh of its existing scope without silently switching grouping
- [ ] Refresh reports new, changed, unchanged, and no-longer-returned findings as well as created/updated todo counts
- [ ] Missing results are described as not returned in the latest successful result, not automatically resolved or completed
- [ ] Failed, partial, mismatched-scope, or disconnected fetches do not become a successful reconciliation baseline
- [ ] Switching grouping is visibly a separate import, with no automatic merging, deletion, cross-group completion, or lifecycle changes
- [ ] Notes, manually authored criteria, dependencies, priority, and lifecycle remain user-owned; dirty documents remain protected
- [ ] Changes discovered on ready or completed todos are surfaced for review without silently reopening or hiding new work
- [ ] Tests cover repeated refresh, stale results, scope/grouping separation, dirty documents, and terminal todos

## Technical Details

Primary areas: `src/todos/codeScanningService.ts`, `src/commandRegistration.ts`, scanner metadata, and `src/test/codeScanning.test.ts`. Expose provenance for the canvas follow-up in todo 039. Do not introduce a general-purpose document merge engine or a migration framework for this new feature.

## Resume Context

**Current state:** Complete. Implemented snapshot/provenance model (`src/todos/scanningSnapshot.ts`), targeted refresh with provenance validation, finding-level change accounting (added/changed/unchanged/not returned), review-required warnings without lifecycle changes, and full test coverage (34 snapshot tests, 16 refresh command tests). All 184 tests pass, lint clean, npm audit clean, packaging verified.

**Next step:** None. Move to todo 038 (finding checklists and local progress).

## Work Log

### 2026-10-25 - Follow-up Created

**By:** Kilo

**Actions:**

- Inspected the existing identity match and evidence-only update path
- Recorded the user's questions about merging, grouping visibility, and re-import behavior
- Kept the proposal pending rather than changing lifecycle or import semantics during discussion

### 2026-10-25 - Triage and Investigation Started

**By:** Kilo

**Actions:**

- Started 037 as the first bounded implementation slice after the user's approval to proceed methodically
- Confirmed current imports lack explicit scope and a machine-readable finding baseline, and omit groups with zero current findings
- Kept checklist synchronization, new canvas pills, and broader board integration out of this slice
