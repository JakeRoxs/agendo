---
status: complete
priority: p2
issue_id: "031"
tags: [vscode, extension, automation, cleanup]
dependencies: []
---

# Review and Close Stale Todos in Batches

## Problem Statement

As projects grow, open and backlogged todo files can become stale because the implementation was
completed, replaced, or abandoned without the todo lifecycle being updated. The existing
reconciliation workflow can inspect an individual todo, but it is not obvious how to ask for an
exhaustive review of the todo repository or how a large review should continue across bounded
batches.

The goal is not a second terminal `archive` state. Agendo already has the correct destinations:
verified work belongs in `complete`, and obsolete or superseded work belongs in `cancelled` with a
reason. Users need one easy workflow that inventories all non-terminal todos, checks them against
the current codebase, and proposes those existing lifecycle transitions for approval.

**Why it matters:** Stale todos make the active and backlog views unreliable. Users should not have
to remember which files need review or repeatedly prompt for individual issue IDs.

## Findings

- Todo 023 introduced the advisory reconciliation workflow and todo 027 improved its checks and
  recommendation format.
- The original proposal for an `archive/` folder would duplicate the meaning of `complete` and
  `cancelled`, complicate discovery, and hide whether work was delivered or abandoned.
- Age alone is weak evidence. An old todo may still be valid, while a recent todo may already be
  implemented or superseded.
- The remaining gap is orchestration: define an explicit all-todos scope, split large repositories
  into deterministic batches, preserve progress between batches, and produce one consolidated set
  of approval-ready recommendations.
- Completed and cancelled history should be included in the initial inventory for dependency and
  supersession evidence, but it should not receive a full semantic review unless an inconsistency
  points to it.

## Proposed Solutions

### Option 1: Extension archive command

**Approach:** Add a VS Code command that selects old todos and moves them into a new `archive/`
folder, optionally using an age threshold.

**Pros:**
- Familiar picker-based UI
- Deterministic file movement

**Cons:**
- Cannot determine whether open work is actually complete or superseded
- Introduces a redundant lifecycle state and folder
- Age-based selection can hide valid work and miss recently stale work

**Effort:** 3-5 hours
**Risk:** Medium

---

### Option 2: Whole-repository reconciliation

**Approach:** Extend the Agendo reconciliation reference so one explicit invocation such as
`/agendo review all todos` inventories the entire configured root, semantically reviews every
non-terminal todo, and recommends `complete`, `cancelled`/superseded, or no change. When the todo
count exceeds a safe batch size, process stable ID-ordered batches and carry a compact checkpoint
into the next batch.

**Pros:**
- Directly answers whether work is already implemented or superseded
- Reuses the existing lifecycle and safety rules
- Works from one simple user request
- Scales through batches without requiring the user to name every todo

**Cons:**
- Semantic review still depends on agent context and repository evidence
- Batch continuation must avoid skipped or duplicate IDs

**Effort:** 2-4 hours
**Risk:** Low

---

### Option 3: Dedicated extension review UI

**Approach:** Add an extension command and review UI that orchestrate the same repository-wide
semantic workflow and allow recommendations to be approved in VS Code.

**Pros:**
- Discoverable extension UX
- Structured progress and approvals

**Cons:**
- Requires model integration or an external-agent protocol
- Substantially more complex than improving the existing skill workflow

**Effort:** 1-2 days
**Risk:** High

---

## Recommended Action

**Option 2:** Make repository-wide reconciliation a first-class path in `reconcile.md`. Once the
Agendo skill is explicitly invoked, default an unscoped "reconcile/review my todos" request to all
non-terminal todos, use deterministic ID-ordered batches only when context limits require them, and
finish with a consolidated report.

Each candidate must identify whether it should move to `complete`, move to `cancelled` because it
is obsolete or superseded, remain unchanged, or needs more evidence. The workflow remains advisory:
no files move until the user approves the recommendations. Approved transitions continue to use the
existing move-before-edit lifecycle rules.

## Technical Details

**Affected files:**

- `resources/skill/reconcile.md` - define all-todos scope, batching, checkpoints, and consolidated
  recommendations
- `resources/skill/SKILL.md` - make the easy whole-repository prompt discoverable
- `README.md` - document the one-request workflow with an example
- Skill metadata and changelog if the bundled skill version changes

**Related components:**

- Existing `complete` and `cancelled` lifecycle transitions
- `superseded_by` metadata and cancellation banners
- Todo 023 reconciliation workflow and todo 027 reconciliation improvements

## Acceptance Criteria

- [x] One explicit invocation such as `/agendo review all todos` starts a whole-repository
      reconciliation
- [x] The workflow directly lists the configured root and all configured state folders before review
- [x] Every non-terminal todo is reviewed exactly once, including backlogged todos
- [x] Terminal todos are inventoried for evidence but skipped from full semantic review by default
- [x] Large repositories are processed in stable issue-ID batches with a compact completed-ID
      checkpoint and no skipped or duplicate todos
- [x] The final report consolidates all batches and distinguishes `complete`,
      `cancelled`/superseded, unchanged, and needs-investigation candidates
- [x] Completion recommendations cite acceptance-criteria and validation evidence
- [x] Supersession recommendations name the replacement todo or implementation evidence and include
      the required `superseded_by` metadata when applicable
- [x] No lifecycle changes are applied until the user approves them
- [x] Approved changes use existing `complete` or `cancelled` states; no `archive` state or folder is
      introduced
- [x] Documentation includes the single-prompt workflow and a batching example

## Resume Context

**Current state:** Whole-repository reconciliation, stable ID-ordered batching, exactly-once
checkpoints, and consolidated approval reporting are implemented, validated, and confirmed working
in an agent host. The unreleased bundled skill remains at version 1.4.4.

**Next step:** None. Revisit only if real-world use exposes missed todos, duplicate batch processing,
or unclear recommendations.

## Work Log

### 2026-09-28 - Re-scoped Around Repository-Wide Reconciliation

**By:** Kilo Code

**Actions:**

- Re-read todo 031 alongside completed reconciliation todos 023 and 027
- Replaced the age-based archive-folder proposal with a whole-repository semantic review workflow
- Defined bounded, ID-ordered batching and consolidated recommendations for large todo sets
- Kept lifecycle changes advisory and mapped outcomes to existing `complete` and `cancelled` states
- Promoted the todo from backlogged p3 to active pending p2

**Learnings:**

- The requested outcome is stale-work detection, not storage of old terminal files
- Existing reconciliation already supplies the safety model; the missing feature is exhaustive,
  low-friction orchestration

### 2026-09-28 - Implemented Whole-Repository Review

**By:** Kilo Code

**Actions:**

- Added default whole-repository scope to `resources/skill/reconcile.md`
- Added stable issue-ID manifests, automatic batch continuation, compact checkpoints, and
  exactly-once completion checks
- Added consolidated outcome groups and explicit supersession evidence requirements
- Documented the one-prompt workflow and batching behavior in README
- Bumped bundled skill metadata from 1.4.4 to 1.4.5 and updated the changelog

**Learnings:**

- Batch boundaries can remain an internal execution detail when a frozen manifest carries progress
- One consolidated approval step keeps the workflow easy without weakening lifecycle safety

### 2026-09-28 - Validation

**By:** Kilo Code

**Actions:**

- Ran `npm run compile` successfully
- Ran `npx biome check src package.json` successfully
- Validated the 1.4.5 metadata, README badge, batching section, and exactly-once workflow markers
- Ran `git diff --check` successfully
- Moved todo 031 from `in-progress` to `ready`

**Learnings:**

- Repository-wide `npm run lint` remains affected by an unrelated nested Biome root under
  `.kilo/worktrees/south-menu`; the equivalent check against project sources passes
- Runtime agent-host behavior remains the final confirmation before completion

### 2026-09-28 - Kept Unreleased Skill Version

**By:** Kilo Code

**Actions:**

- Restored bundled skill metadata and the README badge from 1.4.5 to 1.4.4
- Folded the whole-repository reconciliation behavior into the existing unreleased 1.4.4 changelog
  entry

**Learnings:**

- The existing 1.4.4 skill changes have not been released, so this addition does not require a new
  skill version

### 2026-09-28 - Refined Skill Instructions

**By:** Kilo Code

**Actions:**

- Clarified the reconciliation trigger as an unscoped "review all todos" request
- Corrected the config example so it contains an actual non-default value
- Clarified creation-time filename/frontmatter synchronization and the completion dependency query
- Reconciled completion and cancellation safety rules with stale-work and supersession detection
- Corrected the recommendation example so a `complete` recommendation has runtime verification
- Broadened skill metadata discovery text without changing the unreleased 1.4.4 version
- Ran `npm run compile`, targeted Biome checks, link validation, semantic-invariant checks, and
  `git diff --check` successfully

**Learnings:**

- Reconciliation can propose checking stale acceptance boxes when evidence proves the criteria are
  satisfied; it does not need pre-existing checked boxes
- Evidence-based cancellation recommendations are compatible with safety when application remains
  approval-gated
- Prettier reports existing Markdown style differences across the skill, template, and README;
  avoiding a full-file reformat keeps this refinement patch focused

### 2026-09-28 - Runtime Confirmed and Completed

**By:** User and Kilo Code

**Actions:**

- Recorded the user's confirmation that the repository-wide reconciliation workflow worked well
- Moved todo 031 from `ready` to `complete`
- Updated the final Resume Context to reflect verified completion
- Enabled automatic model invocation for the skill (removed `disable-model-invocation`)
- Bumped the bundled skill to version 1.4.5 for the upcoming 0.1.14 extension release

**Learnings:**

- The explicit skill invocation and automatic batching workflow are effective enough for the
  current release
