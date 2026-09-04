---
status: complete
priority: p2
issue_id: "024"
tags: [vscode, extension, ux, visualization]
dependencies: []
---

# Dependency Visualization

## Problem Statement

Agendo tracks dependencies between todos via frontmatter `dependencies` arrays, and the tree view shows a "blocked" indicator for todos with incomplete dependencies. However, there is no visual representation of the dependency graph — users must mentally trace links across the tree or board.

**Why it matters:** As todo counts grow, understanding the dependency chain becomes harder. A visual graph helps users see blockers, critical paths, and the overall structure of their work at a glance.

## Proposed Solutions

### Option 1: Tree view indentation

**Approach:** Indent dependent todos under their blockers in the tree, showing the hierarchy visually.

**Pros:**
- Simple, consistent with existing tree structure
- No new UI surface needed
- Works well for linear dependency chains

**Cons:**
- Only shows parent-child, not full graph
- Can create deep nesting with long chains
- Doesn't show cross-dependencies well

**Effort:** 2–3 hours
**Risk:** Low

---

### Option 2: Board column with dependency groups

**Approach:** Add a new "Blocked" or "Dependencies" column to the board that shows todos grouped by their blockers.

**Pros:**
- Visual separation of blocked work
- Complements existing board layout
- Easy to scan

**Cons:**
- Requires board layout changes
- May clutter the board if many todos are blocked

**Effort:** 3–4 hours
**Risk:** Medium

---

### Option 3: Dedicated dependency graph view

**Approach:** Add a new tree node or view that renders a dependency graph (possibly using mermaid.js or a simple tree layout).

**Pros:**
- Full graph visualization
- Can show complex dependency structures
- Educational for understanding project structure

**Cons:**
- New UI surface to design and maintain
- May be overkill for simple projects
- Requires graph layout logic

**Effort:** 5–8 hours
**Risk:** Medium

---

## Recommended Action

**Option 1: Tree view indentation.** Start with simple indentation in the tree to show parent-child dependency relationships. This is low-effort, low-risk, and immediately useful. Can evolve into Option 3 if demand grows.

## Technical Details

**Affected files:**
- `src/todos/todoTreeProvider.ts` — tree node rendering, dependency traversal
- `src/todos/todoModel.ts` — dependency graph utilities
- `src/todos/skillStatusTreeProvider.ts` — potentially add a "Dependencies" node
- `package.json` — menu entries if needed

**Related components:**
- `TodoRepository.getDependencyGraph()` — returns `blockedBy` and `blocking` maps
- `StatusService` — dependency mutation logic

## Acceptance Criteria

- [ ] Dependent todos are indented under their blockers in the tree
- [ ] Linear chains show clear parent-child relationships
- [ ] Cross-dependencies are indicated (e.g., "also blocked by NNN")
- [ ] Collapsing a parent collapses all dependents
- [ ] Compile + lint + tests pass

## Resume Context

**Current state:** Awaiting implementation.

**Next step:** Implement tree indentation in `todoTreeProvider.ts`.
