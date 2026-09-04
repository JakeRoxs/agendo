---
status: backlog
priority: p3
issue_id: "028"
tags: [vscode, extension, ux, export]
dependencies: []
---

# Export Todos — CSV/JSON

## Problem Statement

Users may need to migrate todos to other tools, generate reports, or share todo lists with team members. Currently, Agendo has no export functionality — users must manually copy or use VS Code's file APIs.

**Why it matters:** Export is a basic expectation for any tracking tool. Without it, users are locked into Agendo's format, making migration or reporting difficult.

## Proposed Solutions

### Option 1: CSV export

**Approach:** Add a command that exports all todos to a CSV file with columns for ID, status, priority, title, tags, dependencies, etc.

**Pros:**
- Universal format, works with Excel, Google Sheets, etc.
- Easy to filter/sort externally
- Low complexity

**Cons:**
- CSV is lossy (no nested data)
- Limited formatting options

**Effort:** 2–3 hours
**Risk:** Low

---

### Option 2: JSON export

**Approach:** Export todos as a JSON array with full metadata.

**Pros:**
- Preserves all data (tags, dependencies, etc.)
- Easy to parse programmatically
- Good for migration

**Cons:**
- Less human-readable
- Requires code to consume

**Effort:** 2–3 hours
**Risk:** Low

---

### Option 3: Both + import

**Approach:** Support both export formats and add import to reverse the process.

**Pros:**
- Complete migration story
- Flexible for different use cases

**Cons:**
- More code to maintain
- Import validation complexity

**Effort:** 4–6 hours
**Risk:** Medium

---

## Recommended Action

**Option 1 + 2:** Start with both export formats. Import can be added later if demand exists.

## Technical Details

**Affected files:**
- `src/commandRegistration.ts` — export command handlers
- `src/todos/todoRepository.ts` — snapshot all todos
- `src/commands.ts` — add `ExportTodos` command ID
- `package.json` — command registration, menu entries

**Related components:**
- `ConfigService` — for root folder resolution
- `Repository` — for listing todos

## Acceptance Criteria

- [ ] CSV export command works
- [ ] JSON export command works
- [ ] Export includes all relevant fields
- [ ] File is saved to user-specified location
- [ ] Error handling for permissions, disk full, etc.
- [ ] Compile + lint + tests pass

## Resume Context

**Current state:** Awaiting implementation.

**Next step:** Implement CSV export in `commandRegistration.ts`.
