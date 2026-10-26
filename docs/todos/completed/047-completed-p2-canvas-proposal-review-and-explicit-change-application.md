---
status: completed
priority: p2
issue_id: "047"
tags: [canvas, copilot, review, approvals, reconciliation]
group: copilot-integration
dependencies: ["037", "038", "044"]
---

# Canvas Proposal Review and Explicit Change Application

Show proposed finding/checklist/work-plan changes as a reviewable artifact before applying selected changes through normal Agendo operations.

## Problem Statement

An agent can suggest changes in chat, but scanner reconciliation and checklist edits need a clear distinction between proposal and application. A review surface should show exactly what changes, retain supporting evidence, and reject stale edits rather than silently overwriting work modified since the proposal was generated.

## Findings

- Todos 037 and 038 define refresh reconciliation and finding-level local progress.
- Todo 044 supplies bounded, revision-aware context for generating grounded proposals.
- Canvas actions can return structured proposal data. A proposal UI and its apply semantics are Agendo features, not automatic built-in canvas behavior.
- Published session APIs expose confirmation/selection UI only when the host supports elicitation; this is not a replacement for permission checks.

## Recommended Action

Use typed proposals for a small set of Agendo changes, such as new finding criteria, updated locations, dispositions, and additional related-file work. Show before/after values and evidence, let the user select changes, then validate the original snapshot and apply through shared operations. Keep a proposal read-only until explicitly accepted. Avoid a generic executable patch or command interface.

## Acceptance Criteria

- [x] Proposals identify the target workspace/todo/finding, affected fields, before/after values, rationale, and supporting evidence
- [x] Generated proposals are distinguishable from already-applied work and remain read-only until explicitly accepted
- [x] Users can review and apply or reject selected changes without implicitly accepting the whole proposal
- [x] Snapshot/revision checks reject stale proposals and protect dirty documents or concurrently edited work
- [x] Applied changes use validated shared Agendo operations and preserve unrelated notes, metadata, and criteria
- [x] Scanner absence, local completion, and remote verification remain distinct; proposals do not silently complete, reopen, merge, or repartition todos
- [x] Canvas confirmation and optional capability-checked session dialogs do not bypass host/tool permissions
- [x] Unsupported hosts can inspect the proposal and use an appropriate manual fallback rather than pretending application succeeded
- [x] Inputs are treated as data, with no arbitrary shell execution, code evaluation, or unvalidated filesystem patching
- [x] Tests cover partial selection, rejection, stale snapshots, invalid targets, concurrent edits, failed application, and permission/capability boundaries

## Technical Details

Primary areas: proposal schemas/state, canvas review UI, the reconciliation/checklist contracts from 037/038, and optional Copilot action/dialog adapters. Start with one bounded proposal type and reuse existing mutation safeguards. A supporting local file change is not automatically authorized merely because the proposal includes it.

The implemented first type changes only the `met` value of existing acceptance criteria. Proposals capture the full todo ID, original criterion text, workspace, file path, exact content hash, before/after values, rationale, and evidence. Generic file patches, lifecycle changes, scanner evidence updates, and additional related-file edits are not accepted. Proposals and decisions are session-local; only explicitly applied checkbox updates persist.

## Resources

- https://unpkg.com/@github/copilot-sdk@1.0.26/dist/canvas.d.ts
- https://unpkg.com/@github/copilot-sdk@1.0.26/dist/session.d.ts

## Resume Context

**Current state:** Complete for the intentionally bounded existing-criterion checkbox proposal type. Verified by model, protected HTTP, browser, and extension regressions, including explicit native-guarded application and unsupported-host copy fallback. Live Copilot action discovery was not exercised; creation/import and application are independently usable without Copilot.

**Next step:** No remaining work for this bounded type. Any new proposal type must separately define its permissions, preview semantics, and revision checks before adding mutation support.

## Work Log

### 2026-10-26 - Bounded Criteria Proposal Review

**By:** Kilo

**Actions:**

- Added a bounded in-memory proposal store with strict input validation and defensive result copies
- Added read-only propose_criteria and get_proposals canvas actions; no agent-callable apply action exists
- Added native proposal import/review with before/after values, evidence, explicit selection and confirmation, partial application, rejection, and Copy Proposal/manual clipboard fallback
- Protected HTTP actions bind each request to its active todo and canvas instance
- Application requires the native assertWritable guard and never falls back to direct writes after a guard refusal
- Reused a shared atomic criterion operation with exact revision/path checks before commit, random exclusive temporary files, preserved file mode and line endings, and no lifecycle changes
- Unified criterion indexing so managed scanner evidence and fenced examples cannot be mistaken for editable checklist items
- Partial application records the exact revision written by that operation; later external changes remain stale rather than being silently rebased
- Bounded pending work and resolved history to 20 proposals per store, with no silent eviction of pending proposals
- Browser checks passed for import, explicit confirmation, partial apply/reject, mobile layout, and unsupported-host manual copy using isolated fixtures and a mocked native guard
- Final verification passed: 321 extension tests, 183 canvas/request/proposal tests, lint, bundle, syntax checks, and git diff --check
- Additional regressions exercise real pending-guard contention, the 20-proposal capacity limit, atomic rename failure/cleanup, mixed EOL preservation, and protected scanner/fenced example content
- Independent review found no remaining implementation bugs; earlier test-review observations were resolved in the final passing test run
- Canvas version is 0.1.8; new proposal module is included in install/update file lists
- Todo 045 remains ready and is intentionally left for the user's later Copilot verification

### 2026-10-25 - Todo Created

**By:** Kilo

**Actions:**

- Captured visual proposal review as a collaboration feature distinct from raw agent mutation
- Linked the UI to scanner reconciliation and stable checklist identities
