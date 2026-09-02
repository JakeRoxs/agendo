---
name: agendo
description: This skill should be used when managing the file-based todo tracking system in the docs/todos/ directory. It provides workflows for creating todos, managing status and dependencies, conducting triage, reconciling/auditing todos against the current codebase, and integrating with slash commands and code review processes.
disable-model-invocation: true
version: 1.4.1
---

# Agendo — File-Based Todo Tracking Skill

## Overview

The `docs/todos/` directory contains a file-based tracking system for managing code review feedback, technical debt, feature requests, and work items. Each todo is a markdown file with YAML frontmatter and structured sections.

This skill should be used when:

- Creating new todos from findings or feedback
- Managing todo lifecycle (pending → in-progress → ready → complete, plus backlogged and cancelled)
- Triaging pending items for approval
- Checking or managing dependencies
- Reconciling or auditing todos against the current codebase
- Converting PR comments or code findings into tracked work
- Updating work logs during todo execution

## Read `.agendo-config.json` first

Before doing anything else, resolve the todos root and check for `.agendo-config.json` there. Start
with `docs/todos/.agendo-config.json`. If it is absent and the default root does not exist, inspect
the workspace's `agendo.root` setting or directly locate `.agendo-config.json`; a custom-root
configuration file lives inside that custom root. The
[Agendo VS Code extension](https://github.com/JakeRoxs/agendo) writes this file as a projection of
its settings so this skill can honor the user's chosen configuration.

**The file only exists when something differs from the defaults:** fields equal to their default
are never written, and the file itself is removed when every setting is default. Apply these
defaults to any missing key — or to the whole configuration when the file is absent:

| Key               | Default      |
| ----------------- | ------------ |
| `root`            | `docs/todos` |
| `gitignored`      | `false`      |
| `backlogFolder`   | `backlog`    |
| `cancelledFolder` | `cancelled`  |
| `completeFolder`  | `complete`   |

Example of a config with a single non-default setting:

```json
{
  "gitignored": true
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

After resolving configuration, use these placeholders throughout this skill:

- **`{root}`** — configured todos root (default `docs/todos`).
- **`{backlog}`** — `{root}/{backlogFolder}`.
- **`{cancelled}`** — `{root}/{cancelledFolder}`.
- **`{complete}`** — `{root}/{completeFolder}`.
- **`{skill_dir}`** — directory containing this `SKILL.md` file.

Examples below use placeholders rather than shell variables. Replace them with resolved paths
before running a command. `{file}` means the current todo filename stem; it is not shell brace
expansion.

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

| Status        | Meaning                                                          | Folder        |
| ------------- | ---------------------------------------------------------------- | ------------- |
| `pending`     | Needs triage / not yet started                                    | `{root}`      |
| `in-progress` | Actively being worked on                                          | `{root}`      |
| `ready`       | Likely done, being tweaked/bug-fixed; needs confirmation it works | `{root}`      |
| `backlogged`  | Deprioritized but still open                                      | `{backlog}`   |
| `complete`    | Fully finished and verified (terminal)                            | `{complete}`  |
| `cancelled`   | Abandoned / superseded (terminal)                                 | `{cancelled}` |

**Examples:**

```
001-pending-p1-mailer-test.md
002-in-progress-p1-fix-n-plus-1.md
003-ready-p1-verify-n-plus-1-fix.md
005-complete-p2-refactor-csv.md
053-cancelled-p2-superseded-by-057.md
061-backlogged-p3-nice-to-have-polish.md
```

## Folder Layout

- **Active** todos (`pending` / `in-progress` / `ready`) live **directly** in `{root}`, NOT in a
  subfolder.
- Each terminal/parked state has its **own sibling subfolder** under the root:
  - `complete/` — finished successfully.
  - `cancelled/` — abandoned or superseded.
  - `backlog/` — deprioritized but still open.
- Recursive-glob behavior varies by tool: some `**/*.md` implementations include root files and
  others do not. For deterministic discovery, list `{root}/*.md` for active items and each
  configured state subfolder separately. When `gitignored` is `true`, use a direct directory
  listing rather than a workspace search index.
- Per-todo images live in `assets/{id}/` and **stay in place** even after the todo file moves to
  `complete/`, `cancelled/`, or `backlog/`. Do not move the assets when the todo moves.

## File Structure

Each todo is a markdown file with YAML frontmatter and structured sections. Use the template at [todo-template.md](./assets/todo-template.md) as a starting point when creating new todos.

**Core sections emitted by the extension and required for every todo:**

- **Problem Statement** - What is broken, missing, or needs improvement?
- **Acceptance Criteria** - Testable checklist items
- **Resume Context** - Compact current state and next action for restarting work
- **Work Log** - Chronological record with date, actions, learnings

**Add when the work needs investigation or triage:**

- **Findings** - Investigation results, root cause, key discoveries
- **Proposed Solutions** - Meaningfully different options with pros/cons, effort, and risk
- **Recommended Action** - Clear selected plan, normally filled during triage

Do not manufacture multiple solutions for a straightforward task. The full template includes these
sections as prompts, while the extension's Create Todo command intentionally emits only the core
scaffold.

**Optional sections:**

- **Technical Details** - Affected files, related components, DB changes
- **Resources** - Links to errors, tests, PRs, documentation
- **Notes** - Additional context or decisions

**YAML frontmatter fields:**

```yaml
---
status: ready # pending | in-progress | ready | backlogged | complete | cancelled
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

**Authoritative filename, synchronized mirror:** the extension derives status and priority from the
filename tokens. Frontmatter `status` and `priority` are human-readable mirrors and must match the
filename. Folder placement is derived from status. If filename and frontmatter disagree, the
extension follows the filename. When transitioning a todo, update filename, frontmatter, and folder
placement together.

## Common Workflows

### Creating a New Todo

**To create a new todo from findings or feedback:**

1. Determine next issue ID. **Always list the actual todos directory contents first — never trust an empty file-search result.**
   - Active todo files live directly inside `{root}`. List `{root}` and each configured state
     subfolder explicitly so discovery is independent of recursive-glob semantics and search-index
     exclusions.
   - The next ID is the highest existing leading filename ID across all locations + 1,
     zero-padded to 3 digits. IDs are global and never reused.
   - GNU/Linux Bash: `find "{root}" -maxdepth 2 -type f -name '[0-9][0-9][0-9]-*.md' -printf '%f\n' | cut -d- -f1 | sort -n | tail -1 | awk '{printf "%03d", $1+1}'`
   - PowerShell: `(Get-ChildItem "{root}" -Recurse -Filter *.md | ForEach-Object { if ($_.Name -match '^(\d{3})-') { [int]$Matches[1] } } | Measure-Object -Maximum).Maximum + 1 | ForEach-Object { '{0:D3}' -f $_ }`
2. Copy the template from the skill directory: `cp "{skill_dir}/assets/todo-template.md" "{root}/{NEXT_ID}-pending-{priority}-{description}.md"`
3. Edit and fill the core sections:
   - Problem Statement
   - Acceptance Criteria
   - Initialize Resume Context with the current state and first next step
   - Add initial Work Log entry
   - Add Findings, Proposed Solutions, and Recommended Action when investigation or triage warrants
     them
4. Determine status: `pending` (needs triage) or `ready` (pre-approved)
5. Add relevant tags for filtering
6. If an external issue or work item was provided, add its identifier as the optional `key` field.
7. **Verify the chosen ID is unique** before writing: confirm no existing file in `{root}` or any
   configured state subfolder starts with that number. If a collision is found, bump to the next
   free number and keep both the filename prefix and `issue_id` frontmatter in sync.

**When to create a todo:**

- Requires more than 15-20 minutes of work
- Needs research, planning, or multiple approaches considered
- Has dependencies on other work
- Requires explicit approval or prioritization
- Part of larger feature or refactor
- Technical debt needing documentation

**When to act immediately instead:**

- Issue is trivial (< 15 minutes)
- Complete context available now
- No planning needed
- User explicitly requests immediate action
- Simple bug fix with obvious solution

### Triaging Pending Items

> **Rename or move first, then edit the destination.** This applies to every lifecycle or priority
> transition. VS Code Copilot may stage edits against the original path; editing before a rename can
> recreate a stale copy when the change is accepted. After moving, perform all frontmatter, banner,
> and work-log edits using only the new path.

**To triage pending todos:**

1. List pending items: `ls "{root}"/*-pending-*.md`
2. For each todo:
   - Read Problem Statement and Findings
   - Review Proposed Solutions
   - Make decision: approve, defer (backlog), or modify priority
3. Update approved todos:
   - First rename the file: `mv "{root}/{file}-pending-{pri}-{desc}.md" "{root}/{file}-in-progress-{pri}-{desc}.md"`
   - Then update frontmatter at the new path: `status: pending` → `status: in-progress`
   - Fill "Recommended Action" at the new path with a clear plan
   - Adjust priority if different from initial assessment
4. Deferred todos either stay in `pending` status or move to `backlogged` (see below).

**Optional integration:** use `/triage` for an interactive approval workflow only when that slash
command is installed in the host environment.

### Starting / Progressing Work

When a triaged `in-progress` todo is actively being worked on, keep it `in-progress` and update
its Resume Context and Work Log as you go. When implementation is believed to be done (but not yet
confirmed as working), move it to `ready` so it can be verified:

- `mv "{root}/{file}-in-progress-{pri}-{desc}.md" "{root}/{file}-ready-{pri}-{desc}.md"`
- Update frontmatter: `status: in-progress` → `status: ready`

A `ready` todo is a candidate for completion — confirm it works and meets acceptance criteria
before moving it to `complete`.

### Backlogging a Todo

**To deprioritize an open todo without cancelling it:**

1. Move the file into the backlog subfolder: `mv "{root}/{file}-{status}-{pri}-{desc}.md" "{backlog}/{file}-backlogged-{pri}-{desc}.md"`
2. Set frontmatter `status:` → `backlogged`.
3. Leave the `assets/{id}/` folder in place.

Backlogged items are **still open** but should be **excluded from active / "find next work" queries
and counts** (see below). To reactivate, move the file back to the root and set the status to
`pending` or `ready`.

### Cancelling a Todo

`cancelled` is a **terminal** state for work that is abandoned or superseded (as opposed to
`complete`, which is finished successfully).

1. Move the file into the cancelled subfolder: `mv "{root}/{file}-{status}-{pri}-{desc}.md" "{cancelled}/{file}-cancelled-{pri}-{desc}.md"`
2. Set frontmatter `status:` → `cancelled` and add a `cancelled` tag.
3. Insert a **contextual banner** directly under the `# title`:
   - `> **CANCELLED**` — abandoned.
   - `> **CANCELLED / SUPERSEDED by [057]**` — superseded by another todo (add `superseded_by: "057"` to frontmatter).
4. Leave the `assets/{id}/` folder in place.

To reopen a cancelled todo, first move it back to the root with the new status in its filename.
Then, at the new path, set the frontmatter status to `pending`/`ready` and remove the `CANCELLED`
banner.

### Managing Dependencies

**To track dependencies:**

```yaml
dependencies: ["002", "005"]  # This todo blocked by issues 002 and 005
dependencies: []               # No blockers - can work immediately
```

**To check what blocks a todo:**

```bash
grep "^dependencies:" "{root}"/003-*.md
```

**To find what a todo blocks:**

```bash
grep -R -l 'dependencies:.*"002"' "{root}"
```

**To verify blockers are complete before starting:**

```bash
for dep in 001 002 003; do
  terminal_file=$(find "{complete}" "{cancelled}" -maxdepth 1 -type f \
    \( -name "${dep}-complete-*.md" -o -name "${dep}-cancelled-*.md" \) -print -quit)
  [ -n "$terminal_file" ] || echo "Issue $dep is not terminal"
done
```

Both `complete` and `cancelled` satisfy dependencies by design. Cancellation means the dependency
will not be delivered, so dependent work must be reassessed rather than remain mechanically
blocked.

### Updating Work Logs

**When working on a todo, always add a work log entry:**

```markdown
### YYYY-MM-DD - Session Title

**By:** Agent or developer name

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
- Durable context across personal work sessions and agents
- Context for future similar work

### Resuming and Pausing Work

`Resume Context` is a compact snapshot, not a second Work Log. Keep it to two fields:

```markdown
## Resume Context

**Current state:** Dependency graph implementation is complete and validated.

**Next step:** Add file watcher debouncing and burst-event coverage.
```

- Do not add `owner`, assignment, or team-mode fields by default.
- Keep structured blockers in frontmatter `dependencies`; do not duplicate them in Resume Context.
- Keep attempts, commands, test results, and learnings in the Work Log.
- Derive recency from the latest Work Log entry rather than maintaining a separate `last_updated` field.

**When resuming a todo:**

1. Read its status, priority, dependencies, and group metadata.
2. Read Resume Context for the current state and next action.
3. Read the latest Work Log entry for recent actions, results, and learnings.
4. Verify dependencies against the current todo repository and inspect relevant code before changing it.
5. Continue from the documented next step, adjusting it if the repository has changed.

**Before pausing or handing execution to another agent:**

1. Update `Current state` to describe what is true now, not a session history.
2. Set one concrete `Next step` that can be acted on without rereading unrelated context.
3. Update `dependencies` if structured blockers changed.
4. Append a Work Log entry with actions, validation, and learnings.

This workflow is individual-first: it supports returning after a break or switching AI agents. The
same files may still be repository-tracked and shared without requiring collaboration-specific
metadata.

### Completing a Todo

`complete` is for work that is fully finished and verified. Only move a `ready` todo here once it
is confirmed done and functional.

**To mark a todo as complete:**

1. Verify all acceptance criteria checked off and the work is confirmed working
2. **Move the file first, before editing its contents**: `mv "{root}/{file}-ready-{pri}-{desc}.md" "{complete}/{file}-complete-{pri}-{desc}.md"`
3. Edit only the file at its new `{complete}` path: set frontmatter `status: ready` →
   `status: complete` and add the final Work Log entry.
4. Check for newly unblocked active work: `grep -l 'dependencies:.*"002"' "{root}"/*-{pending,in-progress,ready}-*.md`

Do not commit, push, or create a pull request unless the user explicitly requests it.

> **Order matters — move before you edit.** In editors that stage AI edits for accept/reject (e.g.
> VS Code Copilot "Keep/Accept Changes"), editing and then moving can re-materialize the original
> file when the edit is accepted. Always move first and edit only the destination. If a stale copy
> appears, treat the moved copy as authoritative, preserve any unique changes, and remove the stale
> original.

## Active vs. Terminal Status Rules

When answering "what's next", counting work, or picking up new tasks:

- **Active** = `pending`, `in-progress`, and `ready`. These are the states eligible for
  "find next work".
- **`backlogged`** is open but **deprioritized** — exclude it from active / find-next-work queries
  and counts unless explicitly asked about the backlog.
- **`complete`** and **`cancelled`** are both **terminal** — exclude both from active work. Keep them
  distinguishable in queries and counts: `complete` = finished and verified, `cancelled` = abandoned.

## Integration with Development Workflows

The commands in this section are optional integrations from a broader agent environment, not VS
Code commands provided by the Agendo extension. Use them only when they are actually available;
otherwise perform the documented file operations directly.

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
grep -l 'dependencies: \[\]' "{root}"/*-{pending,in-progress,ready}-p1-*.md

# List all pending items needing triage
ls "{root}"/*-pending-*.md

# List backlogged items (open but deprioritized)
ls "{backlog}"/*.md

# Find next issue ID with GNU find (checks root + all subfolders)
find "{root}" -maxdepth 2 -type f -name '[0-9][0-9][0-9]-*.md' -printf '%f\n' | cut -d- -f1 | sort -n | tail -1 | awk '{printf "%03d", $1+1}'

# Count by status
for status in pending in-progress ready backlogged complete cancelled; do
  case "$status" in
    complete) path="{complete}" ;;
    cancelled) path="{cancelled}" ;;
    backlogged) path="{backlog}" ;;
    *) path="{root}" ;;
  esac
  count=$(find "$path" -maxdepth 1 -type f -name "*-$status-*.md" | wc -l)
  printf '%s: %s\n' "$status" "$count"
done
```

## Agendo sub-agent workflow (runSubagent)

This section applies only when the host supports `runSubagent` and has an `agendo` sub-agent
installed. These are internal agent handoffs, not CLI or extension commands. When unavailable, use
the file workflows above.

1. From your task agent (e.g., `coding` or `review`), call `agendo` as a sub-agent to fetch todo metadata.

   - parent prompt example:
     `runSubagent({ agentName: "agendo", prompt: "show status 021" })`
   - verify `status`, `priority`, `dependencies`, Resume Context, and the latest Work Log entry.

2. (Optional) Signal in-progress status via sub-agent call:

   - `runSubagent({ agentName: "agendo", prompt: "update 021 status in-progress" })`

3. Append work log entries incrementally through the sub-agent interface:

   - `runSubagent({ agentName: "agendo", prompt: "append 021 work log: added server-side protobuf handling, 2026-03-29, tests added" })`

4. Keep work log entries structured (date, author, actions, tests, results, learnings).

   - Include branch/PR references and commands run (`ctest`, `dotnet test`, etc.).

5. Resolve and complete through sub-agent call:
   - first move/rename the todo from `ready` to `complete`, before any final content edit
   - then call `runSubagent({ agentName: "agendo", prompt: "complete 021 summary: fixes + tests passed; the todo has already moved to its complete path, so edit only that path" })`

> This workflow is intended to be used by a parent skill/agent orchestrating code tasks; `agendo` is invoked as a child skill for data updates and audit-safe state changes.

**Dependency management:**

```bash
# What blocks this todo?
grep "^dependencies:" "{root}"/003-*.md

# What does this todo block?
grep -R -l 'dependencies:.*"002"' "{root}"
```

**Searching:**

```bash
# Search by tag
grep -R -l "tags:.*rails" "{root}"

# Search by priority
find "{root}" -maxdepth 2 -type f -name '*-p1-*.md'

# Full-text search
grep -R "payment" "{root}"
```

## Reconciling / Auditing Todos

When asked to reconcile, audit, or "clean up" todos — that is, check whether they are still
accurate against the current codebase — follow the procedure in
[reconcile.md](./reconcile.md). It covers deterministic integrity checks, focused evidence
gathering, and an advisory review that proposes changes for user approval without silently
rewriting history.

## Key Distinctions

**Agendo files (this skill):**

- Markdown files in the configured `{root}` directory
- Development/project tracking
- Standalone markdown files with YAML frontmatter
- Used by humans and agents

**Application todo entities:**

- Models, database records, or user-facing tasks owned by the host application
- Governed by the application's code and persistence rules
- Unrelated unless explicitly integrated with Agendo files

**Session task-list tools such as TodoWrite:**

- In-memory task tracking during agent sessions
- Temporary tracking for single conversation
- Not persisted to disk
- Different from both systems above
