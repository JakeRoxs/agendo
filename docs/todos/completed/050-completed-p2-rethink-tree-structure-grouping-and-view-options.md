---
status: completed
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

- [x] Tree structure clearly distinguishes grouping from priority
- [x] View options are accessible without consuming excessive toolbar/menu space
- [x] Settings panel (or canvas-hosted settings) consolidates view configuration
- [x] User can switch between grouping modes (status, priority, group, none) easily
- [x] Default view remains familiar to existing users

## Technical Details

Primary areas: tree provider, view options, toolbar, context menus, potentially canvas integration.

Related todo **054** owns the consolidated Settings/About surface, with its work-session entry immediately to the right of Edit. Keep tree hierarchy and grouping/priority decisions here; expose the resulting options through 054 rather than implementing a competing settings panel.

## Resume Context

**Current state:** Complete. Configurable grouping modes (status, priority, group, none) implemented with toolbar button, quick pick command, and canvas settings page integration. Default grouping mode is "status" for familiarity.

**Next step:** Move to complete directory.

## Work Log

### 2026-10-26 - Settings Page Integration

**By:** Kilo

**Actions:**

- Added View Options section to canvas settings page with groupBy mode selector
- Added `set-group-by` settings action handler in extension
- Passed current groupBy value to settings page via `getSettingsInfo`
- All 313 extension tests and 34 canvas tests pass
- All acceptance criteria verified

### 2026-10-26 - Grouping Modes Implemented

**By:** Kilo

**Actions:**

- Investigated tree view and view options architecture
- Added `agendo.groupBy` setting with options: status (default), priority, group, none
- Modified `getChildren()` in `todoTreeProvider.ts` to build hierarchy dynamically based on grouping mode
- Added `priorityNodesRoot` and `groupNodesRoot` methods for root-level priority/group grouping
- Added `agendo.setGroupBy` command with quick pick for switching modes
- Added toolbar button in `view/title` menu (group `2_config@8`)
- All 313 extension tests pass

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
