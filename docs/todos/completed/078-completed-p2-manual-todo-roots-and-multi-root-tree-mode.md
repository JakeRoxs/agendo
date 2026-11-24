---
status: completed
priority: p2
issue_id: "078"
tags: [feature, multi-root, tree-view]
dependencies: []
---

# Manual Todo Roots and Multi-Root Tree Mode

Allow users to add todo roots that are not VS Code workspace folders and choose whether the tree shows one selected root or multiple named, collapsible roots at once.

## Problem Statement

Todo 071 added per-workspace-folder roots with a single active root. Users may also want to add arbitrary todo directories manually, and a single-root switch is not always enough when they need to see several projects together. The tree currently has no root registry or root grouping mode.

## Findings

- The current active-root model is centered on `vscode.WorkspaceFolder` and folder-scoped `agendo.root`.
- A manually added root may be outside `workspaceFolders`, so it needs its own stable identity, display name, and configuration scope.
- A multi-root tree mode is more than a visual group: commands, dependencies, links, scanning, and canvas opens must retain the root associated with each todo, even when duplicate IDs exist across roots.
- Single-root mode should preserve the behavior added by todo 071, including the workspace-folder selector.

## Recommended Action

- Introduce a persisted root registry keyed by canonical root URI. Each descriptor should carry a stable root key, display name, root URI, and source kind (`workspace` or `manual`); workspace roots derive their todo URI from folder-scoped `agendo.root`, while manual roots use the selected directory directly.
- Discover workspace-folder roots automatically, allow explicit add/remove of arbitrary filesystem roots, and deduplicate overlapping paths. Removing a manual root unregisters it without deleting its files; missing paths remain visibly unavailable until repaired or removed.
- Maintain one `TodoRepository` and scoped service context per root so IDs, dependencies, groups, scanner sequences, projections, watchers, filters, and tree state remain root-local.
- In single mode, retain the current active-root switch behavior. In multi mode, render each root as a named, collapsible top-level tree node with its own current status/group/todo hierarchy beneath it; do not add a wrapper in single mode.
- Route commands, status/priority/group/dependency changes, search, scanner imports, and canvas/MCP operations using the selected todo's root identity/URI, never a bare ID across roots.
- Persist the root registry and single/multi mode per VS Code workspace. Keep the existing `Choose Workspace Folder` behavior and add root management actions for manual roots.

## Acceptance Criteria

- [x] Users can manually add and remove a todo directory outside the current workspace folders without deleting its contents.
- [x] Workspace-folder roots and manually added roots coexist in a canonical, deduplicated registry with clear labels and unavailable-path handling.
- [x] Single-root mode preserves the current active-root selection behavior and tree shape.
- [x] Multi-root mode renders every configured root by name as a collapsible top-level tree node.
- [x] Each root has an isolated repository/service context; status, priority, dependency, group, search, scanner import, canvas, and MCP operations target the selected todo's owning root.
- [x] Duplicate todo IDs in different roots remain independent; dependencies do not cross roots implicitly.
- [x] Root registry, active root, and tree mode persist per VS Code workspace; missing/removed roots are handled safely.
- [x] Tests cover manual root management, mode switching, duplicate IDs, persistence, and root-scoped mutations while preserving single-root behavior.

## Resume Context

**Current state:** Manual/workspace roots, per-root repositories, single/multi tree modes, root-aware commands, CanvasViewer operations, and MCP manual-root selection are implemented. All acceptance criteria and validation now pass.

**Next step:** None; multi-root root management, tree rendering, and root-scoped operations are complete.

## Work Log

### 2026-11-24 - Record manual roots and multi-root tree request

**By:** Kilo

**Actions:**

- Recorded the request to support manual todo roots and single/multi tree presentation modes.
- Identified that multi-root display requires root identity to flow through operations, not just an additional tree grouping.
- User confirmed that multiple roots must not be merged into a flat list; each root will remain a named, collapsible parent with root-local state.
- Added the root catalog foundation for workspace/manual descriptors, root identity, active root, and `single`/`multi` mode persistence.
- Static investigation confirmed one repository, one tree hierarchy, root-agnostic node keys, and no root attribution in `Todo`; per-root repositories/contexts are needed to preserve ID and dependency isolation.
- Added isolated `RootContext` objects with one ConfigService and TodoRepository per root, preserving root-local IDs and dependency graphs.
- Lead review found the initial single-root manual-root commands did not consistently persist/restore the RootRegistry active id; a focused correction and tests are underway before tree integration.

**Learnings:**

- The existing active-root repository is a useful single-root compatibility path but cannot safely aggregate multiple roots without attributing each todo and command to its source root.

### 2026-11-24 - Bind canvas actions to root contexts

**By:** Kilo

**Actions:**

- Bound CanvasViewer opening to each root context so workspace and manual-root todos open using their owning root and root mode.
- Added direct manual-root loading in the canvas todo scanner and root-scoped host actions for status/group/board/digest operations.
- `npm run test:canvas`: 287 passing, 0 failing; the agent reports TypeScript and lint checks pass.

### 2026-11-24 - Integrate shared root registry into commands

**By:** Kilo

**Actions:**

- Added `resolveRootForTodo(todo)` to `TodoRootRegistry` to match a todo's URI against each root's repository, returning the owning root context.
- Added `rootRegistry?: TodoRootRegistry` to `CommandServices`; `registerCommands` now consumes the supplied shared registry instead of constructing a second instance (falls back to constructing one for backward compatibility).
- Added `ToggleTreeMode` command ID (`agendo.toggleTreeMode`) and a `toggleTreeMode` command that toggles `registry.getMode()`/`setMode()` and shows a confirmation message.
- Added `resolveRootServices(registry, services, arg)` helper that resolves a command argument (TreeNode/TreeItem) to the owning root's config/repository by exact resource URI across every root's repository, falling back to the active root when no todo is selected. Returns undefined for stale selections (safe no-op). Never resolves by bare ID.
- Routed status, priority, group, dependency, delete, preview, and canvas commands through the owning root's config/repository/service. Each command creates a root-scoped `StatusService` and `LinkService` when a todo is selected.
- Added `package.json` command and menu items for `agendo.toggleTreeMode` (command, view/title menu item, command palette item).
- Updated `rootCommands.test.ts` to provide a shared `TodoRootRegistry`; added tests for ToggleTreeMode persistence, OpenPreview operating on the owning root when IDs collide, and stale TreeItem safe no-op.
- Current focused results: MultiRootTreeProvider 9/9, RootRegistry 21/21, and rootCommands 10/10 pass.

**Learnings:**

- Resolving by exact resource URI (never bare ID) prevents cross-root mutation when IDs collide.
- Falling back to the active root for commands without a selected todo preserves single-root behavior.

### 2026-11-24 - Integrate root tree and identify final test regressions

**By:** Kilo

**Actions:**

- Integrated the root registry and `MultiRootTreeProvider` for both Todos and Code Scanning views; single mode keeps the prior hierarchy, while multi mode shows named root containers.
- Added per-root collapse-state persistence, root-aware command routing, and the tree-mode toggle.
- Ran the full VS Code suite: 541 passing, 10 failing. Three right-click/root-context tests and one activation assertion fail; six MCP bridge tests time out. Assigned separate investigations rather than classifying them as pre-existing.
- Re-ran the full VS Code suite after fixture and bridge-test fixes: 551 passing, 0 failing.

**Learnings:**

- A passing multi-root tree unit suite is not enough; the full activation/IPC harness must validate registry construction and bridge lifecycle together.
- Creating root-scoped StatusService/LinkService per command ensures status/priority/group/dependency operations target the correct root's config/repository.

### 2026-11-24 - Route context-menu actions by owning root

**By:** Kilo

**Actions:**

- Updated command resolution to use the active repository for internal TreeNodes and to resolve VS Code TreeItems by exact URI across root contexts; bare todo IDs are never used across roots.
- Adjusted context-menu tests to create files under the selected root and account for terminal status folders; the focused status tests now pass.
- Final full-suite validation is recorded in the verification entry below.

### 2026-11-24 - Route canvas operations through root context

**By:** Kilo

**Actions:**

- Confirmed root-context `ConfigService` instances do not yet have the shared CanvasViewer opener, so multi-root `OpenCanvas` can fall back to text preview.
- Assigned root-aware opener binding and direct manual-root loading so canvas operations target the selected todo root.

### 2026-11-24 - Extend root-scoped canvas to manual roots

**By:** Kilo

**Actions:**

- Bound a CanvasViewer opener to each root context; workspace roots use their workspace-folder URI and manual roots use direct-root mode.
- Threaded the root mode through canvas server operations and added manual-root direct discovery.
- Noted that standalone MCP discovery still publishes workspace-folder roots only; manual-root MCP selection remains the final acceptance gap.

### 2026-11-24 - Publish manual roots to MCP

**By:** Kilo

**Actions:**

- Added `rootMode` and display labels to per-root MCP discovery registrations, including manual roots.
- Updated MCP todo handlers to resolve `{ workspaceRoot, rootMode }` per invocation and route manual-root calls through direct-root filesystem mode; diagnostics remain workspace-folder scoped.
- Added same-ID workspace/manual isolation and dynamic discovery-refresh tests.

### 2026-11-24 - Verify manual-root MCP and full integration

**By:** Kilo

**Actions:**

- `npm test`: 560 passing, 0 failing; compile and lint stages succeeded.
- `npm run test:canvas`: 287 passing, 0 failing.
- `node --test resources/mcp/test/*.test.mjs`: 54 passing, 0 failing, 3 IPC handler tests canceled by the existing Node test-runner socket teardown behavior.
- Bumped the bundled canvas metadata to `0.1.13` for manual-root support.
- `git diff --check`: passed.
- Verified per-root tree sections, duplicate-ID isolation, manual-root CanvasViewer direct-root mode, and MCP workspace/manual root selection through regression tests.

**Learnings:**

- Multi-root safety depends on carrying root identity through tree contexts, canvas host actions, and MCP discovery rather than deduplicating todo IDs globally.
