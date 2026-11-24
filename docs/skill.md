# Agendo Skill

The Agendo skill helps compatible AI-agent hosts create, triage, continue, and audit 
the Markdown todos used by the Agendo extension. It can also be used without the extension when the
agent has access to the repository files.

## Install and invoke

In VS Code, install **Bundled Agendo Skill** from the **Skill** section. The skill is installed for
your agent host and can be used across workspaces. If your host supports user-invocable skills,
call it with `/agendo` followed by a request:

```text
/agendo
/agendo triage
/agendo what's next
/agendo make a todo investigating the login bug
/agendo review all todos
```

Without slash-command support, ask the agent explicitly:

```text
Use the Agendo skill to create a todo for investigating the CI failure.
```

When invoked without an argument, the skill reports counts by status, pending work, active work, and
unresolved blockers. With an argument, it treats the request as the operation and uses identifiers
or constraints from that request directly.

## Todo conventions

The skill first resolves the active workspace folder and todos root (folder-scoped `agendo.root`,
defaulting to `docs/todos`), then reads `.agendo-config.json` from that resolved root only. Agendo
writes that file only when settings differ from their defaults. Without it, the skill uses
`docs/todos`, the standard lifecycle folders, and direct directory listings so git-ignored todos are
still found.

Todo filenames carry the ID, status, priority, and a short description:

```text
042-in-progress-p1-fix-login-test.md
```

The filename, frontmatter status and priority, and folder must stay in sync. Active todos live at the
root; backlogged, complete, and cancelled todos live in their corresponding subfolders. Dependencies
are structured frontmatter, while `group`, `tags`, and an external `key` are optional metadata.

| Status | Meaning |
| --- | --- |
| `pending` | Needs triage or has not started |
| `in-progress` | Actively being worked on |
| `ready` | Implementation appears done and needs verification |
| `backlogged` | Still open, but not part of active work |
| `complete` | Acceptance criteria are verified |
| `cancelled` | Abandoned or superseded |

## Multi-root workspaces

Agendo supports one active todo root per workspace folder. Each folder can configure its own
`agendo.root`, and each root keeps an independent `.agendo-config.json`, ID sequence, scanner
sequences, dependencies, groups, and assets. The same numeric ID in two roots is a distinct todo,
and cross-root dependency references are unsupported.

Resolve the workspace folder / todo root before any todo lookup, ID resolution, dependency
traversal, import, status change, or summary. Prefer an explicit file path or task context, or the
user's active workspace folder. In a multi-root workspace, do not assume the first folder; require
folder selection.

MCP todo tools accept an optional `workspaceFolder` (folder name or exact absolute path). When
multiple roots are registered and the call cannot be disambiguated, the tool rejects the call
rather than guessing. Pass `workspaceFolder` explicitly; when two folders share a basename, use the
exact absolute path to disambiguate. The read-only diagnostics tool (`get_problems`) follows the
same model: omit `workspaceFolder` for a single root, provide it when multiple roots are open.

Use **Agendo: Choose Workspace Folder** to switch the active workspace folder (saved with the
workspace). Use **Agendo: Choose Root** to select the todo directory within the active folder — the
former picks the workspace folder, the latter picks the relative todo root path within it.

CodeQL and SonarQube todos use separate `cql-` and `sq-` IDs and source-specific folders. The skill
can work on those imported todos, but it does not fetch scanner alerts; use **Agendo: Import
Code-Scanning Todos...** in the extension for server-scanner imports. When inspecting live
SonarQube IDE diagnostics, the skill prefers a host-provided VS Code Problems tool and falls back to
Agendo's read-only MCP diagnostics tool when that is unavailable. IDE diagnostics are a point-in-time
snapshot, not a complete SonarQube server scan.

## Keep work resumable

For non-trivial work, the skill maintains two complementary sections:

- **Resume Context** — a compact current state and one concrete next step
- **Work Log** — dated history of changes, commands, tests, and learnings

For example:

```markdown
## Resume Context

**Current state:** Login validation is implemented and unit tests pass.

**Next step:** Verify the extension in a development host.
```

Dependencies remain the source of truth for blockers. The skill does not require owners, assignments,
or a team mode, so the same files work across personal sessions, agents, and shared repositories.

When the extension's work-session canvas is available, the skill can open it for the active todo. The
canvas edits the same Markdown file and is optional; the skill's file-based workflow does not depend
on it.

## Reconcile stale todos

Use `/agendo review all todos` when task status or descriptions may no longer match the repository.
The skill checks todos, gathers focused code evidence, and returns proposed updates for approval. It
reviews all non-terminal work, including the backlog, and continues in stable ID batches when needed.
It does not silently rewrite history or mark work complete; completion requires verified acceptance
criteria.

## Further reading

- [Agendo extension overview](../README.md)
- [Bundled skill instructions](../resources/skill/SKILL.md)
