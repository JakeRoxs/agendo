---
status: complete
priority: p2
issue_id: "009"
tags: [summary, digest, workflow, agent-continuity]
dependencies: []
---

# Task Digest and Summary View

Add a summary view that surfaces the most important tasks in a compact digest so a user or agent can understand the current workload quickly.

## Problem Statement

As the todo system grows, users need a way to answer questions like: “What should I work on next?”, “What is blocked?”, and “What is the current state of this task list?” Reading every file is too costly.

## Findings

- The repository already supports filtering and task metadata.
- A digest view would make task triage easier and help with handoff quality.
- AI agents benefit especially from compact task summaries because they can read the state without re-deriving context manually.

## Proposed Solutions

### Option 1: Simple digest panel

**Approach:** Show a concise list of highest-priority open items, blocked items, and recently updated tasks.

**Pros:**
- Very useful with minimal complexity
- Great for both human and agent workflows

**Cons:**
- Not as rich as a full dashboard
- Could become stale if not refreshed properly

**Effort:** 2-4 hours

**Risk:** Low

---

### Option 2: AI-generated summary text

**Approach:** Produce a natural-language rundown of active tasks and recommended next actions.

**Pros:**
- Very strong for agent handoff workflows
- Helps with context preservation and resume behavior

**Cons:**
- More complexity and subjectivity in output
- May require careful scope control

**Effort:** 4-6 hours

**Risk:** Medium

## Recommended Action

Build a compact digest view that lists urgent, blocked, and recently updated tasks, with a future path toward agent-friendly summary text. Keep the first version deterministic and easy to trust.

## Technical Details

Affected files:
- `src/todos/filterService.ts`
- `src/todos/todoRepository.ts`
- `src/todos/todoTreeProvider.ts`
- future summary UI or command surfaces

Related components:
- task metadata and status model
- future skill interactions for resume and triage support

## Resources

- current sorting/filtering behavior in the repo
- work log and task continuity patterns in the skill

## Acceptance Criteria

- [x] Users can view a compact overview of important tasks
- [x] Blocked and high-priority items are surfaced clearly
- [x] The summary is deterministic and low-risk to trust
- [x] The output supports contextual handoff for future work

## Resume Context

**Current state:** Complete. The digest command generates a deterministic Markdown snapshot from current repository state.

**Next step:** Open Agendo: Show Task Digest whenever a compact workload and next-action summary is needed.

## Work Log

### 2026-08-13 - Initial Discovery

**By:** Copilot

**Actions:**
- Identified the need for quick task triage at scale
- Compared this with the existing project’s focus on task continuity and repo-aware context

**Learnings:**
- A digest view is a natural companion to filtering and status management
- It is especially valuable when multiple agents or human teammates share a todo workflow

### 2026-08-19 - Implementation Started

**By:** Kilo Code

**Actions:**
- Triaged the todo from pending to ready
- Chose deterministic repository-derived Markdown over AI-generated summary text
- Defined sections for counts, recommended next actions, P1 work, blockers, and recent updates

**Learnings:**
- A trusted digest should produce identical content for identical repository state
- File modification time is needed for recent-work ordering but should not affect priority ranking

### 2026-08-19 - Completion

**By:** Kilo Code

**Actions:**
- Added deterministic digest generation for overview counts, recommended next actions, P1 work, blocked todos, and recent updates
- Added repository file modification times for recent-work ordering
- Added the `Agendo: Show Task Digest` command and Activity Bar action
- Opened the digest as Markdown source before switching to preview for agent discoverability
- Added ranking, blocker, determinism, registration, and preview sequencing coverage
- Updated the README feature list
- Ran `npm test`: 31 passing; TypeScript compilation and Biome checks clean

**Learnings:**
- Separating deterministic ranking from optional future natural-language summaries keeps the first version trustworthy

## Notes

- This is a lower-priority enhancement compared with board and dependency support
- It should stay simple and useful rather than becoming a full analytics dashboard
