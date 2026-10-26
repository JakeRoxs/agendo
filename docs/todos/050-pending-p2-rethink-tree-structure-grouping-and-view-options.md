---
status: pending
priority: p2
issue_id: "050"
tags: [tree, views, grouping, settings, ux]
group: scanner-workflow
dependencies: []
---

# Rethink Tree Structure, Grouping, and View Options

The current tree structure with grouping works but feels unusual and clashes slightly with the "priority" concept. Space is running out in toolbar buttons and right-click menus. Consider a more consolidated settings/view panel, possibly handled via the canvas.

## Problem Statement

The tree currently organizes todos by status and priority, with grouping applied as an additional dimension. This creates a layout that:
- Feels unusual compared to conventional todo/task trees
- Clashes with the "priority" concept — priority grouping and task priority are different things but use similar visual language
- Consumes toolbar and context menu real estate that is running out

## Findings

- The current grouping approach is functional but not ideal UX-wise
- Toolbar buttons and right-click menus are approaching space limits
- A consolidated settings/view panel could reduce visual clutter
- The canvas could potentially host view configuration

## Recommended Action

Proposed for triage: Explore alternative tree organization approaches and a consolidated view/settings panel. Options to consider:
- Move view configuration (grouping, sorting, filtering) to a dedicated panel
- Use the canvas as a settings surface for view options
- Simplify the tree hierarchy to reduce visual complexity
- Preserve priority as a distinct concept from grouping

## Acceptance Criteria

- [ ] Tree structure clearly distinguishes grouping from priority
- [ ] View options are accessible without consuming excessive toolbar/menu space
- [ ] Settings panel (or canvas-hosted settings) consolidates view configuration
- [ ] User can switch between grouping modes (status, priority, group, none) easily
- [ ] Default view remains familiar to existing users

## Technical Details

Primary areas: tree provider, view options, toolbar, context menus, potentially canvas integration.

Related todo **054** owns the consolidated Settings/About surface, with its work-session entry immediately to the right of Edit. Keep tree hierarchy and grouping/priority decisions here; expose the resulting options through 054 rather than implementing a competing settings panel.

## Resume Context

**Current state:** Concept proposed by user; no implementation started.

**Next step:** Investigate current view options architecture and propose specific changes.

## Work Log

### 2026-10-26 - Settings Surface Scope Linked

**By:** Kilo

**Actions:**

- Linked todo 054 for the shared Extension/Board/Tree/About surface
- Retained tree organisation and view-mode decisions in this todo

### 2026-10-26 - Created

**By:** Kilo

**Actions:**

- Created todo based on user feedback about tree structure, grouping, and view options
- Identified need for consolidated settings panel and clearer distinction between grouping and priority
