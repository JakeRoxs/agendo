---
name: agendo
description: This skill should be used when managing the file-based todo tracking system in the docs/todos/ directory. It provides workflows for creating todos, managing status and dependencies, conducting triage, reconciling/auditing todos against the current codebase, and integrating with slash commands and code review processes.
argument-hint: "[todo operation]"
category: tracking
user-invocable: true
version: 1.9.2
---

# Agendo — File-Based Todo Tracking Skill

## Overview

The `docs/todos/` directory contains a file-based tracking system for managing code review feedback, technical debt, feature requests, and work items. Each todo is a markdown file with YAML frontmatter and structured sections.

This skill should be used when:

- Creating new todos from findings or feedback
- Managing todo lifecycle (pending → in-progress → ready → completed, plus backlogged and cancelled)
- Triaging pending items for approval
- Checking or managing dependencies
- Reconciling or auditing todos against the current codebase
- Converting PR comments or code findings into tracked work
- Updating work logs during todo execution

## Interpreting the Argument

The text after `/agendo` is the user's request. Parse it to determine the operation and use it
directly — do not ask the user to repeat or rephrase what they already said.

**Examples:**

- `/agendo make a todo investigating the login bug` → Create a new todo about investigating the login bug. Use the description to derive the filename, problem statement, and initial context.
- `/agendo triage` → List pending items and begin the triage workflow.
- `/agendo what's next` → Show active work and unblocked items.
- `/agendo complete 005` → Mark todo 005 as complete.
- `/agendo` (no argument) → Show the status summary below.

**Rules:**

- Extract the operation (create, triage, complete, etc.) and any identifiers (todo IDs, titles) from the argument.
- Use the argument text as the source of truth for what the user wants. Do not ask clarifying questions about information already provided in the argument.
- If the argument is ambiguous about priority, default to `p2` and note it. If it mentions urgency or criticality, use `p1`.
- If the argument describes a task, create the todo immediately with the information given. Fill in what you can from the description and leave optional sections for later.

## Default Behavior (no argument)

When invoked as `/agendo` without a specific operation, show a concise status summary instead of
asking questions. Read the todos directory and report:

1. **Counts by status** — pending, in-progress, ready, backlogged, completed, cancelled
2. **Pending items needing triage** — list titles and priorities
3. **Active work** — in-progress and ready items with their next steps from Resume Context
4. **Blocked items** — active items with unresolved dependencies

Keep the summary brief (under 15 lines). Do not ask the user what they want to do; present the
state and let them follow up with a specific command like `/agendo triage` or `/agendo create`.

## Select the workspace folder and todos root

Agendo supports two kinds of todo roots, each with an isolated ID sequence, dependency graph,
groups, filters, and scanner sequences:

- **Workspace-folder root** — derived from the folder-scoped `agendo.root` setting for a VS Code
  workspace folder (default `docs/todos` relative to that folder).
- **Manual todo root** — an arbitrary local filesystem directory registered with
  **Agendo: Add Manual Todo Root**. Its URI is already the todo root; it is not a workspace folder
  and has no folder-scoped setting.

**Distinguish the three root concepts:**

- **Workspace folder** — the VS Code workspace folder (`vscode.WorkspaceFolder.uri`).
- **Folder-scoped `agendo.root`** — the workspace-folder-relative todo root configured by
  `agendo.root` for the selected folder. Resolve it through the host API
  (`vscode.workspace.getConfiguration` for that folder) when available; otherwise read the selected
  folder's `.vscode/settings.json`. The resolved root is `agendo.root` relative to that folder,
  defaulting to `docs/todos`.
- **Manual todo-root URI** — a registered filesystem directory that is itself the todo root. Read
  `.agendo-config.json` from that exact URI; it is not a workspace folder.

**Identify the target root before any todo operation.** Establish workspace folder / todo-root
identity before todo lookup, ID resolution, dependency traversal, imports, status changes, or
summaries. At session start (and on every MCP call), resolve the todo root from, in order:

1. **File/task context** — a todo file or task explicitly under a root owns that root.
2. **Active/registered root** — the persisted active root, or the first registered root when none is
   active.
3. **Explicit selection** — the user picks a root. In multi-root, never assume the first root; when a
   bare todo ID is referenced, resolve it against the selected root only. Identical IDs in separate
   roots are distinct todos and dependencies do not cross roots.

**Tree mode** (`agendo.treeMode`, toggled by **Agendo: Toggle Tree Mode**):

- **Single** — the tree shows the active root's todos directly, with no root container wrapper. The
  active root is switched with **Agendo: Choose Workspace Folder** (workspace roots) or by selecting
  a manual root.
- **Multi** — every registered root is a named, collapsible top-level root node with its own isolated
  child hierarchy. Roots are never flattened across roots, and bare IDs are never used across roots.

**Manual-root commands:**

- **Agendo: Add Manual Todo Root** — pick a local directory (and optional label); it becomes a
  registered manual root and is activated.
- **Agendo: Remove Manual Todo Root** — pick a registered manual root to remove. If it was active, a
  fallback root is activated; if no roots remain, the manual/active root is cleared.
- **Agendo: Choose Workspace Folder** — switch the active workspace folder (saved with the
  workspace).
- **Agendo: Choose Root** — select the todo directory within the active folder (folder-scoped
  `agendo.root`). Distinct from choosing the workspace folder.
- **Agendo: Toggle Tree Mode** — switch between single and multi tree presentation.

**Manual root canvas.** Opening a canvas for a manual root makes that root active, rebinds the
repository to it, syncs its on-disk config projection/gitignore, and opens the canvas in "manual"
mode. The duplicate-ID check is scoped to that root's repository.

**Root-local state.** IDs, sequence allocation, groups, dependencies, filters, scanner sequences
(`cql-` / `sq-`), and assets are root-local. Each root owns an isolated `ConfigService` +
`TodoRepository`, so duplicate IDs across roots never collide and dependencies do not cross roots.
Scanner todos retain their source root (`code-scanning/codeql` or
`code-scanning/sonarqube`) across status changes.

**MCP scoping.** Every MCP todo tool (`get_todo_context`, `list_groups`, `list_group_members`,
`get_dependencies`, `set_status`, `set_priority`, `set_group`, `toggle_criterion`, `get_todo_file`)
accepts an optional `workspaceFolder` that selects any registered workspace or manual root by
label/basename or exact absolute path. When labels collide, use the exact absolute path. When
multiple roots are registered and the call cannot be disambiguated, the tool rejects the call rather
than guessing; do not fall back to another root silently. The read-only diagnostics tool
(`get_problems`) has separate selectors: `workspaceFolder` scopes the diagnostic query to a folder
within the selected diagnostics bridge, while `bridgeId` chooses a specific VS Code diagnostics
bridge/window when automatic routing is ambiguous. `workspaceFolder` selects an open VS Code folder
inside the selected bridge; it does not select a bridge and is not merely a path filter.

**Config.** `.agendo-config.json` is per resolved todo root, read from that root only. A manual root
is a directory URI, not a workspace folder, so it has no folder-scoped `agendo.root`; its root is its
exact URI. Scanner imports are manual per invocation and are not gated by a persistent enable toggle;
existing scanner todos remain visible.

Single-root behavior is unchanged: when one folder is open and no manual root is active, tools
resolve the sole root without a selector.

## Read `.agendo-config.json` from the resolved root

After resolving the workspace folder and todos root (see the previous section), read
`.agendo-config.json` from that resolved todo root only. The
[Agendo VS Code extension](https://github.com/JakeRoxs/agendo) writes this file as a projection of
its settings so this skill can honor the user's chosen configuration.

**Always locate the config with direct filesystem reads, never with workspace search or glob.**
The todos root is gitignored by default, and search indexes and glob tools exclude ignored
files. Read the file directly (`Read` tool, `cat`, `Get-Content`) at the resolved root path.

The `agendo.root` setting is folder-scoped. For the selected WorkspaceFolder, prefer the host API
(`vscode.workspace.getConfiguration` for that folder); otherwise read the selected folder's
`.vscode/settings.json`. The resolved root is `agendo.root` relative to that folder, defaulting to
`docs/todos`. A manual todo root is a directory URI, not a workspace folder: it has no folder-scoped
setting, and its root is its exact registered URI. Standalone operation (no VS Code workspace) falls
back to `docs/todos`.

**The file only exists when something differs from the defaults:** fields equal to their default
are never written, and the file itself is removed when every setting is default. Apply these
defaults to any missing key — or to the whole configuration when the file is absent:

| Key               | Default      |
| ----------------- | ------------ |
| `root`            | `docs/todos` |
| `gitignored`      | `true`       |
| `backloggedFolder`   | `backlogged` |
| `cancelledFolder` | `cancelled`  |
| `completedFolder`  | `completed`   |

The default parked-work folder is `backlogged/`, matching the lifecycle status. An existing
`backlog/` folder is a custom layout: honor an explicit `backloggedFolder: "backlog"` setting.
Do not silently rename, merge, or migrate folders; changing the configured folder does not move files.

Example of a config with a single non-default setting:

```json
{
  "gitignored": false
}
```

Honor it as follows:

- **`root`** — use this as the base path for every operation below instead of the default `docs/todos`.
- **`gitignored`** — pick a file-discovery strategy:
  - `false` (folder is tracked): workspace glob/search is safe.
  - `true` (folder is git-ignored): list the directory directly (`list_dir`, `Get-ChildItem`, `ls`, `find`) — search indexes exclude ignored files.
- **`backloggedFolder` / `cancelledFolder` / `completedFolder`** — use these subfolder names for the
  corresponding terminal/parked states.

**Degrade gracefully when the file is absent:** fall back to the `docs/todos` default root and the
list-the-directory discovery strategy described throughout this document. This skill is fully
self-contained and does **not** require the extension — the extension is a convenience/control
layer, not a hard dependency.

After resolving configuration, use these placeholders throughout this skill:

- **`{root}`** — configured todos root (default `docs/todos`).
- **`{backlog}`** — `{root}/{backloggedFolder}`.
- **`{cancelled}`** — `{root}/{cancelledFolder}`.
- **`{completed}`** — `{root}/{completedFolder}`.
- **`{skill_dir}`** — directory containing this `SKILL.md` file.

Examples below use placeholders rather than shell variables. Replace them with resolved paths
before running a command. `{file}` means the current todo filename stem and `{issue_id}` means its
three-digit ID; neither is shell brace expansion.

## File Naming Convention

### Optional Code-Scanning Todos

Agendo can import CodeQL and SonarQube findings natively. Existing scanning todos must always be
included in discovery; scanner imports are manual per invocation and are not gated by a persistent
enable toggle. List `{root}/code-scanning/codeql` and `{root}/code-scanning/sonarqube` directly,
plus their own configured completed, cancelled, and backlog subfolders. Do not assume search tools
index them.

Each source has an independent sequence: `cql-001-pending-p1-rule-name.md` and
`sq-001-pending-p2-rule-name.md`. The full prefixed ID is the `issue_id` and dependency key.
Regular numeric todos keep their existing sequence; scanner IDs do not advance it. Never reuse an ID.
On a scanner status change, retain its source root, for example
`{root}/code-scanning/codeql/{completedFolder}/cql-001-completed-p1-rule-name.md`.
Reopening returns it to `{root}/code-scanning/codeql`, not the main root.

Imports default to one todo per affected file, with optional grouping by rule/type or individual
scanner issue. File-based todos may contain several rules; review every finding and its rule
context. New todos record `scan_grouping` and `scan_target`. Changing grouping creates separate
todos, not a migration; do not silently merge or remove the previous grouping. IDs share the
same source-specific sequence across grouping choices.

Scanner imports manage only the marked Scanner Evidence block and `scan_identity` is the stable
import identity. Preserve these markers and metadata. Keep work logs, decisions, and notes outside
the managed block. Importing findings does not authorize status changes; missing alerts do not prove
completion. The lifecycle and verification rules below apply equally to scanner todos.

#### SonarQube Diagnostics Source Selection

When collecting SonarQube-related findings for the current VS Code workspace, prefer live editor
diagnostics in this order:

1. Use a host-provided VS Code Problems tool if one is available in the current tool set.
2. If no host Problems tool is available, or it fails because the editor/connection is unavailable,
   call Agendo MCP `agendo_get_problems` as the fallback. If it reports `ambiguous_window`, call
   Agendo MCP `agendo_list_diagnostic_bridges`, select the intended live bridge from its returned
   IDs, registered workspace, VS Code workspace name, and open folders, then retry
   `agendo_get_problems` with that ID as `bridgeId`. If
   candidates are indistinguishable (for example, two windows on the same workspace), ask the user
   which ID to use rather than guessing. Bridge IDs may change after restart; list them again if an
   ID is stale or unavailable. Do not use the fallback to mask invalid arguments; correct the
   workspace/path/severity parameters and retry the original tool first.
3. For a multi-root workspace, provide `workspaceFolder` to select an open folder inside the
   selected bridge (by folder name, absolute path, or file URI). This may differ from the bridge's
   registered workspace; a valid open folder remains queryable. The result reports both
   `registeredWorkspace` and `workspaceFolderDetails` (selected name and absolute path). Use
   workspace-relative `path` to scope a file or directory, and use
   supported severity values only. The Agendo tool defaults to 100 results and caps `limit` at 500;
   if `truncated` is true, narrow the scope and query again rather than treating the partial result
   as a complete scan.

These tools return a point-in-time snapshot of diagnostics currently published by VS Code language
extensions. They can include diagnostics for unsaved edits when an extension publishes them, but
they are not a complete SonarQube server issue inventory. An empty diagnostics array means no
diagnostics were published in the requested scope at capture time; it does not prove that the
SonarQube server has no open findings. Do not issue a `read` operation to try to populate Problems.

For SonarQube scanner imports, include only results whose diagnostic `source` and/or `code`
identifies a SonarQube/SonarLint rule. Keep their source and capture time in Scanner Evidence, and
do not silently merge IDE diagnostics with server-scanner results or claim that either cleared the
other. If a diagnostic has no stable SonarQube issue identity, do not fabricate an `sq-*` scanner
identity or `scan_identity`; track it as a regular todo instead. Use the scanner-specific ID and
identity format only when the SonarQube source provides a stable issue identity.

A file-based import is a focus for investigation, not a prohibition against necessary changes in
related files. A finding reported in one file may require changes to a shared helper, caller, test,
or other related file. When working a scanner todo:

- Keep small, directly necessary changes in the same todo. Record the related file, its purpose,
  and its relationship to the main finding in the Recommended Action or a new Related File Work
  subsection.
- Add acceptance criteria covering necessary related-file work (helper updates, caller changes,
  tests) without fabricating scanner findings for those files.
- Distinguish related findings already in the selected import from references to findings in
  other todos or grouping modes. Use the finding's stable ID when referencing another todo.
- Do not propagate checklist completion, change lifecycle, or merge notes across independent
  todos. Overlap references are informational only.
- Any claimed clearance in another file must be supported by appropriate tests and scanner
  evidence, not inferred solely from a related edit.
- Create a linked pending todo (using the `dependencies` field) for independent cleanup, a
  separately verifiable larger change, or work needing separate approval.

**Related File Work subsection example:**

```markdown
### Related File Work

- `src/utils/shared.js` — Refactor `validateInput()` to handle null (called by `src/api/user.ts`
  where the finding was reported). No separate scanner finding exists for this file.
- `src/api/user.test.ts` — Add regression test for the null-input case.
```

The extension displays scanner todos in a separate Code Scanning section between Todos and Skill,
grouped by CodeQL or SonarQube, then status and priority/custom group. Its search, filters, digest,
sort settings, and board are independent of regular Todos. Dependencies still span all sources;
view separation does not restrict repository-wide discovery or reconciliation.

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
| `completed`    | Fully finished and verified (terminal)                            | `{completed}`  |
| `cancelled`   | Abandoned / superseded (terminal)                                 | `{cancelled}` |

**Examples:**

```
001-pending-p1-mailer-test.md
002-in-progress-p1-fix-n-plus-1.md
003-ready-p1-verify-n-plus-1-fix.md
005-completed-p2-refactor-csv.md
053-cancelled-p2-superseded-by-057.md
061-backlogged-p3-nice-to-have-polish.md
```

## Folder Layout

- **Active** todos (`pending` / `in-progress` / `ready`) live **directly** in `{root}`, NOT in a
  subfolder.
- Each terminal/parked state has its **own sibling subfolder** under the root:
  - `completed/` — finished successfully.
  - `cancelled/` — abandoned or superseded.
  - `backlogged/` — deprioritized but still open.
- Recursive-glob behavior varies by tool: some `**/*.md` implementations include root files and
  others do not. For deterministic discovery, list `{root}/*.md` for active items and each
  configured state subfolder separately. When `gitignored` is `true`, use a direct directory
  listing rather than a workspace search index.
- Per-todo images live in `assets/{id}/` and **stay in place** even after the todo file moves to
  `completed/`, `cancelled/`, or `backlogged/`. Do not move the assets when the todo moves.

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
status: ready # pending | in-progress | ready | backlogged | completed | cancelled
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
title or filename.

**Authoritative filename, synchronized mirror:** the extension derives status and priority from the
filename tokens. Frontmatter `status` and `priority` are human-readable mirrors and must match the
filename. Folder placement is derived from status.

**Keep all three in sync, always.** The filename status/priority tokens, the frontmatter `status`
and `priority`, and the folder (`{root}`, `{backlog}`, `{completed}`, `{cancelled}`) must describe the
same state at all times. Never change one without the others, and never leave a todo half-transitioned.
If they disagree, the extension follows the filename, so the stale frontmatter or folder is the bug to
fix. Verify all three after every transition. Applies to creation, triage, completion, cancelling,
backlogging, reopening, and priority changes. The order of rename and edit does not matter.

## Common Workflows

### Creating a New Todo

**To create a new todo from findings or feedback:**

1. Determine next issue ID. **Always list the actual todos directory contents first — never trust an empty file-search result.**
   - Active todo files live directly inside `{root}`. List `{root}` and each configured state
     subfolder explicitly so discovery is independent of recursive-glob semantics and search-index
     exclusions.
   - The next ID is the highest existing leading filename ID within the selected `{root}` + 1,
     zero-padded to 3 digits. IDs are root-local and never reused within that root; identical IDs
     in separate roots are valid and distinct todos.
   - **Duplicate-root guard:** before creating `{root}` or any todo files, if the resolved root
     does not exist or is empty, confirm with the user whether to start a new series in that root.
     Do not scan sibling workspace folders for existing todo IDs or treat another folder's root as
     the real root; dependencies do not cross roots.
   - GNU/Linux Bash: `find "{root}" -maxdepth 2 -type f -name '[0-9][0-9][0-9]-*.md' -printf '%f\n' | cut -d- -f1 | sort -n | tail -1 | awk '{printf "%03d", $1+1}'`
    - PowerShell: `$files = @(); Get-ChildItem "{root}" -Filter '*.md' -ErrorAction SilentlyContinue | ForEach-Object { $files += $_ }; Get-ChildItem "{backlog}", "{completed}", "{cancelled}" -Filter '*.md' -ErrorAction SilentlyContinue | ForEach-Object { $files += $_ }; ($files | ForEach-Object { if ($_.Name -match '^(\d{3})-') { [int]$Matches[1] } } | Measure-Object -Maximum).Maximum + 1 | ForEach-Object { '{0:D3}' -f $_ }`
2. Copy the template from the skill directory: `cp "{skill_dir}/assets/todo-template.md" "{root}/{NEXT_ID}-pending-{priority}-{description}.md"`
3. Edit and fill the core sections:
   - Problem Statement
   - Acceptance Criteria
   - Initialize Resume Context with the current state and first next step
   - Add initial Work Log entry
   - Add Findings, Proposed Solutions, and Recommended Action when investigation or triage warrants
     them
4. Determine status: `pending` (needs triage) or `ready` (explicitly pre-approved). When creating a
   `ready` todo, use `ready` in both the destination filename and frontmatter from the outset; do not
   create a `pending` filename with `status: ready`.
5. Add relevant tags for filtering
6. If an external issue or work item was provided, add its identifier as the optional `key` field.
7. **Verify the chosen ID is unique** before writing: confirm no existing file in `{root}` or any
   configured state subfolder starts with that number. If a collision is found, bump to the next
   free number and keep both the filename prefix and `issue_id` frontmatter in sync.

**Todo vs. immediate action:**

Create a todo when work exceeds ~15 minutes, requires research or planning, has dependencies,
needs approval/prioritization, is part of a larger feature, or documents technical debt.

Act immediately instead for trivial fixes (<15 min) with complete context, no planning needed,
and an obvious solution — or when the user explicitly requests immediate action.

### Triaging Pending Items

**To triage pending todos:**

1. List pending items: `ls "{root}"/*-pending-*.md`
2. For each todo:
   - Read Problem Statement and Findings
   - Review Proposed Solutions
   - Make decision: approve, defer (backlog), or modify priority
3. Update approved todos:
   - Rename the file: `mv "{root}/{file}-pending-{pri}-{desc}.md" "{root}/{file}-in-progress-{pri}-{desc}.md"`
   - Update frontmatter to match: `status: pending` → `status: in-progress`
   - Fill "Recommended Action" with a clear plan
   - Adjust priority if different from initial assessment
4. Deferred todos either stay in `pending` status or move to `backlogged` (see below).

**Optional integration:** use `/triage` for an interactive approval workflow only when that slash
command is installed in the host environment.

### Starting / Progressing Work

When a triaged `in-progress` todo is actively being worked on, keep it `in-progress` and update
its Resume Context and Work Log as you go.

**Open the work-session canvas for the active todo.** When you start or resume work on a todo and
the host lists the `agendo-work-session` canvas (installed by the Agendo extension into
`$COPILOT_HOME/extensions/agendo-work-session/` — defaulting to `~/.copilot/extensions/agendo-work-session/`
on Linux/macOS or `%USERPROFILE%\.copilot\extensions\agendo-work-session\` on Windows, or present as a
project extension), open it for that todo:

In the normal VS Code extension, a board card's **Work session** action opens the dashboard with
a **Return to Board** link to that board. Its filters and layout remain intact. Normal card clicks
still honor the saved todo-opening preference; explicit work-session navigation does not change it.
Use **Group overview** on a grouped todo to inspect its members, then use Back/Forward or recent
views to return. These native UI actions do not require Copilot or an agent session.

In a supported Copilot canvas host:

- Call `open_canvas` with `canvasId: "agendo-work-session"`, `input: { "todoId": "{issue_id}" }`
  (the three-digit ID as a string), and the fixed `instanceId` `agendo-work-session`. Always reuse
  that one `instanceId`: it is a single shared panel, so reopening retargets the existing tab
  instead of opening a new one. The panel keeps a back/forward history and a recent-todos strip,
  and its dependency links navigate within the panel.
- Do this once when you start or switch to a todo, not on every edit; the page reloads itself when
  the todo file changes.
- The canvas reads the same markdown file, so rename and edit the todo as usual. Checking a
  criterion in the canvas, or with its `mark_criterion_met` action, updates the todo file.
- Skip this silently if the canvas is unavailable. It is a convenience, never a requirement, and
  the file workflows in this document work without it.

When implementation is believed to be done (but not yet
confirmed as working), move it to `ready` so it can be verified:

- `mv "{root}/{file}-in-progress-{pri}-{desc}.md" "{root}/{file}-ready-{pri}-{desc}.md"`
- Update frontmatter: `status: in-progress` → `status: ready`

A `ready` todo is a candidate for completion — confirm it works and meets acceptance criteria
before moving it to `completed`.

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
`completed`, which is finished successfully).

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

**To verify blockers are completed before starting:**

```bash
for dep in 001 002 003; do
  terminal_file=$(find "{completed}" "{cancelled}" -maxdepth 1 -type f \
    \( -name "${dep}-completed-*.md" -o -name "${dep}-cancelled-*.md" \) -print -quit)
  [ -n "$terminal_file" ] || echo "Issue $dep is not terminal"
done
```

Both `completed` and `cancelled` satisfy dependencies by design. Cancellation means the dependency
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

Work logs provide historical record, durable context across sessions/agents, and reference for future similar work.

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
6. If the `agendo-work-session` canvas is available, open it for the todo (see
   [Starting / Progressing Work](#starting--progressing-work)).
**Before pausing or handing execution to another agent:**

1. Update `Current state` to describe what is true now, not a session history.
2. Set one concrete `Next step` that can be acted on without rereading unrelated context.
3. Update `dependencies` if structured blockers changed.
4. Append a Work Log entry with actions, validation, and learnings.

This workflow is individual-first: it supports returning after a break or switching AI agents. The
same files may still be repository-tracked and shared without requiring collaboration-specific
metadata.

### Completing a Todo

`completed` is for work that is fully finished and verified. Only move a `ready` todo here once it
is confirmed done and functional.

**To mark a todo as completed:**

1. Verify all acceptance criteria checked off and the work is confirmed working
2. Move and rename the file: `mv "{root}/{file}-ready-{pri}-{desc}.md" "{completed}/{file}-completed-{pri}-{desc}.md"`
3. Set frontmatter `status: ready` → `status: completed` and add the final Work Log entry.
4. Check for newly unblocked active work: `grep -l 'dependencies:.*"{issue_id}"' "{root}"/*-{pending,in-progress,ready}-*.md`

Do not commit, push, or create a pull request unless the user explicitly requests it.

> Remember: every lifecycle or priority transition changes the filename, frontmatter, and folder
> together (see [File Structure](#file-structure)).

## Active vs. Terminal Status Rules

When answering "what's next", counting work, or picking up new tasks:

- **Active** = `pending`, `in-progress`, and `ready`. These are the states eligible for
  "find next work".
- **`backlogged`** is open but **deprioritized** — exclude it from active / find-next-work queries
  and counts unless explicitly asked about the backlog.
- **`completed`** and **`cancelled`** are both **terminal** — exclude both from active work. Keep them
  distinguishable in queries and counts: `completed` = finished and verified, `cancelled` = abandoned.

## Integration with Development Workflows

Optional host integrations (code review → triage → todos, PR comment resolution, planning) use the
same file operations documented above. Use `/triage` and similar slash commands only when installed
in the host environment.

## Quick Reference Commands

**Finding work:**

```bash
# List highest priority unblocked active work (excludes backlogged/completed/cancelled)
grep -l 'dependencies: \[\]' "{root}"/*-{pending,in-progress,ready}-p1-*.md

# List all pending items needing triage
ls "{root}"/*-pending-*.md

# List backlogged items (open but deprioritized)
ls "{backlog}"/*.md

# Find next issue ID with GNU find (checks root + all subfolders)
find "{root}" -maxdepth 2 -type f -name '[0-9][0-9][0-9]-*.md' -printf '%f\n' | cut -d- -f1 | sort -n | tail -1 | awk '{printf "%03d", $1+1}'

# Count by status
for status in pending in-progress ready backlogged completed cancelled; do
  case "$status" in
    completed) path="{completed}" ;;
    cancelled) path="{cancelled}" ;;
    backlogged) path="{backlog}" ;;
    *) path="{root}" ;;
  esac
  count=$(find "$path" -maxdepth 1 -type f -name "*-$status-*.md" | wc -l)
  printf '%s: %s\n' "$status" "$count"
done
```

## Agendo sub-agent workflow (runSubagent)

When the host supports `runSubagent` with an `agendo` sub-agent installed, see
[subagent-workflow.md](./subagent-workflow.md) for the delegation protocol. Otherwise use the file
workflows above.

**Dependency management:** (see [Quick Reference Commands](#quick-reference-commands))

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
rewriting history. An unscoped request such as "review all todos" triggers a whole-repository
reconciliation that reviews every non-terminal todo, automatically continues in stable ID-ordered
batches when needed, and presents one consolidated report for approval.

## Edit Verification

When editing todo files, always verify the edit succeeded before proceeding:

- After an edit tool call fails or appears to have no effect, **read the file** to verify its current state before retrying. Do not repeat the same edit multiple times without checking whether the target text actually exists.
- If an edit fails twice with the same search text, stop and inspect the file content directly — the text may have already been changed or may differ from what you expect.
- When updating status, check the current status first rather than assuming it. The filename and frontmatter should already be in sync from the previous transition.

## Key Distinctions

Agendo files are standalone markdown in `{root}` for project tracking. They are distinct from
application todo entities (database records owned by the host app) and session task-list tools like
TodoWrite (in-memory, non-persistent).
