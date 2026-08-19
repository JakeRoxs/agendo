---
status: complete
priority: p2
issue_id: "011"
tags: [resume, continuity, worklog, context, skill, agent-workflow]
dependencies: ["010"]
---

# Define the Task Resume and Continuity Workflow

Strengthen the Agendo skill so task files provide durable resumable context for an individual user and AI agents.

## Problem Statement

The current skill covers task creation, lifecycle management, triage, and work logs. However, it does not define how a future session should consume the Resume Context, dependencies, and latest Work Log before continuing.

This is the workflow layer of continuity: how should a user or agent resume and pause work without reconstructing context from scratch?

## Findings

- The skill already includes a `Work Log` section with actions and learnings.
- That section is a strong foundation for continuity, but it is not yet treated as a first-class handoff artifact.
- There is no explicit guidance for a standard resume summary, next-step note, or blocked-on state.
- The skill already references AI-agent sub-agent workflows, so task continuity and handoff guidance fit naturally with the existing design.
- This is a strong product differentiator for Agendo because it helps future work resume from known context instead of a blank slate.

## Proposed Solutions

### Option 1: Rely on the Work Log alone

**Approach:** Read the most recent Work Log entry and infer the current state.

**Pros:**
- No new workflow rules

**Cons:**
- Historical entries may not state the current next action
- Requires more context and inference on every resume

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Define a Resume Context workflow

**Approach:** On resume, read metadata and dependencies, Resume Context, and the latest Work Log entry before changing anything. On pause, update Resume Context and append a Work Log entry.

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

Expand the skill with a universal resume and pause workflow. Standardize the order for reading current state, blockers, latest updates, and next steps before continuing work.

Todo 010 defines the section structure; this todo defines how individuals and agents maintain and consume it.

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

- [x] The skill has a documented task resume and pause workflow
- [x] Todo files have a standard resumable context section or equivalent guidance
- [x] Resume instructions tell agents to read blockers, last updates, and next steps first
- [x] The README and skill docs describe the “pick up later with context” value for individual users and agents
- [x] The skill workflow still remains lightweight and markdown-first

## Resume Context

**Current state:** Complete. Deterministic resume and pause workflows are documented in the bundled skill and linked from the README.

**Next step:** Apply the workflow whenever active work is resumed or paused.

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

### 2026-08-19 - Implementation Started

**By:** Kilo Code

**Actions:**
- Made todo 010 an explicit dependency
- Reframed handoff as a universal resume and continuity workflow
- Began documenting deterministic resume and pause steps in the bundled skill

**Learnings:**
- Continuity is useful without introducing ownership, assignments, or a collaboration mode

### 2026-08-19 - Completion

**By:** Kilo Code

**Actions:**
- Documented ordered resume steps covering metadata, dependencies, Resume Context, latest Work Log, and current code
- Documented pause steps that update current state, next action, blockers, and detailed history
- Updated sub-agent guidance and README positioning around individual and agent continuity
- Verified skill version consistency and ran `npm test`: 30 passing

**Learnings:**
- Separating current state, structured blockers, and historical detail keeps resumption deterministic without making todo files bureaucratic

## Notes

- This should be implemented without making task files overly heavy or bureaucratic
- The goal is durable context, not a full project-management schema
