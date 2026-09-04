---
status: complete
priority: p2
issue_id: "023"
tags: [audit, cleanup, ai, workflow]
dependencies: []
---

# Reconcile Todos Against the Current Workspace

## Problem Statement

Todos can become stale as implementation changes outside their original workflow. Status, acceptance
criteria, problem wording, and Resume Context may no longer describe the repository accurately.
Agendo has deterministic integrity checks for parts of the file model, but it does not provide a
review workflow that compares todo intent with the current implementation and proposes safe updates.

A generic "cleanup" action could sound destructive and cannot safely infer prioritization or
completion from filenames alone. The feature should instead audit todos, gather implementation
evidence, and present reviewable reconciliation recommendations without silently rewriting history.

## Findings

- Structural inconsistencies do not require an LLM: filename/frontmatter mismatches, incorrect
  folder placement, duplicate IDs, invalid dependencies, stale cancellation metadata, broken file
  references, and missing required sections can be detected deterministically.
- Semantic questions do require repository understanding: whether a problem still exists, whether
  acceptance criteria are implemented, whether another change superseded a todo, and whether Resume
  Context wording is stale.
- Sending the entire repository to a model would be expensive and unnecessary. Evidence should be
  assembled from the todo, referenced paths and symbols, dependencies, relevant searches, tests,
  and current Git changes.
- Status transitions have different safety requirements. Implementation evidence can justify a
  recommendation of `ready`, but `complete` should require verified acceptance criteria. Backlogging
  is a prioritization decision and cancellation requires an explicit obsolete or superseded reason.
- Completed Work Logs are historical records and should not be rewritten merely to modernize prose.
- VS Code's Language Model API can provide an integrated semantic pass when a model is available,
  but deterministic auditing and a useful fallback should work without model access.

## Proposed Solutions

### Option 1: Deterministic Audit Only

**Approach:** Add an audit command that reports structural and lifecycle inconsistencies without
attempting to compare todo intent against implementation.

**Pros:**

- Predictable, inexpensive, and available offline
- Straightforward to test
- Resolves objective integrity problems safely

**Cons:**

- Cannot identify stale requirements or implemented acceptance criteria
- Does not address the main semantic reconciliation use case

**Effort:** Medium

**Risk:** Low

### Option 2: Agent/Skill Handoff

**Approach:** Build a deterministic evidence report and generate a prompt that asks an external
agent using the Agendo skill to inspect implementation and propose updates.

**Pros:**

- Avoids coupling the extension to one model provider
- Reuses agent search and file-reading capabilities
- Lower implementation effort than a dedicated model workflow

**Cons:**

- User experience and structured output vary by host
- Applying recommendations remains mostly manual
- Harder to enforce evidence and safety contracts

**Effort:** Medium

**Risk:** Medium

### Option 3: Two-Stage Reconciliation Workflow

**Approach:** Run deterministic checks first, then optionally use VS Code's Language Model API for
semantic analysis. Require structured recommendations containing evidence, confidence, proposed
status, acceptance-criteria assessments, and wording changes. Present every change in a review UI
before applying it through existing services.

**Pros:**

- Useful without an LLM and more capable when one is available
- Keeps model output advisory and evidence-based
- Supports consistent per-change approval and safe status transitions
- Establishes reusable audit data structures and tests

**Cons:**

- Highest implementation and UX complexity
- Requires model availability, consent, context limits, and failure handling
- Repository evidence gathering must be carefully bounded

**Effort:** High

**Risk:** Medium

## Recommended Action

Implement Option 1 (deterministic audit) and Option 2 (agent/skill handoff). Defer Option 3
(inline VS Code Language Model API with a formal contract and review UI) as a long-term
refinement that is more complexity than the workflow currently needs.

Concretely:
- Add reconciliation as a **reference file in the existing Agendo skill**
  (`resources/skill/reconcile.md`), not a separate skill and not a standalone extension command.
  It reuses the skill's naming, lifecycle, folder, and move-before-edit rules and adds the
  deterministic-checks-then-semantic-review procedure.
- SKILL.md gets only a short pointer section (3-5 lines) plus a mention in the frontmatter
  description, so the model discovers reconciliation without loading the full procedure every
  time. This keeps the main skill lean while sharing conventions.
- The full procedure lives in `reconcile.md` and is loaded only when reconciliation is requested
  (e.g. via a prompt like "reconcile my todos"). No dedicated `/` command is needed.
- Keep the semantic pass advisory and prompt-driven. Users still decide what to apply.
- Name the workflow "Reconcile Todos" or "Audit Todos Against Workspace" rather than "Cleanup
  Todos".

The model must never apply changes directly. Users should approve status, acceptance-criteria,
Resume Context, and general wording changes independently. Existing `StatusService` behavior must
remain the only path for approved lifecycle transitions.

## Technical Details

Primary integration surface is the Agendo skill, not a new extension command:

- `resources/skill/reconcile.md` (new reference file) — the full reconciliation procedure:
  deterministic checks, evidence gathering, and advisory-review rules. Reuses the skill's naming,
  lifecycle, and folder conventions.
- `resources/skill/SKILL.md` — add a short pointer section (3-5 lines) linking to `reconcile.md`
  and note the capability in the frontmatter description so the model discovers it.
- No dedicated command file is needed; the reference file is loaded on demand when reconciliation
  is requested.

If/when the deterministic checks also need to be surfaced by the extension itself, these would be
relevant:

- `src/commands.ts` and `src/commandRegistration.ts` for command registration
- `src/todos/todoRepository.ts` for repository snapshots and dependency state
- `src/todos/statusService.ts` for approved status and priority transitions
- `src/todos/linkService.ts` for existing reference validation

Suggested scopes:

- Selected todo
- Active todos
- Backlog
- All todos, with terminal history excluded from prose rewrites by default

The skill section should guide the model to produce:

- Todo ID and current status
- Recommended status and reasoning
- File/symbol/test evidence with reasons
- Per-acceptance-criterion assessment
- Proposed Resume Context or wording changes
- Warnings, missing evidence, and manual verification requirements

These are guidance for the prompt-driven workflow, not a rigid contract. Option 3 (a formal
contract and inline review UI) is intentionally deferred.

## Acceptance Criteria

Skill Reference File — Reconciliation Workflow

- [x] A new `resources/skill/reconcile.md` reference file documents the full procedure
- [x] SKILL.md has a short pointer section (3-5 lines) linking to `reconcile.md`
- [x] The skill frontmatter description mentions the reconciliation capability
- [x] Deterministic checks are documented to run without requiring an external model:
  - [x] filename/frontmatter/folder mismatches, duplicate IDs, invalid/missing dependencies
  - [x] stale cancellation metadata, broken references, required sections
- [x] The workflow references only focused evidence (paths, symbols, tests, recent changes)
      rather than dumping the whole workspace
- [x] The workflow is prompt-driven and advisory, not a formal structured-contract workflow
- [x] The workflow preserves conservative lifecycle rules:
  - [x] `complete` only with verified acceptance criteria
  - [x] backlogging and cancellation remain explicit, reasoned decisions
  - [x] historical Work Logs are not rewritten

General

- [x] No dedicated `/` command is added; the reference file loads on demand
- [x] Users approve or reject changes independently; the model never auto-applies
- [x] Approved lifecycle changes use `StatusService` and preserve move-before-edit behavior
- [x] README and changelog document the reconciliation workflow and its safety model

## Resume Context

**Current state:** Implemented. `resources/skill/reconcile.md` carries the full procedure;
SKILL.md has the short pointer section and frontmatter mention; skill is at 1.4.0; README and
CHANGELOG document the workflow and its safety model; extension bumped to 0.1.7. All acceptance
criteria are checked.

**Next step:** Verify the skill behaves as intended end-to-end (run a "reconcile my todos" prompt
in an agent using the skill) and confirm the user is satisfied before moving to `complete`.

## Work Log

### 2026-09-01 - Initial Design

**By:** Kilo Code

**Actions:**

- Captured the requested cleanup/reconciliation workflow as a tracked feature
- Separated deterministic integrity checks from semantic LLM analysis
- Defined conservative status rules, focused evidence gathering, and per-change approval
- Identified a staged implementation path and likely extension integration points

**Learnings:**

- Most file-model cleanup can be implemented without an LLM
- LLM value is concentrated in comparing todo intent and wording against current implementation
- An advisory, evidence-based workflow is safer than automatic cleanup

### 2026-09-01 - Scope Decision

**By:** Kilo Code

**Actions:**

- Confirmed the chosen scope: Option 1 (deterministic audit) and Option 2 (agent/skill handoff
  prompt)
- Deferred Option 3 (inline model contract and review UI) as more formal than the workflow needs
- Revised recommended action, acceptance criteria, technical details, and resume context to match

**Learnings:**

- A prompt-driven handoff is lighter-weight and easier to adopt than a formal model contract
- The deterministic audit is the stable foundation the semantic pass builds on

### 2026-09-01 - Delivery Mechanism Decision

**By:** Kilo Code

**Actions:**

- Decided to implement the reconciliation workflow as a section within the existing Agendo skill,
  not as a separate skill (avoids duplicating naming/lifecycle/folder rules)
- Added an optional dedicated command (e.g. `/agendo-rec`) as sugar that loads the skill and runs
  its reconciliation section
- Revised recommended action, technical details, and acceptance criteria accordingly

**Learnings:**

- A skill does not automatically get its own `/` command; a dedicated command is a separate file
- Reconciliation is a lifecycle operation on Agendo todos, so it belongs in the same skill

### 2026-09-01 - Reference File Decision

**By:** Kilo Code

**Actions:**

- Decided reconciliation lives in a dedicated reference file (`resources/skill/reconcile.md`)
  rather than being appended to the already-large SKILL.md
- SKILL.md gets only a short pointer section; the full procedure loads on demand
- Removed the optional dedicated command; the reference file is discoverable via prompt
- Revised recommended action, technical details, and acceptance criteria

**Learnings:**

- A reference file keeps the main skill lean while sharing conventions (same pattern as
  todo-template.md)
- The SKILL.md pointer and frontmatter description are the discovery seams that must stay correct

### 2026-09-01 - Documentation and Status Update

**By:** Kilo Code

**Actions:**

- Confirmed `resources/skill/reconcile.md` and the SKILL.md pointer + frontmatter already exist
  and satisfy all skill-reference acceptance criteria
- Added the reconciliation workflow to the README (Features list and built-in skill section),
  including a note on its advisory safety model
- Added a CHANGELOG entry and bumped the extension to 0.1.7 alongside the 1.4.0 skill update
- Checked off all acceptance criteria and moved the todo from `pending` to `ready`

**Learnings:**

- The reference-file content was complete; the remaining gap was only the README/CHANGELOG docs
- Keeping the pointer and frontmatter in sync is what makes the workflow discoverable on demand
