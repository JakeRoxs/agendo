---
status: complete
priority: p2
issue_id: "007"
tags: [dependencies, workflow, task-relationships]
dependencies: []
---

# Task Dependency Links

Add explicit dependency tracking so tasks can declare what they are blocked by and what other work they unlock.

## Problem Statement

When a repo has many active tasks, it becomes hard to understand which work is blocked, which work enables another task, and which tasks can be safely triaged later. The current project can manage status and priority, but not explicit task relationships.

## Findings

- The skill template already supports `dependencies` in frontmatter.
- There is a clear conceptual model for blockers and sequencing already in the repo.
- Dependency relationships would make the tree view and future summaries more useful for humans and agents alike.
- This is a strong fit for both project management and task continuity.

## Proposed Solutions

### Option 1: Dependency metadata only

**Approach:** Add support for lightweight `dependencies` and `blocked_by` data in the todo file and surface it in the tree view.

**Pros:**
- Very low complexity
- Fits current YAML conventions
- Easy to read in Markdown

**Cons:**
- Less visual than a graph
- Requires users to inspect metadata to see full relationships

**Effort:** 2-4 hours

**Risk:** Low

---

### Option 2: Dependency-aware grouping and filters

**Approach:** Extend filtering and tree grouping to show blocked tasks, unblocked tasks, and dependency chains.

**Pros:**
- Better operational value than metadata alone
- Helps with triage and planning

**Cons:**
- More UI and filtering logic to design carefully
- Needs consistent semantics for blocked vs. backlogged semantics

**Effort:** 4-6 hours

**Risk:** Medium

## Recommended Action

Implement explicit dependency metadata support and expose it in the task UI with easy filtering and blocked-task awareness. This makes the task manager more actionable for multi-step work and multi-agent handoffs.

## Technical Details

Affected files:
- `src/todos/todoModel.ts`
- `src/todos/filterService.ts`
- `src/todos/todoTreeProvider.ts`
- relevant frontmatter parsing and validation logic

Related components:
- task description template
- work-log and dependencies conventions in the skill docs

## Resources

- [resources/skill/SKILL.md](../../resources/skill/SKILL.md)
- [resources/skill/assets/todo-template.md](../../resources/skill/assets/todo-template.md)

## Acceptance Criteria

- [x] Todo files can declare blockers or dependencies
- [x] The tree view or filters can surface dependency-aware items
- [x] Blocked tasks are easy to identify without reading every file
- [x] Dependency metadata remains compatible with the existing markdown conventions

## Work Log

### 2026-08-13 - Initial Discovery

**By:** Copilot

**Actions:**
- Reviewed the existing skill template and confirmed dependency metadata is already a supported concept
- Identified this as a natural next step from status and priority management

**Learnings:**
- Dependency support is already partly modeled, so the main work is surfacing it in the UX and filters
- This adds real operational value for large task sets

### 2026-08-19 - Completion

**By:** Kilo Code

**Actions:**
- Verified dependency parsing, editing, blocked-state icons, tooltips, and filters
- Corrected blocked, unblocked, and blocker relationship filter semantics
- Confirmed the full VS Code extension suite passes with 29 tests

**Learnings:**
- The dependency model is complete; repository-level graph caching is tracked separately in todo 013

## Notes

- This should be implemented in a low-friction, repo-native way to keep the extension lean
- It should complement the tree view rather than replace it
