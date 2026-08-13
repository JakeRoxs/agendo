---
status: pending
priority: p3
issue_id: "010"
tags: [handoff, metadata, context, agent-workflow]
dependencies: []
---

# Richer Handoff Metadata

Add structured metadata for task handoff so a person or AI agent can resume work with the right context even after a long pause.

## Problem Statement

The task system is already good at recording status and priority, but there is room to capture more operational context: who owns the task, what has been tried, what is blocked, and what the next step is. This would make handoff and resumption much easier.

This is the metadata layer of the handoff problem: what structured context should each todo carry so it can be resumed reliably?

## Findings

- The skill template already emphasizes work logs and learnings.
- A lightweight metadata layer could make task continuity much stronger.
- This would be especially helpful when a task is handed from one agent to another or from a human to an AI assistant.
- The extension can support this without abandoning the markdown-first model.

## Proposed Solutions

### Option 1: Add handoff fields to task metadata

**Approach:** Support fields like `owner`, `last_updated`, `next_step`, `status_summary`, and `handoff_notes`.

**Pros:**
- Easy to add and read
- Strong value for context continuity
- Keeps the workflow in Markdown

**Cons:**
- More schema work and conventions to document
- Some fields may be optional and therefore inconsistent if not used

**Effort:** 2-4 hours

**Risk:** Low

---

### Option 2: Auto-generated handoff summaries

**Approach:** Produce a compact summary based on the work log and latest task state when a task is updated.

**Pros:**
- Strongest fit for agent resumption
- Reduces the amount of context a person has to re-read

**Cons:**
- More automation and behavior to test
- Must be carefully scoped to avoid noisy output

**Effort:** 4-6 hours

**Risk:** Medium

## Recommended Action

Add a lightweight set of handoff-aware task metadata fields and make the work log the default place for resumable context. This improves continuity without bloating the task file format.

This should be treated as the foundation for the workflow work in task continuity and handoff; the metadata should support, not duplicate, the skill-level resumption process.

## Technical Details

Affected files:
- `resources/skill/assets/todo-template.md`
- `src/todos/todoModel.ts`
- documentation and guidance in `resources/skill/SKILL.md`

Related components:
- work log conventions
- status transitions and task metadata parsing
- AI-agent resume workflows

## Resources

- existing skill work-log guidance
- task metadata conventions in the repo

## Acceptance Criteria

- [ ] Task files can include lightweight, resumable context metadata
- [ ] The work log remains the canonical place for learnings and updates
- [ ] A future agent can understand next steps without reading unrelated repo context
- [ ] The model remains simple and easy to maintain

## Work Log

### 2026-08-13 - Initial Discovery

**By:** Copilot

**Actions:**
- Reviewed the current task template and confirmed work-log guidance already exists
- Identified richer handoff metadata as a low-friction improvement on top of the current model

**Learnings:**
- This is a strong complement to the repo’s AI and human handoff story
- It fits the “resume work with the right context” vision very well

## Notes

- This should be a lower-priority enhancement behind the more visible board and dependency work
- The goal is better continuity, not more heavy project-management complexity
