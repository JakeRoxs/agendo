# Agendo

![VS Code Extension](https://img.shields.io/badge/VSCode-Extension-007ACC?logo=visual-studio-code)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Version](https://img.shields.io/badge/version-0.1.7-blue.svg)

Agendo is a VS Code extension for managing Markdown-backed todo files from a dedicated Activity Bar
tree and an editor-window board. It keeps task state in the repository while adding fast ways to
filter, group, prioritize, summarize, and move work through its lifecycle.

## Why Agendo

Agendo treats todo items as real Markdown files in your workspace instead of hidden database records. That means:

- each task remains easy to inspect and edit in plain Markdown
- status and priority changes keep the filename, frontmatter, and folder layout aligned
- the tree and board provide complementary list and visual workflows
- the workflow fits developer-first repositories and project notes
- the bundled skill can help you or a future agent pick up the work with the right context

## The built-in skill: context that survives context switches

Agendo is not just a todo manager. It also bundles an installable companion skill that manages and
creates tasks using the same todo conventions. That matters when work gets interrupted: the skill
helps you or another agent understand what is already in progress, what is planned, and what should
happen next.

This is especially useful for:

- switching between personal work sessions or AI agents
- resuming a partially completed task after a break
- keeping work logs and learnings attached to a task instead of lost in chat history
- finding the right next action without re-reading an entire repo from scratch
- reconciling todos against the current codebase to catch stale work and propose
  reviewable updates

The skill is designed to keep the task system and the project context aligned, so future work can resume from a known state instead of a blank slate.

Each non-trivial todo can carry a compact, agent-maintained Resume Context:

```markdown
## Resume Context

**Current state:** Search empty states and clear-search behavior are implemented.

**Next step:** Verify the extension in a development host.
```

The Work Log remains the detailed history, while frontmatter `dependencies` remain the structured
source of truth for blockers. Agendo does not require owners, assignments, or a team mode; the same
continuity workflow serves an individual user, multiple AI sessions, and optionally shared files.

The skill also includes an **advisory reconciliation workflow** for when todos may be stale
relative to the codebase. It runs deterministic integrity checks, gathers focused evidence, and
proposes status or wording updates for you to approve — it never moves a file or rewrites history
on its own, and it reserves `complete` for verified acceptance criteria.

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
060-in-progress-p1-fix-release-checks.md
061-ready-p1-verify-release-checks.md
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
| `agendo.viewMode` | `preview` | Open todos in `editor`, `preview`, or `previewEditor` mode |
| `agendo.gitignoreTodos` | `false` | Optionally add a wildcard `.gitignore` in the todo root |
| `agendo.skillUpdateSource` | GitHub raw base URL | Source used for updating the bundled Agendo skill |

## Project structure

```text
.
├── .github/
│   ├── instructions/
│   └── workflows/
├── docs/
│   └── todos/
├── resources/
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

## Contributing

Contributions are welcome.

1. Fork or clone the repository.
2. Create a feature branch.
3. Keep changes focused and aligned with the repo’s task-driven workflow.
4. Run the relevant validation commands before opening a PR.
5. Keep the README and project docs updated when behavior changes.

When working on the project, follow the repo’s existing conventions and keep the implementation consistent with the VS Code extension patterns already in `src/`.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
