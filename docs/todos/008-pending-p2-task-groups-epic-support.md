---
status: pending
priority: p2
issue_id: "008"
tags: [groups, epics, organization, workflow]
dependencies: []
---

# Task Groups and Epic-Like Organization

Add grouping or epic-like task organization so related work can be rolled up and tracked together without losing the granular task detail underneath.

## Problem Statement

As the task list grows, some work naturally belongs together as a larger initiative. Without a way to group related items, the task list becomes harder to reason about and easier to lose context on what is a part of a broader effort.

## Findings

- The repo already has strong status and priority organization.
- A logical next layer is grouping related todos into a higher-level thematic container.
- This helps both human triage and AI handoff because the broader objective is explicit.
- The concept feels aligned with an “epic” model without requiring a full project management system.

## Proposed Solutions

### Option 1: Lightweight group tags and grouping

**Approach:** Add group/epic metadata to todo files and allow the tree view to build collapsible groups around it.

**Pros:**
- Simple, file-based, and easy to reason about
- Fits markdown conventions well
- Useful for both humans and agents

**Cons:**
- Group semantics must be carefully designed to avoid overcomplication
- Some tasks may belong to multiple groups

**Effort:** 3-5 hours

**Risk:** Low

---

### Option 2: Group hierarchy with epic summaries

**Approach:** Allow a group to have a summary file or title and nested subtasks.

**Pros:**
- Better for large initiatives
- Stronger for roadmap and planning work

**Cons:**
- More metadata and UI complexity
- Higher maintenance burden in the extension

**Effort:** 6-9 hours

**Risk:** Medium

## Recommended Action

Implement lightweight task groups using metadata tags or explicit grouping fields, with enough structure to support epic-like organization without turning Agendo into a full project tracker.

## Technical Details

Affected files:
- `src/todos/todoModel.ts`
- `src/todos/todoTreeProvider.ts`
- `src/todos/filterService.ts`
- task parsing and UI grouping logic

Related components:
- existing tag support
- future board and dependency features

## Resources

- current tag-based filtering in the repo
- skill and template conventions for metadata and work tracking

## Acceptance Criteria

- [ ] Related tasks can be grouped under a common umbrella concept
- [ ] Grouping remains lightweight and file-based
- [ ] Users can still filter and manage tasks individually within a group
- [ ] The pattern supports both human planning and agent handoff workflows

## Work Log

### 2026-08-13 - Initial Discovery

**By:** Copilot

**Actions:**
- Reviewed the repo’s existing grouping model based on status and priority
- Identified “epic-like” grouping as the next conceptual layer for organization

**Learnings:**
- The extension already has a strong single-task model; group support should be additive
- This supports planning without overloading the product with project management features

## Notes

- Keep the user-facing model simple: a few group labels and optional metadata first
- The first version should help organization, not become a mini PM tool
