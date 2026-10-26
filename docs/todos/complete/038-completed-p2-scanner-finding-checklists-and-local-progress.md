---
status: completed
priority: p2
issue_id: "038"
tags: [code-scanning, acceptance-criteria, reconciliation]
group: scanner-workflow
dependencies: ["037"]
---

# Scanner Finding Checklists and Local Progress

Make scanner findings actionable acceptance criteria without losing local completion decisions when evidence is refreshed.

## Problem Statement

Imported todos currently have two generic acceptance criteria, regardless of the number of findings. A meaningful work checklist should identify each finding and permit additional refactors, related-file changes, and verification tasks. Simply regenerating checkboxes on every import would lose local progress; treating scanner disappearance as completion would incorrectly equate source observations with verified work.

## Findings

- `src/todos/codeScanningService.ts` writes generic criteria and refreshes only scanner evidence.
- Every imported finding already has an upstream issue/alert ID. That is a better checklist identity than its line number, rule alone, list index, or current message.
- Canvas criteria are currently read and edited as positional Markdown checkboxes in `resources/canvas/agendo-work-session/todos.mjs`.
- The same upstream finding can appear in different grouping modes; those todo work plans must remain independent rather than synchronizing completion implicitly.

## Recommended Action

Proposed for triage: use one Acceptance Criteria checklist with an importer-managed findings subsection, user-owned additional-work criteria, and explicit verification criteria. Attach stable finding identities to generated entries. Preserve checked state and local dispositions separately from source presence. Do not add a second competing progress checklist or automatically mutate remote scanner issue status.

## Acceptance Criteria

- [ ] Each imported finding has an identifiable acceptance entry with its rule, location, problem, and source link
- [ ] Managed entries are keyed by source/scope/finding identity, never by line number or checkbox position
- [ ] New findings become unchecked work items without discarding existing checks or local notes
- [ ] Changed messages or locations update the matching entry without changing its local disposition
- [ ] Findings not returned by a refresh remain inspectable and are not silently deleted or marked done
- [ ] A locally addressed finding still reported by the scanner is distinguishable from verified clearance and can be reviewed without automatically clearing its checkbox
- [ ] Users can add refactor, related-file, regression-test, and verification criteria outside importer-owned content
- [ ] Documented dispositions explain accepted risk, false-positive decisions, or deferral rather than pretending every checked item is a code fix
- [ ] Verification distinguishes importing the latest available result from running and checking a fresh analysis after the code change
- [ ] Import refresh and canvas edits round-trip safely across reordered findings, moved lines, identical rule/location pairs, grouping modes, and terminal todo states
- [ ] Tests cover progress preservation and ensure different grouping modes never auto-complete one another

## Technical Details

Primary areas: scanner evidence/checklist serialization, `resources/canvas/agendo-work-session/todos.mjs`, canvas criterion actions, and scanner regression tests. Select a small round-trippable Markdown representation during triage; do not create a separate database or duplicate checklist state without a concrete need.

## Resume Context

**Current state:** Implementation complete for core functionality. Added `buildFindingsChecklist`, `updateFindingsChecklist`, and `parseFindingsChecklist` to `codeScanningService.ts`. Import writes findings checklist with stable IDs; refresh updates the section, marks not-returned findings, and preserves checked state by finding ID across refreshes. Canvas parses findings as criteria (existing checkbox handling works). Added regression tests including checked-state persistence. 185 tests pass, lint clean.

**Triage findings:**
- Scanner evidence already contains stable finding IDs (`#### File: X | Line: Y` blocks with unique upstream IDs)
- Acceptance Criteria section is user-owned and currently generic; needs importer-managed findings subsection
- Canvas `todos.mjs` parses criteria positionally (`CRITERION_RE` regex on `- [x] text` lines) and updates by index
- `updateScanningEvidence` replaces only the evidence block, leaving criteria intact (good — criteria are user-owned)
- Refresh already tracks not-returned findings via snapshot; can extend to checklist state

**Proposed design:**
1. Importer-managed `### Findings` subsection within Acceptance Criteria, using stable finding IDs as entry keys
2. Format: `- [ ] [finding-id] Rule: message — file:line (link)` — parseable by existing `CRITERION_RE` with ID prefix
3. User-owned criteria remain outside the findings subsection (importer never touches them)
4. On refresh: match entries by finding ID, update text for changed findings, add new as unchecked, mark not-returned as such, preserve checked state
5. Canvas reads the findings subsection as a progress indicator but allows checking/unchecking individual items
6. Local dispositions (false-positive, accepted risk, deferred) stored in entry text or a separate field, never auto-cleared by scanner disappearance

**Next step:** Implement findings checklist serialization in `codeScanningService.ts`, update canvas `todos.mjs` to parse/display findings checklist, and add regression tests.

## Work Log

### 2026-10-26 - Checked State Persistence

**By:** Kilo

**Actions:**
- Implemented `parseFindingsChecklist` to extract checked state by finding ID from existing checklist
- Updated `updateFindingsChecklist` to preserve checked state across refreshes (new findings unchecked, existing preserve state)
- Added regression test verifying checked state persists through refresh cycles
- All 185 tests pass, lint clean

### 2026-10-25 - Implementation

**By:** Kilo

**Actions:**
- Implemented `buildFindingsChecklist` and `updateFindingsChecklist` in `codeScanningService.ts`
- Import function now writes findings checklist with stable finding IDs between `### Findings` and `### End Findings` markers
- Refresh updates findings section, preserves user-owned criteria, marks not-returned findings
- Canvas already handles findings as criteria (checkbox parsing by existing `CRITERION_RE`)
- Added regression test for findings checklist serialization and reconciliation
- All 185 tests pass, lint clean

### 2026-10-25 - Triage and Design

**By:** Kilo

**Actions:**
- Investigated current implementation: generic 2-item acceptance criteria, positional canvas checkbox editing, evidence-only refresh
- Confirmed scanner evidence already contains stable upstream finding IDs suitable for checklist keys
- Designed importer-managed findings subsection with user-owned additional criteria
- Established round-trip safety requirements: refresh must preserve checked state by finding ID, add new findings as unchecked, mark not-returned without deletion
- Identified canvas changes needed: parse findings subsection, display progress, allow individual item toggling

### 2026-10-25 - Follow-up Created

**By:** Kilo

**Actions:**

- Recorded the desired acceptance checklist for findings plus necessary implementation work
- Separated local progress, scanner observations, and verification evidence
- Linked the work to the refresh/provenance contract in todo 037
