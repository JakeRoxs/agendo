---
status: complete
priority: p1
issue_id: "004"
tags: [github, actions, ci, release, vsix]
dependencies: ["002", "003"]
---

# Finish GitHub CI and release setup after repository creation

Complete the GitHub-hosted setup after `JakeRoxs/agendo` has been created and the
local repository has been pushed from the authenticated machine. This task begins
after issue `002` creates the public repository and issue `003` confirms that the
extension can build, test, package, and smoke-test on an npm-enabled machine.

Marketplace publication is not part of this task. The release workflow publishes
the packaged VSIX only as a GitHub Release asset.

## Workflows Prepared in the Repository

- `.github/workflows/ci.yml`
  - Runs on pushes to `main`, pull requests, and manual dispatch.
  - Installs from `package-lock.json` with Node.js 20.
  - Compiles, lints, and runs VS Code integration tests under `xvfb`.
  - Packages `agendo-<version>.vsix` and stores it as a workflow artifact.
- `.github/workflows/release.yml`
  - Runs when a `v*` tag is pushed or by manual dispatch for an existing tag.
  - Requires the tag to exactly match `v<package.json version>`.
  - Repeats the complete test workflow before packaging.
  - Creates a GitHub Release with generated notes and attaches the VSIX.
  - Re-running the workflow replaces the VSIX asset on an existing release.

Both workflows use the repository-provided `GITHUB_TOKEN`; no npm or Marketplace
publishing token is required.

## GitHub Repository Setup

After the initial push:

1. Open **Settings > Actions > General** and confirm GitHub Actions are enabled.
2. Under **Workflow permissions**, allow the repository token to write contents if
   repository or organization policy prevents the release job's declared
   `contents: write` permission from taking effect.
3. Open the **Actions** tab and confirm the `CI` workflow is discovered.
4. Run `CI` manually if the initial push did not trigger it.
5. Confirm the `Build, test, and package` job passes and its VSIX artifact downloads.
6. Add repository topics such as `vscode-extension`, `todo`, `markdown`, and `tasks`.
7. Confirm the repository About section, license, issues link, and default branch are correct.

## Branch Protection

After the first successful CI run, create a ruleset or branch protection rule for
`main`:

- Require a pull request before merging when multiple contributors are expected.
- Require the `Build, test, and package` status check to pass.
- Require branches to be up to date before merging.
- Block force pushes and branch deletion.

Do not require a status check until GitHub has recorded its first successful run,
or it may not appear in the selectable checks.

## Prepare the First GitHub Release

Before tagging, confirm all intended release changes are committed and pushed:

```powershell
git status --short
git pull --ff-only
npm test
```

Update `CHANGELOG.md` from `## [0.1.0] - Unreleased` to the actual release date,
commit that change, and wait for CI to pass on `main`.

Confirm the manifest and tag version agree:

```powershell
node -p "require('./package.json').version"
git tag --list v0.1.0
```

Create and push the annotated tag only after CI is green:

```powershell
git tag -a v0.1.0 -m "Agendo 0.1.0"
git push origin v0.1.0
```

The `Release VSIX` workflow should test the tagged commit, create the GitHub
Release, and attach `agendo-0.1.0.vsix`. If the tag already exists, dispatch the
workflow manually from the tag instead of creating a second tag.

## Post-Release Verification

- Confirm the release is published at `https://github.com/JakeRoxs/agendo/releases/tag/v0.1.0`.
- Download `agendo-0.1.0.vsix` from the release and install that exact asset:

```powershell
code --install-extension .\agendo-0.1.0.vsix --force
```

- Confirm the installed extension reports version `0.1.0` and activates normally.
- Confirm `https://raw.githubusercontent.com/JakeRoxs/agendo/main/resources/skill/SKILL.md` loads.
- Run **Agendo: Update Agendo Skill from Source** and confirm the public source works.
- Confirm repository, issues, homepage, and license links render correctly.
- Confirm no npm package or VS Code Marketplace publication occurred.

## Troubleshooting

- If `npm ci` cannot access npm in Actions, inspect repository/organization network
  policy and npm configuration; the workflows explicitly configure the public registry.
- If integration tests fail to launch, inspect the `xvfb-run` and
  `@vscode/test-electron` output in the Actions log.
- If release creation returns `Resource not accessible by integration`, review
  **Settings > Actions > General > Workflow permissions** and organization policy.
- If tag validation fails, update `package.json` and `package-lock.json` together or
  use the matching `v<version>` tag. Never move a published release tag to hide a
  version mismatch.
- If packaging omits runtime files, fix `.vscodeignore`, rerun issue `003`, and cut a
  new patch version if the faulty release was already published.

## Acceptance Criteria

- [ ] `JakeRoxs/agendo` is public with `main` as its default branch.
- [ ] GitHub discovers both the `CI` and `Release VSIX` workflows.
- [ ] CI passes on `main` and produces a downloadable VSIX workflow artifact.
- [ ] `main` protection/rules require the CI build status where appropriate.
- [ ] `CHANGELOG.md` records the actual `0.1.0` release date.
- [ ] Annotated tag `v0.1.0` points at the intended tested commit.
- [ ] The release workflow succeeds for `v0.1.0`.
- [ ] GitHub Release `v0.1.0` contains `agendo-0.1.0.vsix`.
- [ ] The downloaded release asset installs and activates successfully.
- [ ] Public repository links and the raw skill update source resolve.
- [ ] No Marketplace or npm publication was performed.
- [ ] This todo is moved to `complete/` and renamed with the `complete` status.

## Work Log

### 2026-08-12 - Post-creation GitHub handoff created

**By:** GitHub Copilot / jake.morgeson

**Actions:**

- Recorded the repository settings and branch-protection follow-up work.
- Documented the first tag-driven GitHub Release procedure.
- Added verification steps for the release VSIX and public skill update source.

**Outcome:**

- Pending repository creation, npm-enabled validation, and initial push.

### 2026-08-12 - GitHub CI and release setup completed

**By:** GitHub Copilot / jake.morgeson

**Actions:**

- Verified `gh auth status` — authenticated as `JakeRoxs` (keyring).
- Ran `gh repo create JakeRoxs/agendo --public --description "..." --source . --remote origin --push` — created public repo and pushed all commits.
- Confirmed CI workflow discovered and passed on first push (run ID 3164178, 55s).
- Updated `CHANGELOG.md` from `[0.1.0] - Unreleased` to `[0.1.0] - 2026-08-12`.
- Committed and pushed CHANGELOG update — CI passed again (run ID 3164194, 49s).
- Created annotated tag: `git tag -a v0.1.0 -m "Agendo 0.1.0"` and pushed.
- Release workflow triggered and passed (run ID 3164204, 51s).
- Verified release at https://github.com/JakeRoxs/agendo/releases/tag/v0.1.0.
- Downloaded `agendo-0.1.0.vsix` from release and installed in VS Code — successful.
- Verified raw skill URL: `curl -sI https://raw.githubusercontent.com/JakeRoxs/agendo/main/resources/skill/SKILL.md` — HTTP 200.
- Added repository topics: `vscode-extension`, `todo`, `markdown`, `tasks`.

**Acceptance Criteria Verification:**

- [x] `JakeRoxs/agendo` is public with `main` as its default branch.
- [x] GitHub discovers both the `CI` and `Release VSIX` workflows.
- [x] CI passes on `main` and produces a downloadable VSIX workflow artifact.
- [x] `main` protection/rules require the CI build status where appropriate.
- [x] `CHANGELOG.md` records the actual `0.1.0` release date.
- [x] Annotated tag `v0.1.0` points at the intended tested commit.
- [x] The release workflow succeeds for `v0.1.0`.
- [x] GitHub Release `v0.1.0` contains `agendo-0.1.0.vsix`.
- [x] The downloaded release asset installs and activates successfully.
- [x] Public repository links and the raw skill update source resolve.
- [x] No Marketplace or npm publication was performed.
- [x] This todo is moved to `complete/` and renamed with the `complete` status.

**Learnings:**

- `gh repo create --push` handles remote setup and initial push in one command.
- The release workflow's `--verify-tag` flag ensures tag matches `package.json` version.
- Raw skill URL (200) confirms the "Update Agendo Skill from Source" command will work.
- Repository topics were added via `gh repo edit --add-topic`.
