---
status: backlog
priority: p3
issue_id: "030"
tags: [vscode, extension, search, ux]
dependencies: []
---

# Search Improvements

## Problem Statement

Agendo's search is currently a simple text match against ID, title, tag, and key fields. Users may want more powerful search capabilities: regex patterns, boolean operators, saved searches, and search history.

**Why it matters:** As todo counts grow, basic search becomes insufficient. Power users need advanced search to find specific items quickly.

## Proposed Solutions

### Option 1: Regex search

**Approach:** Add a regex search mode where users can use regex patterns in the search box.

**Pros:**
- Powerful for pattern matching
- Familiar to developers
- Relatively simple to implement

**Cons:**
- Regex can be confusing for non-technical users
- Error handling for invalid regex

**Effort:** 2–3 hours
**Risk:** Low

---

### Option 2: Boolean operators

**Approach:** Support `AND`, `OR`, `NOT` in search queries:
- `login AND p1` → todos with "login" and priority P1
- `auth OR payment` → todos with either tag
- `blocked NOT complete` → blocked but not complete

**Pros:**
- Precise filtering
- Familiar to power users
- No regex learning curve

**Cons:**
- Parsing complexity
- May need UI for ease of use

**Effort:** 3–5 hours
**Risk:** Medium

---

### Option 3: Saved searches

**Approach:** Allow users to save常用 searches with names:
- "My P1s" → `priority:p1`
- "Blocked by me" → `blocked:true`
- "This week" → `created:this-week`

**Pros:**
- Quick access to常用 views
- Personalized workflow
- Reduces repeated typing

**Cons:**
- Storage management
- Sync across workspaces

**Effort:** 4–6 hours
**Risk:** Medium

---

### Option 4: Search history

**Approach:** Remember recent searches in the search box dropdown.

**Pros:**
- Low effort, high value
- Familiar pattern (like browser history)
- No storage complexity

**Cons:**
- Limited functionality

**Effort:** 1 hour
**Risk:** Very Low

---

## Recommended Action

**Option 4 + Option 1:** Start with search history (quick win) and add regex search (high value for power users). Boolean operators and saved searches can follow.

## Technical Details

**Affected files:**
- `src/todos/filterService.ts` — search logic
- `src/todos/todoTreeProvider.ts` — search UI
- `src/commandRegistration.ts` — search command updates
- `package.json` — search settings if needed

**Related components:**
- `FilterService` — current search implementation
- `TreeStateService` — for persisting saved searches

## Acceptance Criteria

- [ ] Search history appears in dropdown
- [ ] Regex search works with valid patterns
- [ ] Invalid regex shows error message
- [ ] Compile + lint + tests pass

## Resume Context

**Current state:** Awaiting implementation.

**Next step:** Add search history to the search input.
