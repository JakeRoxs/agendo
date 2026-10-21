# Agendo Skill

The Agendo skill is an installable companion that manages and creates tasks using the same todo
conventions as the extension. It helps you or another agent understand what is already in progress,
what is planned, and what should happen next.

## When to use the skill

- Switching between personal work sessions or AI agents
- Resuming a partially completed task after a break
- Keeping work logs and learnings attached to a task instead of lost in chat history
- Finding the right next action without re-reading an entire repo from scratch
- Reconciling todos against the current codebase to catch stale work and propose reviewable updates

## Resume Context

Each non-trivial todo can carry a compact, agent-maintained Resume Context:

```markdown
## Resume Context

**Current state:** Search empty states and clear-search behavior are implemented.

**Next step:** Verify the extension in a development host.
```

The Work Log remains the detailed history, while frontmatter `dependencies` remain the structured
source of truth for blockers. Agendo does not require owners, assignments, or a team mode; the same
continuity workflow serves an individual user, multiple AI sessions, and optionally shared files.

## Reconciliation workflow

The skill includes an **advisory reconciliation workflow** for when todos may be stale relative to
the codebase. It runs deterministic integrity checks, gathers focused evidence, and proposes status
or wording updates for you to approve — it never moves a file or rewrites history on its own, and it
reserves `complete` for verified acceptance criteria.

Ask an agent with the Agendo skill to review the entire todo repository with one prompt:

```text
Use the Agendo skill to review all todos and identify work that is already complete or superseded.
```

Or invoke the skill directly if your agent host exposes user-invocable skills:

```text
/agendo review all todos
```

The skill inventories every configured state folder and reviews all non-terminal todos, including
the backlog. When the repository is too large for one focused pass, it automatically continues in
stable issue-ID batches, tracks reviewed and remaining IDs, and returns one consolidated report for
approval. It uses the existing `complete` and `cancelled` states rather than creating a separate
archive folder.

## Creating todos with the skill

You can ask a compatible agent host to use the installed Agendo skill explicitly:

```text
Use the Agendo skill to create a todo for investigating the CI failure in the release pipeline.
```

This is especially useful when you want a follow-up task captured into the same repo-managed
workflow without losing the surrounding context.

## Skill invocation

When invoked as `/agendo` without a specific operation, the skill shows a concise status summary:

1. Counts by status — pending, in-progress, ready, backlogged, complete, cancelled
2. Pending items needing triage — list titles and priorities
3. Active work — in-progress and ready items with their next steps from Resume Context
4. Blocked items — active items with unresolved dependencies

With an argument, the skill interprets the request directly:

- `/agendo make a todo investigating the login bug` → Creates a new todo
- `/agendo triage` → Lists pending items and begins triage
- `/agendo what's next` → Shows active work and unblocked items
- `/agendo complete 005` → Marks todo 005 as complete
