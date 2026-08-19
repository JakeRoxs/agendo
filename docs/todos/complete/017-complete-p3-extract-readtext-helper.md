---
status: complete
priority: p3
issue_id: "017"
tags: [code-quality, extension]
dependencies: []
---

# Extract `readText(uri)` Helper to Avoid Repeated Buffer Wrapping

## Problem Statement

The pattern `Buffer.from(bytes).toString("utf8")` is repeated after filesystem reads. It is verbose, easy to get wrong (e.g. forgetting the encoding), and obscures the intent.

## Findings

Current production locations with the pattern:
- `todoRepository.ts:77` — `scanFolder`
- `statusService.ts:64,88,101,125` — status/priority/dependency/group changes
- `linkService.ts:74` — `scanFolderForName`
- `skillManager.ts:51` — skill metadata version read

## Proposed Solutions

### Option 1: Small helper in `output.ts` or a new `fs.ts` module (recommended)

```ts
export async function readText(uri: vscode.Uri): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  return Buffer.from(bytes).toString("utf8");
}
```

**Pros:**
- Single source of truth
- Easy to add encoding or error handling later
- Self-documenting

**Cons:**
- New module or export

**Effort:** 30 min

**Risk:** Low

### Option 2: Extension-level utility in `extension.ts` only

Keep it local to `extension.ts` if only used there.

**Pros:**
- No new file

**Cons:**
- `todoRepository.ts` and others still have the pattern

**Effort:** 15 min

**Risk:** Low

## Recommended Action

Option 1. Add `readText` to a dedicated `src/todos/fileSystem.ts` module. Replace all seven production callsites.

## Technical Details

**Affected files:**
- New or existing utility module
- `src/todos/todoRepository.ts`
- `src/todos/statusService.ts`
- `src/todos/linkService.ts`
- `src/todos/skillManager.ts`

## Acceptance Criteria

- [x] No raw `Buffer.from(bytes).toString("utf8")` remains outside the production helper
- [x] `npm test` passes
- [x] `biome check` passes

## Resume Context

**Current state:** Complete. All seven production read/decode callsites use the shared helper.

**Next step:** Use `readText()` for future workspace text reads.

## Work Log

### 2026-08-19 - Implementation Started

**By:** Kilo Code

**Actions:**
- Recounted current production callsites after recent repository changes
- Chose a focused filesystem module rather than placing IO concerns in `output.ts`

**Learnings:**
- Repository reads can retain parallel stat behavior by composing `readText()` with `workspace.fs.stat()`

### 2026-08-19 - Completion

**By:** Kilo Code

**Actions:**
- Added `src/todos/fileSystem.ts` with the shared UTF-8 `readText()` helper
- Migrated TodoRepository, StatusService, LinkService, and SkillManager callsites
- Preserved concurrent repository text/stat reads
- Added direct multibyte UTF-8 decoding coverage
- Ran `npm test`: 32 passing; TypeScript compilation and Biome checks clean

**Learnings:**
- A focused filesystem module keeps encoding concerns out of unrelated output and domain services
