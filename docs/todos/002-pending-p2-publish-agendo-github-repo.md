---
status: pending
priority: p2
issue_id: "002"
tags: [github, publishing, release, agendo]
dependencies: []
---

# Create and publish the GitHub repo `JakeRoxs/agendo`

The extension's remote repo does not exist yet. All in-repo references were
renamed to point at `JakeRoxs/agendo`, but nothing has been created or pushed on
GitHub. Do this on the machine authenticated as the `JakeRoxs` account.

## Problem Statement

During the `file-todos` → `Agendo` rename, the GitHub repo could not be created
or renamed:

- `gh` on the current dev machine is authenticated as `jake-morgeson_schwab`, not
  `JakeRoxs`.
- `JakeRoxs/vscode-llm-todos` does not resolve — the repo is unpublished.
- The local clone has **no git remote** configured.

So there is nothing to rename remotely yet; the repo needs to be created fresh
under the correct account with the final name `agendo`.

## Findings

- In-repo references already target the final name (no `vscode-llm-todos` left):
  - `package.json`: `repository.url`, `bugs.url`, `homepage`,
    and `agendo.skillUpdateSource` default → `https://github.com/JakeRoxs/agendo`
    / `https://raw.githubusercontent.com/JakeRoxs/agendo/main/resources/skill`.
  - `resources/skill/SKILL.md`: extension link → `https://github.com/JakeRoxs/agendo`.
- The local repository folder has been renamed to `agendo`.
- The `.vscode/*.code-workspace` scaffolding file was removed.

## Recommended Action

On the machine signed in as `JakeRoxs`:

```powershell
gh auth login                 # ensure the active account is JakeRoxs
gh repo create JakeRoxs/agendo --public --source . --remote origin --push
```

If a repo was ever created under the old name, rename instead of creating:

```powershell
gh repo rename agendo --repo JakeRoxs/vscode-llm-todos
git remote set-url origin https://github.com/JakeRoxs/agendo.git
```

## Technical Details

**Affected / already-updated files:**
- `package.json` — `repository`, `bugs`, `homepage`, `agendo.skillUpdateSource`
- `resources/skill/SKILL.md` — extension link

**Post-publish checks:**
- Confirm `agendo.skillUpdateSource` raw URL resolves once `main` is pushed
  (used by "Update Agendo Skill from Source").
- Confirm `LICENSE` (MIT) renders on the repo page.

## Acceptance Criteria

- [ ] `JakeRoxs/agendo` exists on GitHub and is public.
- [ ] `main` branch pushed; `git remote -v` points at `JakeRoxs/agendo`.
- [ ] Raw skill URL (`.../JakeRoxs/agendo/main/resources/skill/SKILL.md`) loads.
- [ ] Repo links in `package.json` open correctly (repository / bugs / homepage).

## Notes

- Publishing to the VS Code Marketplace is separate from creating the repo and is
  out of scope for this todo.
