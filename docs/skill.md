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

## Multi-root workspaces and manual roots

Agendo supports two kinds of todo roots, each with an independent `.agendo-config.json`, ID
sequence, scanner sequences, dependencies, groups, and assets:

- **Workspace-folder root** — derived from the folder-scoped `agendo.root` setting for a VS Code
  workspace folder (default `docs/todos` relative to that folder).
- **Manual todo root** — an arbitrary local filesystem directory registered with
  **Agendo: Add Manual Todo Root**. Its URI is already the todo root; it is not a workspace folder.

The same numeric ID in two roots is a distinct todo, and cross-root dependency references are
unsupported.

Resolve the workspace folder / todo root before any todo lookup, ID resolution, dependency
traversal, import, status change, or summary. Prefer an explicit file path or task context, or the
active/registered root. In multi-root, never assume the first root; require explicit selection.

**Tree mode** (`agendo.treeMode`, toggled by **Agendo: Toggle Tree Mode**):

- **Single** — the tree shows the active root's todos directly, with no root container wrapper.
- **Multi** — every registered root is a named, collapsible top-level root node with its own isolated
  child hierarchy. Roots are never flattened, and bare IDs are never used across roots.

MCP todo tools accept an optional `workspaceFolder` that selects any registered workspace or manual
root by label/basename or exact absolute path. When labels collide, use the exact absolute path.
When multiple roots are registered and the call cannot be disambiguated, the tool rejects the call
rather than guessing. Diagnostics bridge selection is separate from todo-root selection:
`bridgeId` selects a bridge/window when automatic routing is ambiguous; `workspaceFolder` selects
an open VS Code workspace folder within that selected bridge. It does not select a bridge and is
not merely a path filter.

When multiple VS Code windows share the same workspace and automatic routing cannot uniquely
identify the originating window, `get_problems` rejects with `ambiguous_window` rather than guessing.
In that case, call the read-only `list_diagnostic_bridges` tool to enumerate live diagnostics
bridges. Each entry exposes an opaque, registration-scoped `id`, the registered workspace path
(`workspace` / `registeredWorkspace` / `registeredWorkspaces`), the live VS Code workspace display
name (`workspaceName`), and available open workspace folders (`availableWorkspaceFolders`, each
with a name and path), when the bridge supports folder metadata. `folders` remains as a compatibility
alias. `defaultWorkspaceFolder` is currently null because no default is configured. The registered
workspace is a discovery/todo-root identity and may differ from an open folder the bridge can query.
Raw socket paths and PIDs are not exposed. IDs may change after restart. Pass the chosen `id` as the
`bridgeId` argument to `get_problems` to route the diagnostics query to that specific bridge.
`workspaceFolder` selects an available VS Code folder inside that bridge; `path` then scopes to a
file or directory within that folder. The result echoes `requestedWorkspaceFolder`, identifies the
`resolvedWorkspaceFolder`, and includes the bridge's registered workspace. A valid open folder may
differ from the registered workspace; `selectionDiffersFromRegisteredWorkspace` makes that explicit
without rejecting the query. Unknown or missing selections retain `WORKSPACE_NOT_FOUND` or
`MULTIPLE_ROOTS_REQUIRED`, with available folder names/paths in the message.
Stale or unknown `bridgeId` values fail safely; a bridge that is no longer listening is reported
as unavailable. The process-level `--endpoint` CLI override takes precedence over `bridgeId` and
both cannot be used together.

Use **Agendo: Choose Workspace Folder** to switch the active workspace folder (saved with the
workspace). Use **Agendo: Choose Root** to select the todo directory within the active folder — the
former picks the workspace folder, the latter picks the relative todo root path within it. Use
**Agendo: Add Manual Todo Root** / **Remove Manual Todo Root** to register or drop a manual root.


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
