---
status: complete
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

## Recommended Action

Proposed for triage: begin with an Accomplishments Context command using the same provider-independent copy-context pattern as other Agendo workflows. Let users choose a reporting period and optional group/tag/source filters. The extension prepares a compact deterministic packet; an agent turns it into a readable report with links to supporting todos. Offer preview/copy before transmission or saving. Do not add an LLM provider, vector database, or automatic report scheduler for the first version.

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

**Current state:** Feature idea captured; no report command, date model, or agent integration has been implemented.

**Next step:** Define the first report's completion-date policy and compact packet format, then prototype it against a small completed selection and an oversized synthetic archive.

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
