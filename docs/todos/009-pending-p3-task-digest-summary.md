---
status: pending
priority: p3
issue_id: "009"
tags: [summary, digest, workflow, agent-handoff]
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

- [ ] Users can view a compact overview of important tasks
- [ ] Blocked and high-priority items are surfaced clearly
- [ ] The summary is deterministic and low-risk to trust
- [ ] The output supports contextual handoff for future work

## Work Log

### 2026-08-13 - Initial Discovery

**By:** Copilot

**Actions:**
- Identified the need for quick task triage at scale
- Compared this with the existing project’s focus on task continuity and repo-aware context

**Learnings:**
- A digest view is a natural companion to filtering and status management
- It is especially valuable when multiple agents or human teammates share a todo workflow

## Notes

- This is a lower-priority enhancement compared with board and dependency support
- It should stay simple and useful rather than becoming a full analytics dashboard
