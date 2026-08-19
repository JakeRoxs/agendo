---
status: complete
priority: p3
issue_id: "019"
tags: [code-quality, extension]
dependencies: []
---

# Extract `extension.ts` Command Registration into Grouped Helpers

## Problem Statement

`extension.ts` has grown beyond 600 lines and mixes activation lifecycle, command handlers, filter UI, and todo creation. This makes it hard to find specific behavior and obscures the extension's composition root.

## Findings

- `extension.ts` is now 632 lines after recent workflow features
- `extension.ts:164-447` — single `registerCommands` function
- No logical grouping; handlers are interleaved by rough topic but not separated
- `runFilterPicker` (line 430) and `createTodo` (line 536) are module-level helpers already — more extraction would be consistent

## Proposed Solutions

### Option 1: Extract grouped registration functions (recommended)

```ts
function registerTodoCommands(context, services) { /* setStatus, setPriority, setDependency, setGroup, openPreview */ }
function registerFilterCommands(context, services) { /* refresh, filter, search, clearFilters */ }
function registerConfigCommands(context, services) { /* chooseRoot, toggleGitignore, togglePreview, setDefault.* */ }
function registerSkillCommands(context, skill, refreshStatusBar) { /* enableSkill, updateSkill */ }
function registerTreeCommands(context, treeState, treeProvider) { /* collapseNode, expandNode */ }
```

**Pros:**
- Each group is ~40-60 lines, easy to navigate
- Clear ownership of each command family
- Easy to add/remove commands within a group

**Cons:**
- More function signatures to maintain
- `services` object is still passed to each

**Effort:** 1.5 hours

**Risk:** Low (mechanical refactor, no behavior change)

### Option 2: Extract one cohesive command-registration module

Move command registration, filter-picker behavior, and todo creation into `src/commandRegistration.ts`. Keep five internal registration functions grouped by responsibility.

**Pros:**
- Makes `extension.ts` a small composition and lifecycle module
- Avoids a directory of shallow one-function files
- Keeps tightly coupled picker and command behavior together

**Cons:**
- The command module remains intentionally substantial

**Effort:** 2 hours

**Risk:** Low

## Recommended Action

Option 2, revised as a single deep module. Extract five grouped registration functions and their private helpers into `commandRegistration.ts`; keep `extension.ts` as the composition layer.

## Technical Details

**Affected files:**
- `src/extension.ts` — retain activation and lifecycle composition
- `src/commandRegistration.ts` — own command families and private UI helpers
- `src/test/todoModel.test.ts` — verify extension activation test still passes (it tests command registration indirectly)

## Acceptance Criteria

- [x] `extension.ts` is under 400 lines
- [x] Each command group has its own function
- [x] `npm test` passes
- [x] `biome check` passes

## Resume Context

**Current state:** Complete. Extension lifecycle composition and command/UI orchestration are separated.

**Next step:** Add future commands to the matching command family in `commandRegistration.ts`.

## Work Log

### 2026-08-19 - Extraction Started

**By:** Kilo Code

**Actions:**
- Recounted `extension.ts` at 632 lines
- Rejected same-file helper extraction because it cannot satisfy the line-count acceptance criterion
- Selected one cohesive command-registration module rather than many shallow command files

**Learnings:**
- The stable boundary is service composition versus command/UI orchestration, not one file per command family

### 2026-08-19 - Completion

**By:** Kilo Code

**Actions:**
- Added `commandRegistration.ts` for command services, registration, picker behavior, and todo creation
- Grouped filter, todo, configuration, skill, and tree command families into dedicated functions
- Reduced `extension.ts` from 632 lines to 120 lines
- Updated the README project structure
- Ran `npm test`: 32 passing; TypeScript compilation and Biome checks clean

**Learnings:**
- A single deep command module keeps related orchestration discoverable without fragmenting it across shallow files
