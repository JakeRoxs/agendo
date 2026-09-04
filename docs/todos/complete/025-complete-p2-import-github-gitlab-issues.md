---
status: complete
priority: p2
issue_id: "025"
tags: [vscode, extension, integration, github, gitlab]
dependencies: []
---

# Import from GitHub/GitLab Issues

## Problem Statement

Users often discover work items through PR comments, GitHub issues, or GitLab merge requests. Currently, Agendo requires manual creation of todos from these findings. A direct import workflow would reduce friction and ensure findings are tracked.

**Why it matters:** Finding → tracking is a common workflow. Reducing steps encourages users to capture work items instead of losing them in chat or PR threads.

## Proposed Solutions

### Option 1: GitHub/GitLab issue import command

**Approach:** Add commands to create todos from GitHub/GitLab issues or PR comments. Use the GitHub/GitLab API to fetch issue details.

**Pros:**
- Direct integration with existing workflows
- Auto-populates title, description, tags
- Can link back to the original issue

**Cons:**
- Requires auth setup (tokens, etc.)
- API rate limits
- More complex implementation

**Effort:** 6–10 hours
**Risk:** Medium

---

### Option 2: Paste-to-create from clipboard

**Approach:** Detect when user pastes a GitHub/GitLab issue URL or formatted text, and offer to create a todo.

**Pros:**
- Simple, low-friction
- No auth required
- Works with any source (copy-paste from anywhere)

**Cons:**
- Less structured than API import
- Manual step required

**Effort:** 2–3 hours
**Risk:** Low

---

### Option 3: Slash command in skill

**Approach:** Add a `/import-issue` or `/from-github` command to the Agendo skill that guides the model to create todos from issue URLs.

**Pros:**
- Extends to any agent host
- Leverages existing skill infrastructure
- No extension changes needed

**Cons:**
- Depends on model understanding
- Less reliable than direct UI

**Effort:** 1–2 hours
**Risk:** Low

---

## Recommended Action

**Option 2 + Option 3:** Start with paste-to-create (low effort, immediate value) and add slash command to the skill (extends to agent workflows). API integration can follow if demand exists.

## Technical Details

**Affected files:**
- `src/commandRegistration.ts` — import command handlers
- `src/todos/todoModel.ts` — parse issue data into todo fields
- `resources/skill/SKILL.md` — add import workflow
- `resources/skill/reconcile.md` — potentially update

**Related components:**
- `StatusService` — for creating the initial todo
- `Repository` — for refresh after creation

## Acceptance Criteria

- [ ] User can paste a GitHub/GitLab issue URL and create a todo
- [ ] Title and description are populated from the issue
- [ ] Tags can be optionally added
- [ ] External key is set to the issue number/URL
- [ ] Slash command works in agent context
- [ ] Compile + lint + tests pass

## Resume Context

**Current state:** Awaiting implementation.

**Next step:** Implement paste-to-create in `commandRegistration.ts`.
