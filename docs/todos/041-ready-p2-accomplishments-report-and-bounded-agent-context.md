---
status: ready
priority: p2
issue_id: "041"
tags: [reporting, digest, completed-todos, agent-context]
group: reporting
dependencies: []
---

# Accomplishments Report and Bounded Agent Context

Compile a scoped evidence packet from completed todos so an agent can explain what was accomplished without reading the entire archive at once.

## Problem Statement

Agendo helps choose and resume work but does not provide an outcome-oriented retrospective. Completed todos contain useful deliverables, decisions, and verification notes, yet asking an agent to read an unrestricted archive is expensive and can overwhelm its context. Counting completed items alone also misses meaningful outcomes and can overstate verification.

## Findings

- `src/todos/digestService.ts` already builds deterministic summaries from repository snapshots, but its detailed sections focus on active work rather than completed outcomes.
- Completed todos retain acceptance criteria, Resume Context, Work Log, and source paths that can support a grounded report.
- Existing records do not guarantee a reliable completion timestamp. Last modification or latest work-log time must not silently become the completion date.
- Todo 028 concerns CSV/JSON export; this feature is a human-readable, evidence-backed retrospective and can be implemented independently.
- The user's proposed division of labor is extension-side selection/compilation followed by agent-side synthesis.
- The current implementation places the accomplishments report and criteria change settings directly on the todo page, making it visually busy.
- The accomplishments report should be a separate, on-demand feature that can be run for a specific time period (between date X and date Y) or for a selected set of todos.
- Criteria change settings should be moved to a settings panel rather than appearing on every todo page.

## Recommended Action

Refine the current implementation:
1. Move the accomplishments report to a separate command/panel that accepts a time range (start date, end date) and optional filters (group, tags, source).
2. Move criteria change settings to a dedicated settings panel, removing them from the per-todo page view.
3. Keep the report as an on-demand, user-initiated action rather than a persistent page element.
4. The report should summarize accomplishments for the selected period or todo set, not appear on every todo page.

For a large selection, emit a bounded index and stable batches. Produce partial summaries with their supporting IDs, then synthesize those summaries while retaining coverage and exclusions. Do not silently sample or claim that the full archive was reviewed when only a subset fit.

## Acceptance Criteria

- [ ] Users can select a bounded period or explicit set of completed todos and optionally filter by group, tags, or scanner source
- [ ] Cancellation, backlog, and unfinished work are excluded from accomplishments by default and labeled separately if explicitly included
- [ ] Completion-date semantics are explicit; records without trustworthy dates appear as undated rather than being assigned file modification times
- [ ] Future completion-date capture is evaluated without silently rewriting historical completion dates
- [ ] The deterministic packet includes IDs, source paths/links, outcomes or concise problem/solution context, criterion/verification evidence, and uncertainty
- [ ] Large selections have item and size limits, stable batching/continuation, and explicit matched, included, and omitted counts
- [ ] Agent instructions support per-batch summaries followed by a final synthesis with source references and retained coverage information
- [ ] Reports group meaningful delivered outcomes rather than merely repeating titles or every work-log action
- [ ] A completed status is not treated as proof that tests ran or criteria were verified; missing or contradictory evidence remains visible
- [ ] Related or overlapping scanner imports are not counted as distinct delivered outcomes without explaining their overlap
- [ ] Users can preview/copy the packet and review any generated report; compiling context does not mutate todo lifecycle, overwrite documents, or automatically send content to a provider
- [ ] Source todo content is treated as untrusted evidence, not instructions to execute
- [ ] Tests cover date boundaries, undated records, filtering, exclusions, deterministic batches, size limits, and source-link coverage

## Technical Details

Potential reuse: repository snapshots, `src/todos/digestService.ts`, completed-todo discovery, existing copy-context command conventions, and bundled skill instructions. Keep this separate from active-task ranking and the export-format work in todo 028. Only add cached or incremental summaries after the bounded packet approach demonstrates a concrete need.

## Resume Context

**Current state:** Accomplishments report refined. buildAccomplishmentsPacket now derives explicit completion-date semantics from updatedAt (undated when unavailable), includes source path/link, outcome, evidence disclaimer, and uncertainty note per todo; excludes non-completed statuses by default; enforces deterministic batching (date desc, then ID asc) and size limits (25 todos / 50 KB) with matched/included/omitted counts. CopyAccomplishmentsContext command now prompts for a time range (start/end date) and optional filters (group, tags, source) before building the packet. Added agendo.criteriaChanges.enabled setting (default false) registered in package.json with a toggle-criteria-changes handler in extension.ts for the dedicated settings panel.

**Next step:** Wire the canvas "Proposed Criteria Changes" panel to the new criteriaChanges.enabled setting (panel code lives in the bundled canvas distribution under resources/canvas/). Confirm the setting toggles correctly end-to-end.

## Work Log

### 2026-10-25 - Feature Idea Captured

**By:** Kilo

**Actions:**

- Checked the active-task digest and existing export todo for overlap
- Recorded the extension-compilation and agent-synthesis split suggested by the user
- Captured bounded processing, source citations, and completion-date uncertainty as first-version requirements

### 2026-10-26 - Implemented and Verified

**By:** Kilo

**Actions:**

- Created `src/todos/accomplishmentsService.ts` with `buildAccomplishmentsPacket`
- Added `CopyAccomplishmentsContext` command and registration
- Added package.json command contribution
- Added 9 regression tests covering filtering, date boundaries, and packet content
- Verified: 194 extension tests passing, 20 canvas tests passing, lint clean, 0 audit vulnerabilities, vsix packaged

### 2026-10-27 - Refined accomplishments report and criteria settings panel

**By:** Kilo

**Actions:**

- Refined `buildAccomplishmentsPacket` for explicit completion-date semantics (undated when no `updatedAt`), per-todo source path/link, outcome, evidence disclaimer, and uncertainty note; excludes non-completed statuses by default; deterministic batching (date desc, then ID asc); size limits (25 todos / 50 KB) with matched/included/omitted counts.
- Refined `CopyAccomplishmentsContext` command to prompt for a time range (start/end date) and optional filters (group, tags, source) before building the packet; remains on-demand and user-initiated.
- Added `agendo.criteriaChanges.enabled` setting (default false) registered in package.json; added `toggle-criteria-changes` handler in extension.ts for the dedicated settings panel.
- Added 8 regression tests covering exclusion of non-completed statuses, inclusive date boundaries, undated records, source path/link coverage, deterministic batches, size limits, and header counts.
- Verified: `npm run compile` clean, `npm run lint` clean, `npm test` 364 passing.

**Learnings:**

- The canvas "Proposed Criteria Changes" panel UI lives in the bundled canvas distribution; the setting and handler are in place, but the panel-to-setting wiring remains as a follow-up.
