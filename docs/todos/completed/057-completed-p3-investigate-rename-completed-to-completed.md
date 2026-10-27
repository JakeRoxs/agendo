---
status: completed
priority: p3
issue_id: "057"
tags: [naming, consistency, status]
dependencies: []
---

# Investigate Renaming "complete" Status to "completed"

## Problem Statement

The status value `complete` is an adjective, while other terminal/parked statuses use past participles: `backlogged` and `cancelled`. For consistency, `complete` should potentially be renamed to `completed`.

## Acceptance Criteria

- [x] Identify all locations where `complete` status is referenced (file names, frontmatter, source code, canvas code, skill docs, tests)
- [x] Assess the scope of changes required for the rename
- [x] Determine if this is a breaking change for existing todo files
- [x] Propose a migration strategy if the rename is approved
- [x] Document findings and recommendation

## Findings

### Scope of changes required

**Todo files (48 files):**
- 46 files with `status: complete` in frontmatter
- 48 files with `-complete-` in filename
- All would need filename rename and frontmatter update

**Extension source code (17 files):**
- `src/test/boardScopes.test.ts` — 4 references
- `src/test/scopedViews.test.ts` — 2 references
- `src/test/todoCollisions.test.ts` — 2 references
- `src/test/todoModel.test.ts` — 10+ references
- `src/test/standaloneCanvasSafety.test.ts` — 5 references
- `src/test/sharedBoardPresentation.test.ts` — 5 references
- `src/test/canvasWorkspace.test.ts` — 3 references
- `src/test/codeScanning.test.ts` — 3 references
- `src/test/canvasHostActions.test.ts` — 2 references
- `src/test/accomplishments.test.ts` — 17 references
- `src/todos/accomplishmentsService.ts` — 1 reference
- `src/todos/codeScanningService.ts` — 1 reference
- `src/todos/todoTreeProvider.ts` — 1 reference
- `src/todos/configService.ts` — 1 reference
- `src/todos/todoModel.ts` — 3 references
- `src/todos/statusService.ts` — 1 reference
- `src/todos/boardViewProvider.ts` — 1 reference

**Canvas code (1 file):**
- `resources/canvas/agendo-work-session/board.html` — 2 references

**Skill documentation (1 file):**
- `resources/skill/SKILL.md` — 20+ references to `complete` status

**Configuration:**
- `.agendo-config.json` uses `completeFolder` key (default value `complete`)
- `package.json` has no direct references

### Breaking change assessment

This is a **breaking change** for:
1. Existing todo files — all 48 would need to be renamed and updated
2. Any external tools or scripts that reference the `complete` status string
3. The `.agendo-config.json` `completeFolder` key (though the key name could stay the same)
4. Any user workflows that depend on the exact status string

### Migration strategy options

**Option A: Full rename with migration script**
- Rename all 48 todo files from `-complete-` to `-completed-`
- Update all frontmatter `status: complete` to `status: completed`
- Update all source code references
- Update skill documentation
- Add a migration script that runs on extension activation to handle any user-created files

**Option B: Accept both values**
- Update code to accept both `complete` and `completed` as valid status values
- Treat them as equivalent internally
- Gradually migrate files over time
- More complex, less clean

**Option C: Keep as-is**
- `complete` is a valid English adjective (e.g., "the task is complete")
- `backlogged` and `cancelled` are past participles used as adjectives
- The inconsistency is minor and the cost of change is high

### Recommendation

**Option A (full rename) is feasible using the existing reconciliation flow.** The agendo skill's reconciliation workflow already provides the machinery needed for a bulk status migration:

1. **Inventory**: The reconciliation flow builds a complete inventory of all todos, including their status, filename, and folder location.
2. **Batch processing**: It can process all 48 `complete` todos in a single pass, renaming files and updating frontmatter.
3. **User approval**: It presents all changes for user approval before applying them, so the user can review the full scope.
4. **Standard lifecycle**: It uses the same rename → move → edit pattern that all status transitions use, so no custom migration script is needed.

The migration would work as follows:
1. Run reconciliation with scope "all complete todos"
2. For each todo, the reconciliation flow would:
   - Rename the file from `-complete-` to `-completed-`
   - Update frontmatter from `status: complete` to `status: completed`
   - Move the file if the folder name changes (e.g., `complete/` → `completed/`)
3. Present all 48 changes for user approval
4. Apply changes after approval

**Remaining work beyond the reconciliation flow:**
- Update extension source code (17 files) to use `"completed"` instead of `"complete"`
- Update canvas code (1 file)
- Update skill documentation
- Update `.agendo-config.json` default for `completeFolder` if the folder name changes
- Run all tests to verify

**Risk assessment:**
- The reconciliation flow handles the todo file migration safely with user approval
- The source code changes are straightforward string replacements
- Tests will catch any missed references
- The main risk is forgetting to update a reference, but the test suite should catch this

**Conclusion:** The reconciliation flow makes the todo file migration low-risk and user-controlled. The source code changes are the bulk of the work but are mechanical. This is a viable p3 improvement that can be done incrementally.

## Resume Context

**Current state:** Complete. Rename implemented and verified.

**What was done:**
- Renamed all status value references from "complete" to "completed" across 20 production files and 18 test files
- Migrated 48 todo files: renamed filenames from -complete- to -completed- and updated frontmatter
- Updated extension TypeScript (todoModel, configService, statusService, todoTreeProvider, accomplishmentsService, codeScanningService, boardViewProvider)
- Updated canvas code (todos.mjs, page.mjs, server.mjs, extension.mjs, board.html, page.css, page.js)
- Updated skill documentation (SKILL.md, reconcile.md)
- All 322 tests pass; lint passes
- Bug found and fixed: canvas todoLocations() used old "complete" key that didn't match new status value

## Work Log

### 2026-10-26 - Rename implemented

**By:** Kilo

**Actions:**

- Renamed status value "complete" to "completed" across entire codebase (20 production files, 18 test files)
- Migrated 48 todo files (filename + frontmatter updates)
- Fixed bug in canvas todoLocations() that used old "complete" key
- All 322 tests pass, lint passes

### 2026-10-26 - Todo created

**By:** Copilot agent

**Actions:**

- Created todo to investigate renaming `complete` to `completed` for consistency with `backlogged` and `cancelled`
