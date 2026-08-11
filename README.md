# File Todos Manager

A VS Code extension that lets you view, filter, and manage markdown-file-backed
todos (the `file-todos` convention) from a dedicated Activity Bar TreeView —
without leaving your plain-markdown files in the repo.

Todos are `.md` files under a root folder (default `docs/todos/`) that follow the
naming contract:

```
{issue_id}-{status}-{priority}-{description}.md
```

- `issue_id` — zero-padded, globally sequential, never reused (e.g. `060`).
- `status` — `pending` | `ready` | `backlogged` | `complete` | `cancelled`.
- `priority` — `p1` | `p2` | `p3`.
- `description` — kebab-case.

## Folder layout

- Active todos (`pending` / `ready`) live directly in the root folder.
- Terminal / parked states each get their own subfolder under the root:
  - `complete/` — finished successfully.
  - `cancelled/` — abandoned / superseded.
  - `backlog/` — deprioritized but still open.

## Features (v1)

- **TreeView** grouping todos by status → priority, with icons and priority colors.
- **Filter** by status and priority, and **search** free text (id, title, tag,
  ref, dependency). Filter state persists per workspace.
- **Open in Markdown preview** by default (configurable).
- **Status transitions** that keep the filename token, frontmatter `status`, and
  folder placement in sync. Cancelling inserts a contextual `> **CANCELLED**`
  banner and a `cancelled` tag; reopening removes the banner.
- **Set priority**, renaming the file and updating frontmatter.
- **Create Todo** with the next available id from a built-in template.
- **Config bridge**: the extension writes `<root>/.todos-config.json` so the
  `file-todos` skill can read the active `root` and `gitignored` flag and choose
  its file-discovery strategy.
- **Gitignore toggle**: optionally write a `*` `.gitignore` into the todos root.
- **Bundled `file-todos` skill**: install/enable the skill into
  `~/.agents/skills/file-todos/` from the view menu, and update it from a
  configurable raw GitHub source.
- **Broken-link flagging**: when a status/priority change moves or renames a
  todo, other todos that still reference the old filename are flagged (v1 warns
  and offers "Show Referrers"; it does not auto-rewrite links).

## Settings

| Setting | Default | Description |
| ------- | ------- | ----------- |
| `file-todos.root` | `docs/todos` | Workspace-relative root todos folder. |
| `file-todos.defaultPriority` | `p3` | Default priority for new todos. |
| `file-todos.completeFolder` | `complete` | Subfolder for completed todos. |
| `file-todos.cancelledFolder` | `cancelled` | Subfolder for cancelled todos. |
| `file-todos.backlogFolder` | `backlog` | Subfolder for backlogged todos. |
| `file-todos.openInPreview` | `true` | Open todos in Markdown preview. |
| `file-todos.gitignoreTodos` | `false` | Write a `*` `.gitignore` in the root. |
| `file-todos.skillUpdateSource` | GitHub raw base URL | Base URL used by "Update file-todos Skill from Source". |

## Development

```powershell
npm install
npm run compile   # or: npm run watch
```

Press `F5` (Run Extension) to launch an Extension Development Host.

```powershell
npm test          # compile + lint + integration tests
```

## Not yet implemented (planned)

- A richer webview "board" view with drag-drop status columns.

See `docs/todos/001-pending-p3-vscode-extension-file-todos-manager.md` for the
full design and open questions.
