---
status: completed
priority: p2
issue_id: "039"
tags: [canvas, code-scanning, ux, lifecycle]
group: scanner-workflow
dependencies: ["037", "038"]
---

# Scanner Canvas Import Badges and Workflow Guidance

Show how a scanner todo was imported and make its canvas reflect the actual investigation, implementation, and verification workflow.

## Problem Statement

The source, status, and priority pills do not identify whether a todo represents a file, rule, or individual issue. The always-visible pending banner occupies work space, requires formal triage notes, and suggests moving to ready after triage, while investigation should normally happen in-progress and ready should mean implementation is believed finished. Finding progress and scope need clearer presentation, with generic lifecycle guidance available on demand rather than dominating the page.

## Findings

- The canvas metadata row in `resources/canvas/agendo-work-session/page.mjs` shows source, status, and priority only.
- Todos also support a user-facing `group` field, which is distinct from the scanner's `scan_grouping` import mode and is not currently represented as a canvas pill.
- The existing Needs triage banner appears only for pending todos, not in-progress todos, but its suggested next steps skip in-progress.
- `resources/canvas/agendo-work-session/todos.mjs` does not currently expose import grouping/provenance to the page model.
- Scanner findings and rule context already have collapsible file/type navigation; the new workflow should build on that instead of duplicating it.
- Todo 036 covers the generic status-aware canvas. Group pills and on-demand status help can apply to ordinary and scanner todos; import provenance and finding-progress presentation remain scanner-specific. This does not change todo 036's lifecycle.

## Recommended Action

Proposed for triage: extend the existing source/status/priority row with an optional Group pill and a distinct File import, Rule import, or Issue import pill. The agreed order for the current indicators is source, status, priority, optional group, then optional import grouping. This is a current layout preference, not a requirement that import grouping remain last when future indicators are added. Label the todo group explicitly, for example Group: scanner-workflow, to distinguish it from the import mode. The Group pill applies to ordinary and scanner todos when their `group` field is nonempty; omit it otherwise. Use tooltip/detail context for the import scope, target, and refresh freshness. Replace compulsory triage wording with status-appropriate next actions. Pending means not started; in-progress includes investigation and implementation; ready means implementation is believed done and awaits verification; complete requires verified criteria.

Replace the persistent Needs triage banner and empty-triage instructional content with on-demand lifecycle help associated with the status control. A small help affordance can show the current state's meaning and a generic next step on hover/focus, with click/tap and keyboard access rather than hover-only behavior. Keep actual triage notes, Resume Context, blockers, errors, and verification discrepancies available as work content; do not move actionable task-specific information into a tooltip.

## Proposed Lifecycle Help

| State | Meaning | Generic next step |
| --- | --- | --- |
| pending | Not started | Review the scope and evidence; move to in-progress when beginning investigation or implementation |
| in-progress | Investigation or implementation is underway | Work through findings and additional criteria; record relevant decisions and verification needs |
| ready | Implementation is believed finished and needs verification | Check criteria, tests, and a fresh analysis where applicable; complete only when verified |
| complete | Work is recorded as finished and verified | Review its evidence; explicitly reopen if further work is needed |
| backlogged | Work is deferred | Revisit priority and scope before returning it to active work |
| cancelled | Work is no longer being pursued | Review the reason and effects on related work before explicitly reopening |

These are generic explanations, not inferred task-specific instructions or automatic transitions. Actual completion/verification discrepancies must still be shown separately.

## Acceptance Criteria

- [ ] Imported todos show an unambiguous grouping pill without repeating the sq/cql source label
- [ ] Current indicators appear in the agreed order: source, status, priority, optional group, optional import grouping; this does not impose a permanent last-position rule on import grouping
- [ ] Ordinary and scanner todos with a nonempty `group` show a clearly labeled Group pill; missing/empty groups produce no placeholder
- [ ] The Group pill reads the todo's `group` field and is never confused with or inferred from `scan_grouping`
- [ ] Scope, target, and observation freshness are available without exposing credentials or implying that refresh runs a new scan
- [ ] Missing provenance is not guessed from a sanitized filename or misleadingly labeled as file-based
- [ ] Pending guidance offers review/start work rather than demanding multiple proposed solutions for a straightforward fix
- [ ] Generic lifecycle guidance is hidden by default; no persistent Needs triage banner or empty-triage instruction panel consumes the top of the canvas
- [ ] Every lifecycle state has a concise explanation and generic next step available from help associated with the status control
- [ ] Help supports hover/focus and deliberate keyboard/click/tap access, has an accessible label/association, and can be dismissed without changing status
- [ ] Help content follows the current status after navigation or a status change and does not interfere with operating the status selector
- [ ] Existing triage notes and task-specific Resume Context are preserved; actionable blockers, errors, and verification warnings are not hidden inside generic help
- [ ] Starting investigation leads to in-progress; completing triage alone never implies ready or complete
- [ ] In-progress layout prioritizes the actionable finding/additional-work checklist and necessary file context
- [ ] Ready layout emphasizes tests, a fresh scanner result where applicable, and unresolved discrepancies
- [ ] New or still-reported findings on ready/complete work are visible review signals, not automatic status transitions
- [ ] Local addressed/dispositioned work is visually distinguishable from scanner-verified clearance
- [ ] Tests cover todo group and import-grouping pills, their order, empty groups, ordinary/scanner todos, all six states' help, default-hidden content, keyboard/touch interaction, unknown metadata, checklist state, and metadata independence

## Technical Details

Primary areas: canvas todo loading, `page.mjs`, canvas styles/scripts, and regression tests. Keep the existing status names and authoritative filename/folder rules. Do not introduce a new triage-only lifecycle state or change the generic workflow for ordinary todos without separate justification.

## Resume Context

**Current state:** Scanner-specific presentation proposal captured; current banner and pills are unchanged.

**Next step:** Use the provenance and checklist contracts from todos 037 and 038 to define the canvas model and replace the misleading pending guidance.

## Work Log

### 2026-10-25 - Follow-up Created

**By:** Kilo

**Actions:**

- Confirmed the pending-only banner and identified the incorrect suggestion to move to ready after triage
- Recorded the requested import-grouping pill and status-appropriate work presentation
- Scoped this separately from the existing generic canvas work in todo 036

### 2026-10-25 - Indicator Order Clarified

**By:** Kilo

**Actions:**

- Recorded the user's preference to append the import-grouping indicator last, preserving the existing source/status/priority order

### 2026-10-25 - Todo Group Pill Added to Scope

**By:** Kilo

**Actions:**

- Added an optional Group pill for ordinary and scanner todos, distinct from the import-grouping indicator
- Kept import grouping last: source, status, priority, optional group, optional import grouping

### 2026-10-25 - Ordering Preference Scope Clarified

**By:** Kilo

**Actions:**

- Clarified that the ordering preference applies to the current indicators, not a permanent requirement for import grouping to stay last
- Retained Group before import grouping for the currently proposed layout

### 2026-10-25 - On-Demand Lifecycle Help Requested

**By:** Kilo

**Actions:**

- Replaced the proposed always-visible pending guidance with default-hidden status help for all six lifecycle states
- Added concise meanings and generic next steps, with keyboard/touch access rather than a hover-only requirement
- Kept task-specific notes, blockers, and verification signals separate from generic help

### 2026-10-26 - Implemented and Verified

**By:** Kilo

**Actions:**

- Added Group pill and import-grouping pill (File/Rule/Issue import) to canvas metadata row
- Removed persistent "Needs triage" banner and empty-triage instructional content
- Added on-demand lifecycle help associated with status control for all six states
- Added scan provenance parsing (group, scan_source, scan_scope, scan_grouping, scan_target, scan_refreshed_at, scan_review_required) to canvas todo loader
- Updated extension tests to match new canvas behavior
- Verified: 185 extension tests passing, 20 canvas tests passing, lint clean, 0 audit vulnerabilities, vsix packaged
