---
status: pending
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

- [ ] Proposals identify the target workspace/todo/finding, affected fields, before/after values, rationale, and supporting evidence
- [ ] Generated proposals are distinguishable from already-applied work and remain read-only until explicitly accepted
- [ ] Users can review and apply or reject selected changes without implicitly accepting the whole proposal
- [ ] Snapshot/revision checks reject stale proposals and protect dirty documents or concurrently edited work
- [ ] Applied changes use validated shared Agendo operations and preserve unrelated notes, metadata, and criteria
- [ ] Scanner absence, local completion, and remote verification remain distinct; proposals do not silently complete, reopen, merge, or repartition todos
- [ ] Canvas confirmation and optional capability-checked session dialogs do not bypass host/tool permissions
- [ ] Unsupported hosts can inspect the proposal and use an appropriate manual fallback rather than pretending application succeeded
- [ ] Inputs are treated as data, with no arbitrary shell execution, code evaluation, or unvalidated filesystem patching
- [ ] Tests cover partial selection, rejection, stale snapshots, invalid targets, concurrent edits, failed application, and permission/capability boundaries

## Technical Details

Primary areas: proposal schemas/state, canvas review UI, the reconciliation/checklist contracts from 037/038, and optional Copilot action/dialog adapters. Start with one bounded proposal type and reuse existing mutation safeguards. A supporting local file change is not automatically authorized merely because the proposal includes it.

## Resources

- https://unpkg.com/@github/copilot-sdk@1.0.26/dist/canvas.d.ts
- https://unpkg.com/@github/copilot-sdk@1.0.26/dist/session.d.ts

## Resume Context

**Current state:** Pending. No proposal review or apply protocol has been implemented.

**Next step:** Choose one finding/checklist change from 037/038 and define a revision-checked proposal with a non-mutating preview before building apply actions.

## Work Log

### 2026-10-25 - Todo Created

**By:** Kilo

**Actions:**

- Captured visual proposal review as a collaboration feature distinct from raw agent mutation
- Linked the UI to scanner reconciliation and stable checklist identities
