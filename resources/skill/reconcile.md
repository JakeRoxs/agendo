# Reconciling / Auditing Todos

Use this workflow when asked to reconcile, audit, "clean up," or re-check todos against the current
codebase — that is, when todos may be stale relative to the actual implementation.

Reconciliation compares each todo's recorded intent (problem, acceptance criteria, Resume Context)
against the repository *as it stands now* and produces **reviewable recommendations**. It does not
silently rewrite history.

Everything in this file inherits the conventions in [SKILL.md](./SKILL.md): the `{root}` and state
folder placeholders, the filename/frontmatter/folder rules, the status lifecycle, and the
move-before-edit rule. Resolve the `.agendo-config.json` file first, exactly as SKILL.md instructs.

## Safety first (non-negotiable)

- **Propose, don't apply.** Present recommendations and let the user decide what to apply. Never
  auto-move a file, change a status, or rewrite a todo without explicit approval.
- **Move before edit** for any lifecycle change, and route every transition through the Agendo
  lifecycle (rename → move → then edit the destination). This is the same rule SKILL.md applies to
  every status change.
- **`complete` only with verified acceptance criteria.** Recommend `complete` only when every
  acceptance criterion is checked and the work is confirmed working.
- **`ready` when implemented but unconfirmed.** Recommend `ready` when the implementation appears
  done but has not been confirmed to work.
- **Backlog and cancel are user decisions.** Never recommend `backlogged` (a prioritization choice)
  or `cancelled` without an explicit, stated reason from the user.
- **Preserve history.** Never rewrite Work Log entries or historical wording to "modernize" them.
  Append a reconciliation entry instead.

## Pass 1 — Deterministic integrity checks (no model required)

These checks catch structural problems and run entirely on file contents and folder layout.

- **Filename / frontmatter / folder sync**
  - Filename status token matches the frontmatter `status`.
  - Filename priority token matches the frontmatter `priority`.
  - Folder placement matches the status: active states in `{root}`, `backlogged` in `{backlog}`,
    `complete` in `{complete}`, `cancelled` in `{cancelled}`.
- **IDs**
  - No duplicate issue IDs across the root and every state subfolder.
  - IDs are zero-padded to 3 digits and unique.
- **Dependencies**
  - Every ID in `dependencies:` points to a real todo that exists.
  - A todo with dependencies is correctly flagged as blocked when any dependency is not yet
    terminal (`complete` or `cancelled`).
  - If a dependency is `cancelled`, flag it: the dependency will not be delivered, so dependent work
    must be reassessed rather than left mechanically blocked.
- **Structure**
  - Required core sections are present: Problem Statement, Acceptance Criteria, Resume Context,
    Work Log.
  - Non-trivial todos (title length > 10 chars or body length > 100 chars) should have Resume Context.
- **Cancelled hygiene**
  - `cancelled` todos carry the `cancelled` tag and the `> **CANCELLED**` (or
    `> **CANCELLED / SUPERSEDED by [NNN]**`) banner under the title.
  - `superseded_by` frontmatter, when present, points to a real todo.
  - Orphaned `superseded_by` references are flagged (the referenced todo does not exist).
- **Dependency consistency**
  - Every ID in `dependencies:` points to a real todo that exists.
  - A todo with dependencies is correctly flagged as blocked when any dependency is not yet
    terminal (`complete` or `cancelled`).
  - If a dependency is `cancelled`, flag it: the dependency will not be delivered, so dependent work
    must be reassessed rather than left mechanically blocked.
  - Todos with incomplete dependencies should show a blocked indicator in their description.
- **Tag hygiene**
  - Tags are kebab-case (lowercase, hyphens, no spaces).
  - No duplicate tags within a single todo.
  - Tags are consistent across related todos (e.g., same feature uses same tag).
- **Stale references**
  - No other todo still references an old filename after a rename/move.
  - No dead links to other todos (references to todos that no longer exist).

## Pass 2 — Semantic review (the reconciliation value-add)

This is the part that requires understanding the codebase. Gather **focused** evidence, never the
entire workspace:

- The todo's full contents: frontmatter, Problem Statement, Acceptance Criteria, Resume Context,
  and the latest Work Log entry.
- Code paths, symbols, and tests the todo references or that implement it.
- The current state of its dependencies.
- Recent changes to the affected areas (`git log`/`git diff` on relevant paths, when available).

Then evaluate:

- Does the described problem still exist, or has it already been solved?
- Is each acceptance criterion actually implemented and satisfied in the current code?
- Has a newer change superseded this todo (making it a cancellation candidate)?
- Is the Resume Context `Current state` / `Next step` still accurate?
- Is any wording now stale relative to current naming, APIs, or architecture?

## Presenting recommendations

Present findings as a concise report grouped by todo. For each recommendation, use a structured
format that includes the todo ID, current status, recommendation, evidence, and confidence:

```
## Reconciliation Report

### [ID] · [title] — [current status] → [recommended status] (confidence: high/medium/low)
- **What**: [brief description of recommendation]
- **Evidence**:
  - [file:path] — [one-line reason]
  - [file:path] — [one-line reason]
- **Acceptance criteria**: [X/Y satisfied] (when status change recommended)
- **Missing verification**: [what is still needed, if any]
- **Action**: [approve / defer / investigate further]
```

For each recommendation:

- The todo ID and current status.
- What is recommended (a status change, a wording/Resume Context edit, or a structural fix).
- The evidence: file paths and, where useful, line references and a one-line reason.
- Per-acceptance-criterion assessments when a status change is recommended.
- Confidence level (high: evidence is complete and unambiguous; medium: evidence suggests a conclusion but gaps exist; low: evidence is sparse or conflicting).
- Any verification that is still needed.

Example:

```
### 020 · Dependency visualization — ready → complete (confidence: high)
- **What**: All acceptance criteria satisfied; implementation verified.
- **Evidence**:
  - src/todos/todoTreeProvider.ts:49-74 — DependencyNode type and rendering implemented
  - src/test/todoModel.test.ts:615 — Regression coverage added
- **Acceptance criteria**: 5/5 satisfied
- **Missing verification**: runtime behavior in VS Code not manually confirmed
- **Action**: approve status change to complete
```

Ask the user to approve each change. Apply only what is approved, using the Agendo lifecycle.

If evidence is insufficient, say so plainly rather than guessing — list what is missing instead of
inventing a conclusion.

## Notes

- Run the deterministic pass first; its findings can inform what the semantic pass needs to
  inspect.
- Reconciliation is read-heavy: prefer targeted reads and searches over dumping large files.
- This workflow is advisory. The human (or an explicit, deliberate agent step) is the final
  authority on what changes.
