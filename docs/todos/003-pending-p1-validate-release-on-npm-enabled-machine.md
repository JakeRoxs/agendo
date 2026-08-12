---
status: pending
priority: p1
issue_id: "003"
tags: [release, validation, npm, vscode-extension, vsix]
dependencies: []
---

# Validate the Agendo release on an npm-enabled machine

Run the complete build, test, package, and smoke-test workflow on a machine that
can access the public npm registry. The current development environment cannot
reliably install or execute npm dependencies, so release validation could not be
completed here.

This task validates release readiness only. Do not publish the GitHub repository
or the extension to the VS Code Marketplace as part of this task.

## Current State

Static release metadata is aligned:

- `package.json` name: `agendo`
- `package.json` version: `0.1.0`
- `package-lock.json` package/version: `agendo` / `0.1.0`
- `CHANGELOG.md` release heading: `[0.1.0] - Unreleased`
- Repository URLs target `https://github.com/JakeRoxs/agendo`.
- The extension entry point is `out/extension.js`.
- The bundled skill is under `resources/skill/`.

The repository's `npm test` lifecycle runs all three automated checks:

1. TypeScript compilation (`npm run compile`)
2. ESLint (`npm run lint`)
3. VS Code integration tests (`node ./out/test/runTest.js`)

## Prerequisites

- A clean clone or worktree containing the latest Agendo changes.
- Node.js and npm with access to `https://registry.npmjs.org/`.
- Network access for `@vscode/test-electron` to obtain the VS Code test runtime.
- VS Code's `code` CLI available for the packaged-extension smoke test.

## Validation Steps

Run from the repository root in PowerShell:

```powershell
node --version
npm --version
npm config get registry
npm ci --registry=https://registry.npmjs.org/
npm test
npm run vscode:prepublish
npx --yes @vscode/vsce ls
npx --yes @vscode/vsce package --out agendo-0.1.0.vsix
```

If the registry check reports a private or unavailable registry, keep the
explicit `--registry=https://registry.npmjs.org/` override on installation. Do
not regenerate the lockfile unless dependency changes are intentional.

Review the `vsce ls` output and confirm the package includes at least:

- `package.json`
- `README.md`
- `CHANGELOG.md`
- `LICENSE`
- `out/extension.js` and the required compiled `out/**` files
- `resources/skill/SKILL.md`
- `resources/skill/assets/todo-template.md`
- `resources/skill/.skill-meta.json`

Confirm development-only files and local artifacts are not included, especially
`src/**`, `node_modules/**`, `.git/**`, and `docs/todos/**`.

## VSIX Smoke Test

Install the generated package into VS Code:

```powershell
code --install-extension .\agendo-0.1.0.vsix --force
```

Open a disposable workspace and verify:

- The Agendo Activity Bar container and Todos view load without activation errors.
- A todo can be created from the built-in template.
- Todos can be filtered and searched.
- A todo opens in Markdown preview.
- Status changes update frontmatter, filename, and folder placement together.
- Cancelling adds the cancellation banner and reopening removes it.
- Priority changes update frontmatter and filename together.
- Choosing a custom root writes the expected `.todos-config.json` projection.
- The gitignore toggle writes/removes the todos-root `.gitignore` as expected.
- Install/Enable Agendo Skill copies the bundled skill and template successfully.
- Update Agendo Skill from Source may fail until `JakeRoxs/agendo` is published;
  treat that as expected and cover its live URL check in issue `002`.

After testing, inspect VS Code's Extension Host output and record any warnings or
errors below.

## Failure Handling

- Capture the full failing command and output in the Work Log.
- Fix code, metadata, or packaging issues in this repository, then rerun the
  failed command and the complete `npm test` workflow.
- Do not mark this todo complete if tests were skipped or the VSIX was not
  installed and smoke-tested.
- Keep GitHub publication work in issue `002`.

## Acceptance Criteria

- [ ] `npm ci` completes from the committed lockfile using the public registry.
- [ ] `npm test` passes compilation, lint, and VS Code integration tests.
- [ ] `npm run vscode:prepublish` succeeds.
- [ ] `npx @vscode/vsce ls` contains all runtime and bundled-skill assets.
- [ ] The VSIX packages successfully as `agendo-0.1.0.vsix`.
- [ ] The packaged VSIX installs and activates in VS Code without errors.
- [ ] Core todo lifecycle, configuration bridge, gitignore, and skill-install flows pass smoke testing.
- [ ] Any warnings, failures, or follow-up fixes are recorded in the Work Log.
- [ ] This todo is moved to `complete/` and renamed with the `complete` status after all checks pass.

## Work Log

### 2026-08-12 - Validation handoff created

**By:** GitHub Copilot / jake.morgeson

**Actions:**
- Recorded the npm/network limitation in the current environment.
- Captured the automated build/test/package commands for an npm-enabled machine.
- Added VSIX contents and installed-extension smoke-test checklists.

**Outcome:**
- Pending execution on a machine with reliable public npm registry access.
