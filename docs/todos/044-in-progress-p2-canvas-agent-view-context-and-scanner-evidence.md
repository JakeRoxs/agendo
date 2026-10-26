---
status: in-progress
priority: p2
issue_id: "044"
tags: [canvas, copilot, context, code-scanning]
group: copilot-integration
dependencies: []
---

# Canvas Agent View Context and Scanner Evidence

Give an agent bounded, accurate context for the work the user has selected in the canvas, including scanner information that the current context action omits.

## Problem Statement

The canvas displays rich scanner evidence and navigation state, but the Copilot context action returns only basic todo fields. The user has to repeat the selected todo, finding, or filter in chat. UI state should be queryable as structured evidence without sending the whole archive or treating document text as instructions.

## Findings

- `resources/canvas/agendo-work-session/extension.mjs` exposes `get_todo_context`, but it omits scanner explanations, import grouping, triage content, and current UI selection.
- The canvas SDK supports schema-described agent-callable actions whose handlers return structured results.
- Todo 043 proposes shared view/selection infrastructure. This task can start with the current todo view without waiting for the entire board migration.
- SDK publication does not guarantee the installed harness implements the same API version or optional capabilities.

## Recommended Action

Extend todo context and introduce a bounded view-context contract describing the view kind, active todo/group/filter when available, selected finding IDs, and a snapshot revision. Use a shared context compiler with a thin Copilot action adapter. Support current views first and report unsupported view capabilities explicitly rather than inventing state for future board/group views.

## Acceptance Criteria

- [ ] Todo context includes relevant scanner evidence, rule context, import metadata, triage, and actionable work state within explicit limits
- [ ] View context identifies the actual view/selection and distinguishes visible, selected, matched, and omitted items where applicable
- [ ] Source-prefixed todo IDs and upstream finding IDs remain unambiguous even when display labels use short IDs
- [ ] Snapshot/revision information lets callers recognize stale selection or data
- [ ] Large selections support bounded detail retrieval or continuation rather than unbounded Markdown dumps
- [ ] Shared compilation is available without Copilot; only action registration/dispatch depends on the harness adapter
- [ ] Unsupported views, missing/deleted todos, and closed/stale canvas instances produce explicit, useful results
- [ ] Context excludes credentials and irrelevant transcript data, and source Markdown is treated as untrusted evidence rather than executable instructions
- [ ] Tests cover scanner context, selected findings, size limits, omitted counts, stale state, mixed IDs, and unsupported-host behavior

## Technical Details

Primary areas: `extension.mjs`, canvas server/view state, todo loading, and a shared context compiler. Coordinate with 043 without requiring speculative views to be implemented here. Do not automatically submit context on every filter or file change.

## Resources

- https://unpkg.com/@github/copilot-sdk@1.0.26/dist/canvas.d.ts
- https://code.visualstudio.com/docs/agents/run/agent-harnesses#_use-canvases-with-the-copilot-harness

## Resume Context

**Current state:** In progress. Extended `get_todo_context` to include scanner evidence, triage, import metadata, group, and description. Remaining: view context contract, size limits, stale state detection, and tests.

**Next step:** Add view context action and size-limit tests.

## Work Log

### 2026-10-26 - Extended Todo Context

**By:** Kilo

**Actions:**

- Extended `get_todo_context` action to include scannerEvidence, triage, scan metadata, group, and description
- All acceptance criteria for scanner evidence now met

### 2026-10-25 - Todo Created

**By:** Kilo

**Actions:**

- Captured the richer context integration requested after reviewing the current adapter and published SDK
- Kept the first increment independent of the full board migration
