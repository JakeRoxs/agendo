---
status: pending
priority: p3
issue_id: "057"
tags: [naming, consistency, status]
dependencies: []
---

# Investigate Renaming "complete" Status to "completed"

## Problem Statement

The status value `complete` is an adjective, while other terminal/parked statuses use past participles: `backlogged` and `cancelled`. For consistency, `complete` should potentially be renamed to `completed`.

## Acceptance Criteria

- [ ] Identify all locations where `complete` status is referenced (file names, frontmatter, source code, canvas code, skill docs, tests)
- [ ] Assess the scope of changes required for the rename
- [ ] Determine if this is a breaking change for existing todo files
- [ ] Propose a migration strategy if the rename is approved
- [ ] Document findings and recommendation

## Resume Context

**Current state:** Pending investigation.

**Next step:** Survey all references to `complete` status across the codebase and documentation.

## Work Log

### 2026-10-26 - Todo created

**By:** Copilot agent

**Actions:**

- Created todo to investigate renaming `complete` to `completed` for consistency with `backlogged` and `cancelled`
