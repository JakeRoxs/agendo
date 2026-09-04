---
status: backlog
priority: p3
issue_id: "032"
tags: [vscode, extension, ux, templates]
dependencies: []
---

# Todo Templates

## Problem Statement

Currently, Agendo uses a single default template for new todos. Different use cases (bug reports, feature requests, PR reviews, code reviews) may benefit from different pre-populated structures.

**Why it matters:** Templates reduce friction for common todo types and ensure consistent structure across the team/project.

## Proposed Solutions

### Option 1: Multiple built-in templates

**Approach:** Add template selection when creating a todo:
- "Default" — current template
- "Bug Report" — includes steps to reproduce, expected/actual behavior
- "Feature Request" — includes motivation, acceptance criteria
- "PR Review" — includes file paths, specific concerns

**Pros:**
- Immediately useful for common cases
- Simple to implement
- No external config needed

**Cons:**
- May not cover all use cases
- Templates become stale if not maintained

**Effort:** 3–5 hours
**Risk:** Low

---

### Option 2: User-defined templates

**Approach:** Allow users to define custom templates in `.agendo-config.json` or a templates folder.

**Pros:**
- Highly customizable
- Evolves with team needs
- No extension updates needed for new templates

**Cons:**
- More complex to implement
- Requires documentation
- May overwhelm casual users

**Effort:** 5–8 hours
**Risk:** Medium

---

### Option 3: Template from existing todo

**Approach:** Allow users to "clone" an existing todo as a template.

**Pros:**
- Leverages existing good examples
- No template maintenance
- Natural workflow

**Cons:**
- May propagate bad patterns
- Requires selecting source todo

**Effort:** 2–3 hours
**Risk:** Low

---

## Recommended Action

**Option 1:** Start with built-in templates. This provides immediate value with low risk. User-defined templates can be added later if demand exists.

## Technical Details

**Affected files:**
- `src/commandRegistration.ts` — template selection in create flow
- `src/todos/todoModel.ts` — template rendering
- `resources/skill/SKILL.md` — document templates
- `package.json` — template settings if needed

**Related components:**
- `renderTemplate()` — current template function
- `ConfigService` — template storage if needed

## Acceptance Criteria

- [ ] Template picker appears during todo creation
- [ ] Built-in templates render correctly
- [ ] User can still use custom description
- [ ] Templates are documented in README
- [ ] Compile + lint + tests pass

## Resume Context

**Current state:** Awaiting implementation.

**Next step:** Add template selection to `commandRegistration.ts`.
