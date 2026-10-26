---
status: complete
priority: p2
issue_id: "010"
tags: [resume, context, agent-workflow]
dependencies: []
---

# Resume Context Summary

Add a compact Markdown summary so an individual user or AI agent can resume work with the right context after a pause.

## Problem Statement

The task system records status, priority, dependencies, and detailed history, but it does not provide a short current snapshot. Resuming work requires reconstructing the present state and next action from the entire Work Log.

Agendo is individual-first, so this should improve continuity across personal work sessions and AI agents without introducing ownership or assignment semantics.

## Findings

- The Work Log should remain the canonical detailed history.
- `dependencies` already provide the structured source of truth for blockers.
- `owner`, assignment, identity, and team-mode fields are not justified by the current product model.
- A short Markdown section works for an individual resuming personally, switching agents, or optionally sharing repository-tracked todos.
- A section avoids extending the parser with fields that the extension does not need to filter or display.

## Proposed Solutions

### Option 1: Add assignment-oriented frontmatter

**Approach:** Support fields such as `owner`, `last_updated`, `next_step`, and `handoff_notes`.

**Pros:**
- Machine-readable
- Could support future assignment filters

**Cons:**
- Introduces team concepts that do not fit the individual-first product
- Duplicates timestamps and blockers already represented elsewhere
- Adds parser surface without a current extension use case

**Effort:** 2-4 hours

**Risk:** Low

---

### Option 2: Agent-maintained Resume Context section

**Approach:** Add a compact `Resume Context` section containing `Current state` and `Next step`, maintained whenever work starts, pauses, or materially changes.

**Pros:**
- Useful for personal resumption and agent continuity
- Lightweight and readable without extension support
- Keeps dependencies and Work Log responsibilities clear

**Cons:**
- Requires the skill workflow to keep it current

**Effort:** 1-2 hours

**Risk:** Low

## Recommended Action

Add the Markdown-based Resume Context section from Option 2. Keep the Work Log as detailed history and `dependencies` as structured blockers. Do not add `owner`, assignment fields, or a broad individual/team mode.

This defines the structure consumed by the resume workflow in todo 011.

## Technical Details

Affected files:
- `resources/skill/assets/todo-template.md`
- documentation and guidance in `resources/skill/SKILL.md`

Related components:
- work log conventions
- existing dependency metadata
- AI-agent resume workflows

## Resources

- existing skill work-log guidance
- task metadata conventions in the repo

## Acceptance Criteria

- [x] Task files include a lightweight Resume Context section
- [x] The work log remains the canonical place for learnings and updates
- [x] A future agent can understand next steps without reading unrelated repo context
- [x] The model remains simple and easy to maintain
- [x] No owner, assignment, or team-mode concepts are required

## Resume Context

**Current state:** Complete. The individual-first Resume Context structure is implemented in the bundled template, skill guidance, and README.

**Next step:** Follow the resume and pause workflow defined by completed todo 011.

## Work Log

### 2026-08-13 - Initial Discovery

**By:** Copilot

**Actions:**
- Reviewed the current task template and confirmed work-log guidance already exists
- Identified richer handoff metadata as a low-friction improvement on top of the current model

**Learnings:**
- This is a strong complement to the repo’s AI and human handoff story
- It fits the “resume work with the right context” vision very well

### 2026-08-19 - Individual-First Reframe

**By:** Kilo Code

**Actions:**
- Audited existing and planned features for team-specific assumptions
- Chose a universal Resume Context section over assignment-oriented metadata or product modes
- Defined Work Log, dependencies, and Resume Context as separate sources for history, blockers, and current state

**Learnings:**
- `owner` was the only clearly team-specific proposed field
- One human coordinating multiple agents benefits from continuity features without needing collaboration semantics

### 2026-08-19 - Completion

**By:** Kilo Code

**Actions:**
- Added the two-field Resume Context section to the bundled todo template
- Kept dependencies and Work Log as the sources of truth for blockers and detailed history
- Documented the individual-first product model without owner, assignment, or team modes
- Bumped the bundled skill to version 1.2.0

**Learnings:**
- Markdown structure provides continuity without expanding the extension parser or configuration surface

## Notes

- This should be a lower-priority enhancement behind the more visible board and dependency work
- The goal is better continuity, not project-management or assignment complexity
