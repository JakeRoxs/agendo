---
status: pending
priority: p2
issue_id: "011"
tags: [handoff, worklog, context, skill, agent-workflow]
dependencies: []
---

# Expand Task Continuity and Handoff in the Agendo Skill

Strengthen the Agendo skill so task files act as durable resumable context for both humans and AI agents, instead of relying on work logs as a loose historical record alone.

## Problem Statement

The current skill already covers task creation, life cycle management, triage, and work logs. However, the work log is still primarily treated as a historical record rather than a structured handoff and resume mechanism. That makes it harder for a future agent or teammate to quickly understand the current state, blockers, and next action without re-reading the entire task file or surrounding repo context.

This is the workflow layer of the handoff problem: how should the skill and future agents actually read, update, and resume tasks using that context?

## Findings

- The skill already includes a `Work Log` section with actions and learnings.
- That section is a strong foundation for continuity, but it is not yet treated as a first-class handoff artifact.
- There is no explicit guidance for a standard resume summary, next-step note, or blocked-on state.
- The skill already references AI-agent sub-agent workflows, so task continuity and handoff guidance fit naturally with the existing design.
- This is a strong product differentiator for Agendo because it helps future work resume from known context instead of a blank slate.

## Proposed Solutions

### Option 1: Add a formal handoff section to each todo

**Approach:** Add a lightweight `Handoff Summary` / `Resume Context` section with required fields such as status, blocker, next step, and last update.

**Pros:**
- Simple and explicit
- Easy to standardize across tasks
- Works well for both human and AI resumption

**Cons:**
- Slightly more file structure overhead
- Requires discipline to keep the summary updated

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Expand the skill workflow for resume and handoff

**Approach:** Add a dedicated skill workflow that says: when resuming a task, read the task summary, last Work Log entry, and blockers before changing anything.

**Pros:**
- Strongest alignment with agent workflows
- Makes the resumability concept a first-class part of the product
- Improves consistency across future tasks

**Cons:**
- Requires clearer guidance in the skill documentation
- More behavior to maintain if different agents follow different prompt styles

**Effort:** 3-5 hours

**Risk:** Low

## Recommended Action

Expand the skill with a formal task continuity and handoff workflow. Standardize a compact resume summary for each task and add guidance for reading the last log entry, blockers, and next step before continuing work.

This should build on the metadata work in 010, not duplicate it: 010 defines the structure, while 011 defines the behavior and usage pattern for agents and humans.

## Technical Details

Affected files:
- `resources/skill/SKILL.md`
- `resources/skill/assets/todo-template.md`
- README and any docs that explain the skill’s value proposition

Related components:
- existing `Work Log` workflow
- task lifecycle and triage rules
- sub-agent handoff guidance in the skill

## Resources

- [resources/skill/SKILL.md](../../resources/skill/SKILL.md)
- [resources/skill/assets/todo-template.md](../../resources/skill/assets/todo-template.md)
- [README.md](../../README.md)

## Acceptance Criteria

- [ ] The skill has a documented task continuity / handoff workflow
- [ ] Todo files have a standard resumable context section or equivalent guidance
- [ ] Resume instructions tell agents to read blockers, last updates, and next steps first
- [ ] The README and skill docs specifically describe the “pick up later with context” value
- [ ] The skill workflow still remains lightweight and markdown-first

## Work Log

### 2026-08-13 - Initial Discovery

**By:** Copilot

**Actions:**
- Reviewed the current skill and confirmed the Work Log already exists
- Identified the main gap: the skill treats work logs as history, not as explicit resume context
- Defined a concrete task to formalize handoff and resumption guidance

**Learnings:**
- The core concept is already present; it just needs to be framed and structured more explicitly
- This is a strong strategic direction for the product because it improves interoperability between humans and AI agents

## Notes

- This should be implemented without making task files overly heavy or bureaucratic
- The goal is durable context, not a full project-management schema
