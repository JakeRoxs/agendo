<h1><img src="resources/images/agendo-icon.png" alt="A" width="44" height="44" align="absmiddle">gendo</h1>

![VS Code Extension](https://img.shields.io/badge/VSCode-Extension-007ACC?logo=visual-studio-code)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Extension Version](https://img.shields.io/badge/extension-0.2.0-blue.svg)
![Skill Version](https://img.shields.io/badge/skill-1.5.0-orange.svg)
![Canvas Version](https://img.shields.io/badge/canvas-0.1.2-purple.svg)

Agendo is a VS Code extension for managing Markdown-backed todo files from a dedicated Activity Bar
tree and an editor-window board. It keeps task state in the repository while adding fast ways to
filter, group, prioritize, summarize, and move work through its lifecycle.

## Why Agendo

Agendo treats todos as real Markdown files in your workspace instead of hidden database records. Each task is easy to inspect and edit in plain text, and status changes keep the filename, frontmatter, and folder layout aligned. The tree and board views provide complementary list and visual workflows that fit developer-first repositories.

## The built-in skill

Agendo bundles an installable companion skill that helps you or an AI agent manage tasks using the
same conventions. It supports resuming interrupted work, maintaining work logs, and reconciling
todos against the current codebase.

```text
/agendo make a todo investigating the login bug
/agendo triage
/agendo what's next
```

See [docs/skill.md](docs/skill.md) for details on Resume Context, the reconciliation workflow, and
skill invocation.

## The work session canvas

Agendo bundles the `agendo-work-session` canvas, an interactive dashboard that shows the todo you are working on in an editor tab next to the chat. The canvas reads and edits the same Markdown todo file, takes status and priority from the filename, and reloads automatically when the file changes.

The canvas shows:

- the todo number, title, status, and priority
- acceptance criteria with a progress bar, where each criterion can be checked from the canvas
- a dependency panel that resolves what blocks the todo and what it blocks, with each todo's status and priority, whether it is satisfied, and click-through navigation to open it
- back and forward buttons, a recent-todos dropdown and quick-jump chips, since the canvas is one shared panel that follows the todo being worked on
- resume context and work log rendered as Markdown, with a control to show every work log entry
- a confetti celebration when a todo is completed or its last criterion is checked

**Using the canvas with an agent:** Install the Agendo skill, which also installs the canvas at user level so it is available in every workspace. When working on a todo, the skill tells the agent to open the canvas for the active todo.

**Using the canvas standalone:** Right-click any todo in the tree or on a board card and choose **Open in Work Session Canvas**, or set `agendo.viewMode` to `canvas`. The Skill panel has its own canvas row, and **Agendo: Install/Update Work Session Canvas** installs or updates it separately from the skill.

## Features

- Tree view grouped by status, priority, and optional task group
- Editor-window board with status columns, drag-and-drop transitions, filters, grouping, WIP limits,
  and persisted layout and card preferences
- Deterministic task digest with next actions, Resume Context updates, high-priority work, blockers,
  and recent changes
- Search and filtering by text, status, priority, blocked state, and group
- Quick task creation with generated IDs and default priority
- Status transitions that keep filenames, frontmatter, and folder placement aligned
- Priority, dependency, and group editing
- Blocked-state indicators and reverse dependency filtering
- Selectable source editor, Markdown preview, or preview-editor opening modes
- Optional `.gitignore` handling for the todo root
- Bundled companion skill for creating and managing tasks with repo-aware context
- Advisory reconciliation workflow that audits todos against the current codebase and
  proposes reviewable updates
- Individual-first Resume Context for continuing work across sessions and agents
- Skill update support so task guidance can evolve with the project
- Referrer / broken-link warnings when old filenames are still referenced

## Todo file convention

Todos are stored as Markdown files under a configured root folder, usually `docs/todos` by default.

```text
{issue_id}-{status}-{priority}-{description}.md
```

Examples:

```text
001-pending-p2-write-readme.md
002-in-progress-p1-fix-n-plus-1.md
003-ready-p1-verify-n-plus-1-fix.md
```

The naming convention includes:

- `issue_id` — zero-padded, sequential, and unique
- `status` — `pending`, `in-progress`, `ready`, `backlogged`, `complete`, or `cancelled`
- `priority` — `p1`, `p2`, or `p3`
- `description` — kebab-case text

Lifecycle semantics:

- `pending` needs triage or has not started
- `in-progress` is actively being worked on
- `ready` is likely done but still needs confirmation that it works
- `backlogged` remains open but is excluded from active-work queries
- `complete` is fully finished and verified
- `cancelled` is abandoned or superseded

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> in-progress : triage approved
    pending --> backlogged : deprioritized
    in-progress --> ready : implementation done
    ready --> complete : verified working
    ready --> in-progress : needs more work
    in-progress --> backlogged : deprioritized
    backlogged --> pending : reactivated
    pending --> cancelled : abandoned
    in-progress --> cancelled : abandoned
    ready --> cancelled : abandoned
    complete --> [*]
    cancelled --> [*]
```

Active todos live directly in the configured root. Backlogged, complete, and cancelled todos move
to their configured state folders. The filename status and priority tokens are authoritative;
frontmatter mirrors them for readability.

Todo files may also include optional metadata:

```yaml
tags: [release, testing]
dependencies: ["042"]
group: release
key: "JIRA-123"
```

Dependencies drive blocked-state reporting, groups provide lightweight organization, and external
tracking keys are displayed and searchable when present. Legacy `jira:` frontmatter remains
supported as an alias for `key`.

## Quick start

### Prerequisites

- Node.js
- VS Code
- Git

### Install and run

```bash
npm install
npm run compile
```

Then launch the extension in a development host using VS Code's Run Extension command (`F5`).

### Configure the todo root

The extension defaults to `docs/todos`, but you can change it in Settings or via the extension UI.

### Create your first todo

You can create tasks either from the extension UI or from the bundled skill.

- Open the Agendo view in the Activity Bar
- Use "Create Todo..."
- Enter a short kebab-case description, choose a priority, and optionally add an external key
- The extension generates the next available ID and creates a `pending` Markdown todo

You can also ask a compatible agent host to use the installed Agendo skill explicitly, for example:

```text
Use the Agendo skill to create a todo for investigating the CI failure in the release pipeline.
```

This is especially useful when you want a follow-up task captured into the same repo-managed workflow without losing the surrounding context.

## Configuration

| Setting | Default | Description |
| --- | --- | --- |
| `agendo.root` | `docs/todos` | Workspace-relative root folder for todo files |
| `agendo.defaultPriority` | `p3` | Default priority for newly created todos |
| `agendo.completeFolder` | `complete` | Folder used for completed tasks |
| `agendo.cancelledFolder` | `cancelled` | Folder used for cancelled tasks |
| `agendo.backlogFolder` | `backlog` | Folder used for backlogged tasks |
| `agendo.viewMode` | `preview` | Open todos in `editor`, `preview`, `previewEditor`, or `canvas` (work-session dashboard in an editor tab) mode |
| `agendo.gitignoreTodos` | `true` | Optionally add a wildcard `.gitignore` in the todo root |
| `agendo.skillUpdateSource` | GitHub raw base URL | Source used for updating the bundled Agendo skill |
| `agendo.codeScanning.enabled` | `false` | Enable manually triggered native code-scanning imports |
| `agendo.codeScanning.sortByDate` | `false` | Sort scanning todos by modified date independently of the regular tree |
| `agendo.codeScanning.sonarqube.url` | empty | SonarQube server URL |
| `agendo.codeScanning.sonarqube.projectKey` | empty | SonarQube project key |

## Duplicate IDs

When multiple files reuse an ID within the same todo type, each affected tree row shows an inline warning action and a **duplicate ID** label. The section header also shows a collision-count badge. Regular, CodeQL, and SonarQube sequences are checked independently; `003`, `cql-003`, and `sq-003` do not collide with one another.

**Inspecting collisions:** Hover a warning row to see every conflicting filename, folder, status, and priority, including records hidden by the current filters. Click the warning action to focus that section's tree and board on only the conflicting files, clearing filters that would hide them. Use **Clear Filters** to exit collision focus.

**Resolving collisions:** Right-click a warning row or board card and choose **Copy ID Collision Reconciliation Context**. The clipboard contains a prompt for the Agendo reconciliation skill with the exact file paths and evidence, ready to paste into Copilot, Kilo, or another agent harness. The same command in the Command Palette copies all detected collisions. Copying context does not invoke an agent or modify files; the prompt requires an evidence-backed plan and approval before cleanup.

**Board and canvas behavior:** Boards show a clickable collision warning with the same focus behavior and refuse ambiguous ID-based actions. Opening a selected tree record in canvas mode falls back to its exact source file rather than choosing another duplicate. Dependencies on ambiguous IDs stay blocked until reconciliation resolves the collision.

## Code Scanning

Code scanning is optional and disabled by default. Run **Agendo: Import Code-Scanning Todos...** from the Command Palette or the **Code Scanning** section to enable it for a workspace and select CodeQL or SonarQube. Imports run only on request; activation and normal refresh never contact a scanning service.

### Authentication

- **CodeQL** uses the GitHub CLI's authenticated account (`gh auth login`) and the current workspace's repository; the account needs permission to read code-scanning alerts
- **SonarQube** prompts for a server URL, project key, and user token; the token is stored in VS Code SecretStorage, not settings, todo files, or logs; leave the token prompt blank to reuse it or enter a new token to replace it
- SonarQube requires HTTPS except for loopback servers, and includes unresolved issues, not Security Hotspots
- Imports require a trusted workspace and run natively in the extension, without Python

### File layout

Each source has its own numbering sequence and lifecycle folders beneath your configured todo root:

```text
docs/todos/
  001-pending-p2-regular-todo.md
  code-scanning/
    codeql/
      cql-001-pending-p1-js-example.md
      complete/
      cancelled/
      backlog/
    sonarqube/
      sq-001-pending-p2-typescript-s123.md
      complete/
      cancelled/
      backlog/
```

Custom complete, cancelled, and backlog folder settings apply inside each source as well. Folders are created only when needed. Scanning IDs never consume the regular todo sequence; use the full ID (e.g. `cql-001`) in dependencies and links.

Agendo creates one todo per rule and repository/project, initially prioritized by the most severe finding.

### Sidebar and board

The sidebar has a dedicated **Code Scanning** section between **Todos** and **Skill**:

```text
Todos
Code Scanning
  CodeQL
    Pending
      P1 - High
        cql-001 ...
  SonarQube
    Pending
      P2 - Medium
        sq-001 ...
Skill
```

Regular Todos and its board exclude scanning tasks. Code Scanning has its own search, filters (including source selection), refresh, digest, board, date-sort toggle, and collapsed-node state. Its board displays separate CodeQL and SonarQube sections with the usual status columns and has its own saved layout settings.

### Behavior

Both sections share the same repository and dependency graph, so dependencies across regular, CodeQL, and SonarQube tasks remain valid. Refresh reloads local todo files, while Import fetches new scanner evidence. Status changes stay inside the source's folders. Existing scanning todos remain visible when imports are disabled, and the work-session canvas works for every task type. The canvas labels tasks with lowercase `todo`, `cql`, and `sq` source badges in the header, dependencies, and recent history.

**Re-imports** update only the marked **Scanner Evidence** section. IDs, status, priority, notes, acceptance criteria, and work logs are preserved, including completed or cancelled todos. Missing findings never automatically complete, cancel, reopen, or delete a todo. Save pending editor changes before importing, and retain the evidence markers so Agendo can refresh that section safely.

## Contributing

Contributions are welcome.

1. Fork or clone the repository.
2. Create a feature branch.
3. Keep changes focused and aligned with the repo's task-driven workflow.
4. Run the relevant validation commands before opening a PR.
5. Keep the README and project docs updated when behavior changes.

When making changes, follow the existing conventions in `src/` and keep the implementation consistent with established VS Code extension patterns in this repository.

## Development workflow

The repo is a TypeScript-based VS Code extension. Typical local development looks like this:

```bash
npm install
npm run watch
```

Useful project commands:

```bash
npm run compile
npm run lint
npm run format
npm test
```

The project includes integration test coverage and uses Biome for linting and formatting.

## Testing

Testing is run through the VS Code extension test harness.

```bash
npm test
```

For coverage:

```bash
npm run test:coverage
```

This compiles the extension, checks lint status, and runs the test suite with coverage reporting.

## Project structure

```text
.
├── .github/
│   ├── instructions/
│   └── workflows/
├── docs/
│   ├── skill.md
│   └── todos/
├── resources/
│   ├── canvas/
│   └── skill/
├── src/
│   ├── commandRegistration.ts
│   ├── commands.ts
│   ├── configuration.ts
│   ├── extension.ts
│   ├── output.ts
│   ├── test/
│   └── todos/
├── AGENTS.md
├── CHANGELOG.md
├── LICENSE
├── README.md
├── biome.json
├── package.json
├── sonar-project.properties
└── tsconfig.json
```

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
