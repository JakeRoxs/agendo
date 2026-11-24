---
status: completed
priority: p1
issue_id: "071"
tags: [vscode, workspace, multi-root, configuration]
dependencies: []
---

# Support Multiple Todo Roots in VS Code Workspaces

Handle multi-root VS Code workspaces by supporting separate todo roots per workspace folder and letting users select or switch the directory they are viewing.

## Problem Statement

In a VS Code workspace containing multiple separate project folders, Agendo currently resolves a single workspace folder and todo root. Users need to manage todos in more than one folder and switch between those roots without opening a separate VS Code window or confusing one project's todos with another's.

## Findings

- Workspace resolution currently uses the first workspace folder in relevant configuration and canvas paths.
- No existing todo tracks multiple todo roots or active-root switching.
- The diagnostics MCP path already requires a workspace-folder name when multiple roots are open; the todo MCP server instead captures one root from `process.cwd()` at startup.
- `agendo.root` currently has no VS Code folder scope, so it cannot vary per workspace folder.

## Recommended Action

- Keep one active todo root per VS Code window rather than maintaining multiple live repositories/watchers. Default to the first workspace folder for single-root/backward compatibility and persist the selected folder URI in extension workspace state.
- Make `agendo.root` resource-scoped and resolve it relative to the active workspace folder. Keep **Agendo: Choose Root** for the relative todo-directory path and add a distinct workspace-folder selector so the concepts are not conflated.
- Scope repository refresh/watchers, commands, scanner imports, dependencies, and canvas operations to the selected root. Rebind the existing repository/canvas when the user switches folders.
- Show the active workspace-folder name/root in the UI. Use the MCP `workspaceFolder` convention by name and resolve it through per-folder discovery records; retain CWD fallback for standalone use.
- Treat todo IDs as root-local: duplicate checks and ID allocation operate within the active root; identical IDs in separate roots are valid because operations carry root identity.
- Preserve empty/no-workspace behavior and default to the first folder if a saved selection no longer exists.

## Acceptance Criteria

- [x] Discover and represent todo roots associated with each applicable workspace folder in a multi-root workspace.
- [x] Provide a clear way to choose and switch the active todo root, and make the active root apparent in the UI.
- [x] Scope listing, creation, status changes, search, canvas views, and scanner imports to the selected root.
- [x] Preserve current behavior for single-folder workspaces and define behavior for folders without a configured todo root.
- [x] Avoid collisions or accidental cross-root status changes when different roots contain the same todo ID.
- [x] Document and test root selection, switching, and per-root configuration in a VS Code multi-root workspace.

## Resume Context

**Current state:** VS Code active-root selection, per-folder configuration, dynamic MCP discovery registration, and per-call MCP root resolution are implemented and validated. The final full extension run passed 491 tests; canvas tests passed 287. The MCP suite had 53 passing tests, zero failures, and three existing IPC handler cancellations. Crash logs show the VS Code test host exited normally after the suite; no crash report was found.

**Next step:** None; implementation and validation are complete.

## Work Log

### 2026-11-14 - Todo Created

**By:** Agent

**Actions:**

- Compared the request with workspace configuration and existing todos.
- Recorded the need for root selection and consistent scoping across extension features.

**Learnings:**

- Multi-root support must account for operations beyond displaying the todo list, especially duplicate IDs and scanner imports.

### 2026-11-24 - Start multi-root investigation

**By:** Kilo

**Actions:**

- Moved todo 071 to in-progress after the user asked to start work.
- Started separate repository investigations for the VS Code core and canvas/MCP integration; no source changes have been made yet.

**Learnings:**

- Multi-root changes require explicit root identity throughout selection, mutations, dependency resolution, and scanner imports; a tree-only switch would be incomplete.

### 2026-11-24 - Map canvas and MCP roots

**By:** Kilo

**Actions:**

- Confirmed the MCP todo handlers use one `workspaceRoot` computed from `process.cwd()` at module load and expose no root selector.
- Confirmed canvas operations accept an explicit root, but the VS Code `CanvasViewer` caches one instance and its caller currently chooses the first workspace folder.
- Found that diagnostics already requires an explicit `workspaceFolder` in multi-root workspaces; todo MCP tools can follow that contract once discovery records retain each folder path.

**Learnings:**

- Multi-root MCP routing needs workspace identity in discovery records; workspace-folder names alone are insufficient to derive filesystem roots in a standalone server.

### 2026-11-24 - Choose active-root architecture

**By:** Kilo

**Actions:**

- Selected a single-active-root model with a per-folder `agendo.root` setting, avoiding a registry of repositories and duplicate watcher state.
- Kept the existing path chooser distinct from the new workspace-folder selector so root-folder path and workspace-folder identity remain separate concepts.
- Added folder-aware configuration reads/writes, persisted active-folder selection, an explicit workspace-folder command, and repository watcher rebinding.
- Added 11 ConfigService/TodoRepository tests for multi-root selection, per-folder roots, stale-folder fallback, and watcher changes.

### 2026-11-24 - Integrate extension and discovery root identity

**By:** Kilo

**Actions:**

- Wired extension activation to construct ConfigService with `context.workspaceState` and changed the canvas opener to use the active todo-root URI.
- Registered per-folder MCP discovery records with their corresponding workspace paths while retaining the workspace-file alias.
- Restored ConfigService's canvas opener methods after compile exposed their accidental removal; `npm run compile` then passed.

**Learnings:**

- MCP discovery can identify the correct VS Code extension host, but todo handlers also need an explicit root choice because multiple workspace folders can share one bridge endpoint.

**Learnings:**

- Root identity must be carried through the extension repository and MCP discovery; a UI-only folder switch would still route writes/scanner imports to the wrong project.

### 2026-11-24 - Scope MCP todo tools per workspace

**By:** Kilo

**Actions:**

- Removed the MCP server's module-level todo root and routed todo reads/writes through per-invocation workspace-root resolution.
- Added optional `workspaceFolder` selectors to todo tools; ambiguous multi-root calls fail instead of silently choosing a folder.
- Preserved standalone CWD fallback and left the existing `get_problems` routing unchanged.
- Started committed regression tests for path selection, ambiguity, single-root fallback, and duplicate IDs across roots.
- Added committed MCP resolver tests for same-ID isolation, explicit and ambiguous selections, workspace-file aliases, CWD/single-root fallback, and host-PID filtering.
- `node --test resources/mcp/test/*.test.mjs`: 53 passed, 0 failed, 3 pre-existing handler tests canceled by IPC event-loop teardown.

### 2026-11-24 - Integrate active-root and MCP resolution

**By:** Kilo

**Actions:**

- Verified MCP root resolution with per-call `workspaceFolder`, same-ID isolation, ambiguity errors, and standalone fallback; committed regression tests were added.
- Full integration review found remaining command/projection consistency gaps and stale-folder reconciliation; assigned focused fixes before final validation.

**Learnings:**

- Multi-root correctness also requires settings-projection writes and watcher lifecycle to follow the same active-root change, not just path resolution.

### 2026-11-24 - Validate integration and investigate editor crash

**By:** Kilo

**Actions:**

- Ran `npm test`: 490 passing, 0 failing (compile and lint included).
- Ran `npm run test:canvas`: 287 passing, 0 failing.
- Ran `node --test resources/mcp/test/*.test.mjs`: 53 passing, 0 failing, 3 existing IPC-handler tests canceled at teardown.
- Final static review found MCP discovery directories are not refreshed after workspace-folder changes; an update is assigned.
- Recorded the user's report that VS Code crashed again and started investigating logs and root-change event handling.

### 2026-11-24 - Complete dynamic discovery integration

**By:** Kilo

**Actions:**

- Added live MCP discovery refresh on workspace-folder add/remove/reorder without replacing the IPC endpoint; stale records are removed and each current folder retains its own path.
- Re-ran `npm test`: 491 passing, 0 failing; `npm run compile` and Biome lint pass.
- Re-ran `npm run test:canvas`: 287 passing, 0 failing.
- Re-ran `node --test resources/mcp/test/*.test.mjs`: 53 passing, 0 failing, 3 existing IPC-handler tests canceled during teardown.
- Confirmed the test-run VS Code host exited normally with code 0 after tests; no Crashpad or core-dump evidence of an editor crash was found.

**Learnings:**

- Keeping endpoint paths stable while refreshing per-folder registration records avoids disrupting MCP clients when a workspace folder is added or removed.

### 2026-11-24 - Refresh bridge registrations and verify recovery

**By:** Kilo

**Actions:**

- Added `onDidChangeWorkspaceFolders` handling that reconciles the active folder, rebinds the repository watcher, and refreshes per-folder bridge discovery registrations without replacing the IPC endpoint.
- Added bridge tests for changing the discovery directory set while listening, removing stale registrations, and preserving each workspace path.
- Re-ran `npm test`: 490 passing, 0 failing; compile and lint passed.
- Re-ran `npm run test:canvas`: 287 passing, 0 failing.
- Re-ran `node --test resources/mcp/test/*.test.mjs`: 53 passing, 0 failing, 3 pre-existing IPC-handler tests cancelled at teardown.
- Investigated VS Code logs: the `.vscode-test` host terminated normally after the passing test run (exit code 0); Crashpad directories and core-dump searches were empty.

**Learnings:**

- The observed “crash” was the expected test-host shutdown, not a confirmed crash of the outer VS Code editor. No crash cause is supported by the available logs.
