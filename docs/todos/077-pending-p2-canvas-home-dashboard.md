---
status: pending
priority: p2
issue_id: "077"
tags: [canvas, dashboard, navigation]
dependencies: []
---

# Add a Canvas Home Dashboard

Add a home page to the full Agendo Canvas that gives users an entry point to the current todo root and its todos, along with shortcuts to code-scanning workflows and Settings.

## Problem Statement

The full Agendo Canvas should provide a useful landing page instead of requiring users to know which view to open first. Users need to see the todo tree for the active root and navigate to todos, while retaining direct access to importing code-scanning todos, the code-scanning board/list, and Settings. The tree overview and scanner-specific navigation are distinct needs: the home page should expose the full current-root todo tree and separately provide scanner workflow entry points.

## Acceptance Criteria

- [ ] The full Agendo Canvas has a home/dashboard page that serves as a clear entry point to its todo and scanner workflows.
- [ ] The dashboard displays or links to the full todo tree for the active root, not only code-scanning todos.
- [ ] Users can navigate normally from the tree to an individual todo and back to the dashboard without losing the selected root context.
- [ ] The dashboard provides a clear action to import code-scanning todos; its label and behavior identify the existing import workflow without assuming a particular command name.
- [ ] The dashboard provides a distinct entry point to the code-scanning board/list, separate from the full todo-tree view.
- [ ] The dashboard provides an entry point to Settings.
- [ ] The active root is clearly identified, and changing roots updates the displayed tree and root context of subsequent navigation.
- [ ] An empty todo root has a useful empty state that explains there are no todos and still exposes available import and navigation actions.
- [ ] Dashboard navigation and actions are keyboard accessible, have meaningful accessible names, and expose focus state and appropriate semantic structure.
- [ ] Tests cover dashboard rendering, full-tree visibility and navigation, scanner import and board/list entry points, Settings navigation, root changes, and the empty state.

## Resume Context

**Current state:** This is a planned feature; no dashboard implementation has been started.

**Next step:** Inspect the full Canvas navigation, root-selection, todo-tree, scanner-board/import, and Settings routes/actions, then choose route names and action wiring that match the existing application rather than assuming unsupported commands.

## Work Log

### 2026-11-27 - Todo Created

**By:** Kilo

**Actions:**

- Recorded the requested Canvas home/dashboard scope and acceptance criteria for the full active-root todo tree, separate scanner workflow entry points, Settings, accessibility, empty state, and tests.

**Learnings:**

- Route names and action wiring remain for implementation discovery; no unsupported command names are assumed.
