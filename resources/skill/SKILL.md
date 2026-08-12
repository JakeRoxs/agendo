---
name: agendo
description: This skill should be used when managing the file-based todo tracking system in the docs/todos/ directory. It provides workflows for creating todos, managing status and dependencies, conducting triage, and integrating with slash commands and code review processes.
disable-model-invocation: true
version: 1.1.0
---

# Agendo — File-Based Todo Tracking Skill

## Overview

The `docs/todos/` directory contains a file-based tracking system for managing code review feedback, technical debt, feature requests, and work items. Each todo is a markdown file with YAML frontmatter and structured sections.

This skill should be used when:

- Creating new todos from findings or feedback
- Managing todo lifecycle (pending → ready → complete, plus backlogged and cancelled)
- Triaging pending items for approval
- Checking or managing dependencies
- Converting PR comments or code findings into tracked work
- Updating work logs during todo execution

## Read `.todos-config.json` first

Before doing anything else, check for a `.todos-config.json` file in the todos root
(default `docs/todos/.todos-config.json`). The [Agendo VS Code extension](https://github.com/JakeRoxs/agendo)
writes this file as a projection of its settings so this skill can honor the user's chosen
configuration. When present, it looks like:

```json
{
  "root": "docs/todos",
  "gitignored": true,
  "backlogFolder": "backlog",
  "cancelledFolder": "cancelled",
  "completeFolder": "complete"
}
```

Honor it as follows:

- **`root`** — use this as the base path for every operation below instead of the default `docs/todos`.
- **`gitignored`** — pick a file-discovery strategy:
    - `false` (folder is tracked): workspace glob/search is safe (still avoid the `**/` pitfall below).
    - `true` (folder is git-ignored): **do not rely on workspace glob/search** — ignored files are
      often excluded from results. List the directory directly instead
      (`list_dir`, `Get-ChildItem`, `ls`, `find`).
- **`backlogFolder` / `cancelledFolder` / `completeFolder`** — use these subfolder names for the
  corresponding terminal/parked states.

**Degrade gracefully when the file is absent:** fall back to the `docs/todos` default root and the
list-the-directory discovery strategy described throughout this document. This skill is fully
self-contained and does **not** require the extension — the extension is a convenience/control
layer, not a hard dependency.

## File Naming Convention

Todo files follow this naming pattern:

```
{issue_id}-{status}-{priority}-{description}.md
```

**Components:**

- **issue_id**: Sequential number (001, 002, 003...) - never reused
- **status**: one of the lifecycle states below
- **priority**: `p1` (critical), `p2` (important), `p3` (nice-to-have)
- **description**: kebab-case, brief description

**Status values:**

| Status       | Meaning                                   | Folder                    |
| ------------ | ----------------------------------------- | ------------------------- |
| `pending`    | Needs triage                              | root (`docs/todos/`)      |
| `ready`      | Approved / ready to work                  | root (`docs/todos/`)      |
| `backlogged` | Deprioritized but still open              | `docs/todos/backlog/`     |
| `complete`   | Finished successfully (terminal)          | `docs/todos/complete/`    |
| `cancelled`  | Abandoned / superseded (terminal)         | `docs/todos/cancelled/`   |

**Examples:**

```
001-pending-p1-mailer-test.md
002-ready-p1-fix-n-plus-1.md
005-complete-p2-refactor-csv.md
053-cancelled-p2-superseded-by-057.md
061-backlogged-p3-nice-to-have-polish.md
```

## Folder Layout

- **Active** todos (`pending` / `ready`) live **directly** in the root folder (`docs/todos/`),
  NOT in a subfolder.
- Each terminal/parked state has its **own sibling subfolder** under the root:
    - `complete/` — finished successfully.
    - `cancelled/` — abandoned or superseded.
    - `backlog/` — deprioritized but still open.
- **`docs/todos/**/*.md` glob pitfall:** a recursive glob with `**/` requires an intermediate
  subdirectory, so it MISSES the active todos sitting directly in the root and only matches the
  subfolders. Use a directory listing (`list_dir docs/todos`) or a flat glob (`docs/todos/*.md`)
  for active items, and list each subfolder separately for terminal/parked items.
- Per-todo images live in `assets/{id}/` and **stay in place** even after the todo file moves to
  `complete/`, `cancelled/`, or `backlog/`. Do not move the assets when the todo moves.

## File Structure

Each todo is a markdown file with YAML frontmatter and structured sections. Use the template at [todo-template.md](./assets/todo-template.md) as a starting point when creating new todos.

**Required sections:**

- **Problem Statement** - What is broken, missing, or needs improvement?
- **Findings** - Investigation results, root cause, key discoveries
- **Proposed Solutions** - Multiple options with pros/cons, effort, risk
- **Recommended Action** - Clear plan (filled during triage)
- **Acceptance Criteria** - Testable checklist items
- **Work Log** - Chronological record with date, actions, learnings

**Optional sections:**

- **Technical Details** - Affected files, related components, DB changes
- **Resources** - Links to errors, tests, PRs, documentation
- **Notes** - Additional context or decisions

**YAML frontmatter fields:**

```yaml
---
status: ready # pending | ready | backlogged | complete | cancelled
priority: p1 # p1 | p2 | p3
issue_id: "002"
tags: [rails, performance, database]
dependencies: ["001"] # Issue IDs this is blocked by
---
```

An external tracking key is optional. Add it only when the todo is associated
with work in Jira, GitHub, or another tracker:

```yaml
key: "JIRA-123"
```

Do not add an empty `key`, and do not automatically include the key in the todo
title or filename. Existing `jira:` fields are supported as a legacy alias.

**Two coupled sources of truth:** the filename status token AND the frontmatter `status` must stay
in sync, and the folder placement is **derived** from the status. When transitioning a todo, update
all three together (filename token, frontmatter, folder).

## Common Workflows

### Creating a New Todo

**To create a new todo from findings or feedback:**

1. Determine next issue ID. **Always list the actual todos directory contents first — never trust an empty file-search result.**
    - **CRITICAL:** The active todo files live *directly* inside the root (e.g. `034-pending-p1-...md`). A recursive glob like `docs/todos/**/*.md` will MISS them. Use a directory listing (`list_dir docs/todos`) or a flat glob (`docs/todos/*.md`) — NOT `docs/todos/**/*.md`. An "empty"/"no files found" result is not proof the folder is empty; verify by listing the directory.
    - The next ID is the highest existing number (across the root AND every subfolder — `complete/`, `cancelled/`, `backlog/`) + 1, zero-padded to 3 digits. IDs are global and never reused, so check ALL locations.
    - Bash: `find docs/todos -maxdepth 2 -name '*.md' | grep -oE '[0-9]+' | sort -n | tail -1 | awk '{printf "%03d", $1+1}'`
    - PowerShell (Windows): `(Get-ChildItem docs\todos -Recurse -Filter *.md | ForEach-Object { if ($_.Name -match '^(\d+)') { [int]$Matches[1] } } | Measure-Object -Maximum).Maximum + 1 | ForEach-Object { '{0:D3}' -f $_ }`
2. Copy template: `cp assets/todo-template.md docs/todos/{NEXT_ID}-pending-{priority}-{description}.md`
3. Edit and fill required sections:
    - Problem Statement
    - Findings (if from investigation)
    - Proposed Solutions (multiple options)
    - Acceptance Criteria
    - Add initial Work Log entry
4. Determine status: `pending` (needs triage) or `ready` (pre-approved)
5. Add relevant tags for filtering
6. If an external issue or work item was provided, add its identifier as the optional `key` field.
7. **Verify the chosen ID is unique** before writing: confirm no existing file in the root or ANY subfolder (`complete/`, `cancelled/`, `backlog/`) already starts with that number. If a collision is found, bump to the next free number and keep both the filename prefix and the `issue_id` frontmatter field in sync.

**When to create a todo:**

- Requires more than 15-20 minutes of work
- Needs research, planning, or multiple approaches considered
- Has dependencies on other work
- Requires manager approval or prioritization
- Part of larger feature or refactor
- Technical debt needing documentation

**When to act immediately instead:**

- Issue is trivial (< 15 minutes)
- Complete context available now
- No planning needed
- User explicitly requests immediate action
- Simple bug fix with obvious solution

### Triaging Pending Items

**To triage pending todos:**

1. List pending items: `ls docs/todos/*-pending-*.md`
2. For each todo:
    - Read Problem Statement and Findings
    - Review Proposed Solutions
    - Make decision: approve, defer (backlog), or modify priority
3. Update approved todos:
    - Rename file: `mv {file}-pending-{pri}-{desc}.md {file}-ready-{pri}-{desc}.md`
    - Update frontmatter: `status: pending` → `status: ready`
    - Fill "Recommended Action" section with clear plan
    - Adjust priority if different from initial assessment
4. Deferred todos either stay in `pending` status or move to `backlogged` (see below).

**Use slash command:** `/triage` for interactive approval workflow

### Backlogging a Todo

**To deprioritize an open todo without cancelling it:**

1. Move the file into the backlog subfolder: `mv {file}-{status}-{pri}-{desc}.md docs/todos/backlog/{file}-backlogged-{pri}-{desc}.md`
2. Set frontmatter `status:` → `backlogged`.
3. Leave the `assets/{id}/` folder in place.

Backlogged items are **still open** but should be **excluded from active / "find next work" queries
and counts** (see below). To reactivate, move the file back to the root and set the status to
`pending` or `ready`.

### Cancelling a Todo

`cancelled` is a **terminal** state for work that is abandoned or superseded (as opposed to
`complete`, which is finished successfully).

1. Move the file into the cancelled subfolder: `mv {file}-{status}-{pri}-{desc}.md docs/todos/cancelled/{file}-cancelled-{pri}-{desc}.md`
2. Set frontmatter `status:` → `cancelled` and add a `cancelled` tag.
3. Insert a **contextual banner** directly under the `# title`:
    - `> **CANCELLED**` — abandoned.
    - `> **CANCELLED / SUPERSEDED by [057]**` — superseded by another todo (add `superseded_by: "057"` to frontmatter).
4. Leave the `assets/{id}/` folder in place.

To reopen a cancelled todo, move it back to the root, set the status to `pending`/`ready`, and
remove the `CANCELLED` banner.

### Managing Dependencies

**To track dependencies:**

```yaml
dependencies: ["002", "005"]  # This todo blocked by issues 002 and 005
dependencies: []               # No blockers - can work immediately
```

**To check what blocks a todo:**

```bash
grep "^dependencies:" docs/todos/003-*.md
```

**To find what a todo blocks:**

```bash
grep -R -l 'dependencies:.*"002"' docs/todos/
```

**To verify blockers are complete before starting:**

```bash
for dep in 001 002 003; do
  [ -f "docs/todos/complete/${dep}-complete-*.md" ] || echo "Issue $dep not complete"
done
```

### Updating Work Logs

**When working on a todo, always add a work log entry:**

```markdown
### YYYY-MM-DD - Session Title

**By:** Claude Code / Developer Name

**Actions:**

- Specific changes made (include file:line references)
- Commands executed
- Tests run
- Results of investigation

**Learnings:**

- What worked / what didn't
- Patterns discovered
- Key insights for future work
```

Work logs serve as:

- Historical record of investigation
- Documentation of approaches attempted
- Knowledge sharing for team
- Context for future similar work

### Completing a Todo

**To mark a todo as complete:**

1. Verify all acceptance criteria checked off
2. **Move the file first, before editing its contents**: `mv {file}-ready-{pri}-{desc}.md docs/todos/complete/{file}-complete-{pri}-{desc}.md`
3. Now edit the file **at its new `docs/todos/complete/` path**: set frontmatter `status: ready` → `status: complete` and add the final Work Log entry
4. Check for unblocked work: `grep -l 'dependencies:.*"002"' docs/todos/*-ready-*.md`
5. Commit with issue reference: `feat: resolve issue 002`

> **Order matters — move before you edit.** In editors that stage AI edits for accept/reject (e.g. VS Code Copilot "Keep/Accept Changes"), editing a file and *then* moving it causes the accepted edit to re-materialize the file at its **original** path, leaving a stale duplicate in `docs/todos/` next to the real one in `docs/todos/complete/`. Always `mv` to the target subfolder first, then make the frontmatter/work-log edits against the new path. If a stale duplicate does reappear after accepting, the subfolder copy is authoritative — delete the top-level one.

## Active vs. Terminal Status Rules

When answering "what's next", counting work, or picking up new tasks:

- **Active** = `pending` and `ready` only. These are the states eligible for "find next work".
- **`backlogged`** is open but **deprioritized** — exclude it from active / find-next-work queries
  and counts unless explicitly asked about the backlog.
- **`complete`** and **`cancelled`** are both **terminal** — exclude both from active work. Keep them
  distinguishable in queries and counts: `complete` = finished successfully, `cancelled` = abandoned.

## Integration with Development Workflows

| Trigger     | Flow                                               | Tool                 |
| ----------- | -------------------------------------------------- | -------------------- |
| Code review | `/workflows:review` → Findings → `/triage` → Todos | Review agent + skill |
| PR comments | `/resolve_pr_parallel` → Individual fixes → Todos  | gh CLI + skill       |
| Code TODOs  | `/resolve_todo_parallel` → Fixes + Complex todos   | Agent + skill        |
| Planning    | Brainstorm → Create todo → Work → Complete         | Skill                |
| Feedback    | Discussion → Create todo → Triage → Work           | Skill + slash        |

## Quick Reference Commands

**Finding work:**

```bash
# List highest priority unblocked active work (excludes backlogged/complete/cancelled)
grep -l 'dependencies: \[\]' docs/todos/*-ready-p1-*.md

# List all pending items needing triage
ls docs/todos/*-pending-*.md

# List backlogged items (open but deprioritized)
ls docs/todos/backlog/*.md

# Find next issue ID (checks root + all subfolders)
find docs/todos -maxdepth 2 -name '*.md' | grep -oE '[0-9]+' | sort -n | tail -1 | awk '{printf "%03d", $1+1}'

# Count by status
for status in pending ready backlogged complete cancelled; do
  case "$status" in
    complete) path="docs/todos/complete" ;;
    cancelled) path="docs/todos/cancelled" ;;
    backlogged) path="docs/todos/backlog" ;;
    *) path="docs/todos" ;;
  esac
  echo "$status: $(ls -1 $path/*-$status-*.md 2>/dev/null | wc -l)"
done
```

## Agendo sub-agent workflow (runSubagent)

This section describes how a parent agent should delegate todo ID tracking to the `agendo` agent as a sub-agent. Do not treat these as direct CLI commands; they are internal agent handoffs.

1. From your task agent (e.g., `coding` or `review`), call `agendo` as a sub-agent to fetch todo metadata.
    - parent prompt example:
      `runSubagent({ agentName: "agendo", prompt: "show status 021" })`
    - verify `status`, `priority`, `dependencies`, and `Work Log` entries in the returned object.

2. (Optional) Signal in-progress status via sub-agent call:
    - `runSubagent({ agentName: "agendo", prompt: "update 021 status in-progress" })`

3. Append work log entries incrementally through the sub-agent interface:
    - `runSubagent({ agentName: "agendo", prompt: "append 021 work log: added server-side protobuf handling, 2026-03-29, tests added" })`

4. Keep work log entries structured (date, author, actions, tests, results, learnings).
    - Include branch/PR references and commands run (`ctest`, `dotnet test`, etc.).

5. Resolve and complete through sub-agent call:
    - `runSubagent({ agentName: "agendo", prompt: "complete 021 summary: fixes + tests passed" })`
    - then rename/retag file status from `ready` to `complete` and update frontmatter.

> This workflow is intended to be used by a parent skill/agent orchestrating code tasks; `agendo` is invoked as a child skill for data updates and audit-safe state changes.

**Dependency management:**

```bash
# What blocks this todo?
grep "^dependencies:" docs/todos/003-*.md

# What does this todo block?
grep -R -l 'dependencies:.*"002"' docs/todos/
```

**Searching:**

```bash
# Search by tag
grep -l "tags:.*rails" docs/todos/*.md

# Search by priority
ls docs/todos/*-p1-*.md

# Full-text search
grep -r "payment" docs/todos/
```

## Key Distinctions

**Agendo system (this skill):**

- Markdown files in `docs/todos/` directory
- Development/project tracking
- Standalone markdown files with YAML frontmatter
- Used by humans and agents

**Rails Todo model:**

- Database model in `app/models/todo.rb`
- User-facing feature in the application
- Active Record CRUD operations
- Different from this file-based system

**TodoWrite tool:**

- In-memory task tracking during agent sessions
- Temporary tracking for single conversation
- Not persisted to disk
- Different from both systems above
