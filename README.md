# Agendo

![VS Code Extension](https://img.shields.io/badge/VSCode-Extension-007ACC?logo=visual-studio-code)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Version](https://img.shields.io/badge/version-0.1.2-blue.svg)

Agendo is a VS Code extension for managing Markdown-backed todo files from a dedicated Activity Bar tree view. It helps when a repo accumulates too many tasks and the file tree becomes noisy and hard to scan without a way to filter, group, and prioritize them.

## Why Agendo

Agendo treats todo items as real Markdown files in your workspace instead of hidden database records. That means:

- each task remains easy to inspect and edit in plain Markdown,
- status and priority changes stay in sync with the filename and folder layout,
- the tree view gives fast filtering and searching across a repo,
- the workflow fits developer-first repositories and project notes,
- the bundled skill can help future agents or teammates pick up the work with the right context.

## The built-in skill: context that survives context switches

Agendo is not just a todo manager. It also installs a reusable companion skill that manages and creates tasks using the same todo conventions. That matters when work gets interrupted: the skill can help an agent or collaborator understand what is already in progress, what is planned, and what context has been recorded in prior notes.

This is especially useful for:

- handoff between humans and AI agents,
- resuming a partially completed task after a break,
- keeping work logs and learnings attached to a task instead of lost in chat history,
- finding the right next action without re-reading an entire repo from scratch.

The skill is designed to keep the task system and the project context aligned, so future work can resume from a known state instead of a blank slate.

## Features

- Tree view grouped by status and priority
- Search and filtering by text, status, and priority
- Quick task creation with generated IDs and default priority
- Status transitions that keep filenames, frontmatter, and folder placement aligned
- Priority updates and rename support
- Markdown preview integration for open tasks
- Optional `.gitignore` handling for the todo root
- Bundled companion skill for creating and managing tasks with repo-aware context
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
060-ready-p1-fix-release-checks.md
```

The naming convention includes:

- `issue_id` — zero-padded, sequential, and unique
- `status` — `pending`, `ready`, `backlogged`, `complete`, or `cancelled`
- `priority` — `p1`, `p2`, or `p3`
- `description` — kebab-case text

Todo files may also include optional frontmatter such as:

```yaml
key: "JIRA-123"
```

This external tracking key is shown in the tree and used for search only when present. Legacy `jira:` frontmatter is still supported.

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
- Choose a status and priority
- The extension will generate the next available ID and create a Markdown file for you

You can also invoke the bundled skill from chat or an agent workflow, for example:

```text
/agendo Create a todo for investigating the CI failure in the release pipeline
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
| `agendo.openInPreview` | `true` | Open todo files in Markdown preview |
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
│   ├── commands.ts
│   ├── configuration.ts
│   ├── extension.ts
│   ├── output.ts
│   ├── test/
│   └── todos/
├── coverage/
├── AGENTS.md
├── CHANGELOG.md
├── LICENSE
├── README.md
├── biome.json
├── package.json
├── sonar-project.properties
├── tsconfig.json
└── reports/
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

## Roadmap

Planned improvements include:

- richer board-style task views,
- more advanced task visualization,
- deeper workflow automation around todo lifecycle management.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
