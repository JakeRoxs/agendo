---
status: cancelled
priority: p3
issue_id: "018"
tags: [performance, extension, packaging, cancelled]
dependencies: []
---

# Add `activationEvents` to Defer Extension Activation

> **CANCELLED**

VS Code 1.74 and newer automatically derives activation for contributed commands and views. The
extension requires VS Code `^1.103.0`, so explicit `onView` and `onCommand` entries are redundant.

## Problem Statement

`package.json:28` has `"activationEvents": []` (empty). This means the extension activates on **any** VS Code event — effectively immediately on VS Code startup. For a tree-view extension that only needs the Agendo view, this wastes memory and CPU during startup for users who never open the view.

## Findings

- `package.json:28` — empty activationEvents
- The extension creates a tree view (`agendo.todos`) and a status bar item
- No commands are invoked before the user interacts with the view
- VS Code docs recommend `onView:<viewId>` for tree-view extensions

## Proposed Solutions

### Option 1: Add `onView:agendo.todos` (recommended)

```json
"activationEvents": ["onView:agendo.todos"]
```

**Pros:**
- Defers all initialization until the user opens the Agendo view
- Reduces VS Code startup time and extension memory footprint
- Standard pattern for tree-view extensions

**Cons:**
- Commands like `agendo.createTodo` invoked from the command palette will now trigger activation (acceptable)

**Effort:** 5 min

**Risk:** Low

### Option 2: Add multiple events

```json
"activationEvents": ["onView:agendo.todos", "onCommand:agendo.createTodo"]
```

**Pros:**
- Activates slightly earlier for command-palette users

**Cons:**
- `onView` already covers this; redundant

**Effort:** 5 min

**Risk:** Low

## Recommended Action

Option 1. Add `onView:agendo.todos` to `package.json`. Verify the extension still activates correctly when the view is opened and when commands are invoked.

## Technical Details

**Affected files:**
- `package.json` — add `activationEvents`

## Acceptance Criteria

- [ ] `activationEvents` contains `onView:agendo.todos`
- [ ] Extension activates when the Agendo view is opened
- [ ] Extension activates when any `agendo.*` command is invoked
- [ ] `npm vscode:preprep` succeeds

## Work Log

### 2026-08-19 - Cancelled After Documentation Review

**By:** Kilo Code

**Actions:**
- Verified the activation behavior against the current official VS Code activation-events reference
- Confirmed contributed commands and views have implied activation since VS Code 1.74
- Cancelled the todo because its premise that an empty array means wildcard startup activation is incorrect

**Learnings:**
- Only the explicit `"*"` activation event requests startup activation
- Agendo's minimum VS Code version already supports generated command and view activation events
