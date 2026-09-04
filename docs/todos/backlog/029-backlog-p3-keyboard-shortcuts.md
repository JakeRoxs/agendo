---
status: backlog
priority: p3
issue_id: "029"
tags: [vscode, extension, ux, keyboard]
dependencies: []
---

# Keyboard Shortcuts

## Problem Statement

Users currently interact with Agendo through context menus, quick picks, and toolbar buttons. While functional, this requires mouse navigation. Keyboard-only users or power users may want faster ways to change todo status, priority, or navigate the tree.

**Why it matters:** Keyboard shortcuts improve efficiency and accessibility. Many VS Code users prefer keyboard-first workflows.

## Proposed Solutions

### Option 1: Status change shortcuts

**Approach:** Add keybindings for common status changes:
- `Ctrl+Shift+1` → Set status: Pending
- `Ctrl+Shift+2` → Set status: In Progress
- `Ctrl+Shift+3` → Set status: Ready
- `Ctrl+Shift+4` → Set status: Complete
- `Ctrl+Shift+5` → Set status: Cancelled

**Pros:**
- Fast, muscle-memory friendly
- Covers the most common actions
- Simple to implement

**Cons:**
- Limited number of shortcuts
- May conflict with existing VS Code bindings

**Effort:** 1–2 hours
**Risk:** Low

---

### Option 2: Priority shortcuts

**Approach:** Add keybindings for priority changes:
- `Ctrl+Shift+P` → Set priority: P1
- `Ctrl+Shift+O` → Set priority: P2
- `Ctrl+Shift+L` → Set priority: P3

**Pros:**
- Covers priority changes without menus
- Complements status shortcuts

**Cons:**
- More shortcuts to memorize
- May conflict

**Effort:** 30 minutes
**Risk:** Low

---

### Option 3: Tree navigation shortcuts

**Approach:** Add keybindings for tree navigation:
- `Ctrl+J` → Focus Agendo tree
- `Ctrl+K` → Collapse/expand node
- Arrow keys → Navigate tree

**Pros:**
- Full keyboard navigation
- Consistent with VS Code conventions

**Cons:**
- Requires tree focus management
- More complex implementation

**Effort:** 2–3 hours
**Risk:** Medium

---

## Recommended Action

**Option 1 + 2:** Start with status and priority shortcuts. These are the highest-frequency actions and easiest to implement.

## Technical Details

**Affected files:**
- `package.json` — keybindings configuration
- `src/commandRegistration.ts` — register shortcuts if needed
- `src/commands.ts` — add shortcut command IDs if needed

**Related components:**
- VS Code keybinding system
- Existing command registrations

## Acceptance Criteria

- [ ] Status shortcuts work with a todo selected
- [ ] Priority shortcuts work with a todo selected
- [ ] Shortcuts don't conflict with VS Code defaults
- [ ] Shortcut hints appear in menus (optional)
- [ ] Compile + lint + tests pass

## Resume Context

**Current state:** Awaiting implementation.

**Next step:** Add keybindings to `package.json`.
