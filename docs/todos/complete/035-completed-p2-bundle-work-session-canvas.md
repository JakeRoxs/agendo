---
status: completed
priority: p2
issue_id: "035"
tags: [canvas, extension, packaging, skill]
dependencies: ["033"]
---

# Bundle the Work Session Canvas in the Extension

Ship the `agendo-work-session` Copilot canvas inside the Agendo extension and install it into the workspace alongside the skill.

## Problem Statement

Todo 033 produced a working project canvas, but it lived only in this repo's `.github/extensions/` folder. `.vscodeignore` excludes `.github/**`, so users of the packaged extension never received it, even though the 1.4.7 skill tells agents to open it for the active todo.

## Findings

- Copilot discovers project canvases in `.github/extensions/{name}/`, so the canvas has to be written into the workspace rather than the user's home directory like the skill.
- The canvas depends only on `@github/copilot-sdk/extension`, which the host provides, so no `node_modules` need to ship.
- Source of truth is now `resources/canvas/agendo-work-session/`, which is packaged because `resources/` is not excluded in `.vscodeignore`. `vsce ls` lists both canvas files.
- The canvas has its own version in `.canvas-meta.json` (like the skill's `.skill-meta.json`), separate from the extension and skill versions.
- The `/create-canvas` skill says not to create a `package.json`; the runtime resolves `@github/copilot-sdk` itself. The canvas loads and runs without one.

## Acceptance Criteria

- [x] Canvas source lives under `resources/canvas/agendo-work-session/` and is included in the packaged extension
- [x] Installing the skill also installs the canvas at user level in `~/.copilot/extensions/agendo-work-session/`
- [x] An already-installed canvas is refreshed on activation only when the bundled version is newer, and is never created on activation
- [x] Canvas has its own version (0.1.0) in `.canvas-meta.json`, separate from the extension and skill versions
- [x] Changelog entry added under 0.1.16
- [x] README documents the canvas and shows its own version badge
- [x] Verified end to end: package the vsix, install it, run the install command in a clean workspace, and open the canvas

## Resume Context

**Current state:** Done. The canvas (v0.1.0) is bundled, installs at user level, and is verified from the packaged vsix installed in the maintainer's own VS Code window. It is also available as a `canvas` view mode, a right-click action on tree items and board cards, a separate Skill-panel canvas row, and collapsible sections with per-todo memory. Status-aware layout and editing moved to todo 036.

**Next step:** None.

## Work Log

### 2026-10-20 - View mode, entry points, and verification

**By:** Agent

**Actions:**

- Added the `canvas` value for `agendo.viewMode`: `CanvasViewer` runs the canvas server and embeds it in a webview tab
- Added a right-click **Open in Work Session Canvas** action on tree items and board cards, and a separate canvas row and install/update command in the Skill panel
- Fixed `frame-ancestors` to include `vscode-webview:` and `vscode-file:` so the embedded page is not blocked
- Restored `.canvas-meta.json`, which had shipped empty, and added a guard test
- Added the description section and collapsible sections with per-todo collapse memory
- Installed the packaged vsix and used the canvas in VS Code

**Learnings:**

- Chromium silently blocks iframes when an ancestor scheme does not match `frame-ancestors`, leaving an empty tab with no log entry
- Tests that call the skill update must use a temp `HOME`, or they overwrite the real installed skill

### 2026-10-19 - Moved to a user-level install

**By:** Agent

**Actions:**

- Confirmed a user-level canvas location exists (`~/.copilot/extensions/<name>/`, documented in the Backrooms plugin README and Copilot CLI docs); earlier notes saying only project and plugin locations exist were wrong
- `CanvasManager` now installs to `<COPILOT_HOME or ~/.copilot>/extensions/agendo-work-session/`, migrates away an older workspace copy (only if it has `.canvas-meta.json`), and the skill install command also installs the canvas when the skill is already current
- Added `resolveWorkspaceRoot` to `todos.mjs`: a project install derives the repo from its own path; a user-level install starts from the process working directory and walks up to the nearest folder with a todos folder
- Moved this repo's dev copy to `~/.copilot/extensions/`, removed `.github/extensions/`, reloaded: the runtime lists it as `[user]` and it reads this repo's todos

**Learnings:**

- The extension process working directory is the session's repo (observed), but that is undocumented, so the resolver treats it as a fallback
- After moving an extension between scopes, the host still binds the old `instanceId` to the old extension (`already owned by a different canvas`), so the first open needs a new `instanceId`; this clears on a fresh session
- Not tested: a user-level install while two workspaces are open at once, or a host that does not set the working directory to the repo

### 2026-10-19 - Aligned with create-canvas guidance

**By:** Agent

**Actions:**

- Removed the bundled `package.json`; version now lives in `.canvas-meta.json` and is read by `CanvasManager`
- Split the single `extension.mjs` into `server.mjs`, `todos.mjs`, `page.mjs`, `markdown.mjs`, and `assets/page.css` / `assets/page.js`, leaving `extension.mjs` as wiring
- Dropped `WORKSPACE_ROOT`/`cwd`; the repo root is now derived from the extension's own install path (`.github/extensions/<name>/`)
- `onClose` is kept only to stop the instance server; reopening reuses a live server and re-reads the todo file
- Served the page with a strict CSP (external script only), a Host-header check, `nosniff`, and `no-store`
- Validated `todoId` format and action inputs, and made criterion writes atomic (temp file then rename)
- Added ARIA roles and labels, `aria-live` status text, `aria-expanded` on the work log toggle, and a focus outline
- `CanvasManager` now compares versions with the skill's `compareVersions`, only updates when bundled is newer, and removes the obsolete `package.json`
- Set the canvas version (first release: 0.1.0) and updated the README badge and changelog
- Reloaded the extension, listed capabilities, opened the canvas, ran `get_todo_context` and `mark_criterion_met`, reopened the same instance (same URL), and exercised the HTTP endpoints

**Learnings:**

- The extension loads with no `package.json`
- The runtime does not appear to give the extension a workspace path, so deriving it from the install location is the portable option
- `onClose` is not guaranteed to run when a user closes a panel, so the server may stay alive until the extension restarts
- Not tested: a packaged vsix install, and how the host behaves when the extension is installed in a workspace whose root is not the first folder

### 2026-10-19 - Bundled canvas and installer

**By:** Agent

**Actions:**

- Copied the canvas to `resources/canvas/agendo-work-session/` and gave it its own version
- Added `src/todos/canvasManager.ts` with `install()` and `updateIfInstalled()`
- Wired it into `registerSkillCommands` (install) and `activate` (refresh if present)
- Ran `tsc --noEmit` and `biome check --write` on the changed files
- Confirmed with `vsce ls` that both canvas files are packaged
- Added the changelog entry under 0.1.16

**Learnings:**

- `.vscodeignore` excludes `.github/**`, which is why the canvas could not ship from where it was
- The skill install command returns early when the skill is current, so a user already on the latest skill version without the canvas would not get it from that command
- The activation refresh compares versions with `!==`, so a locally edited workspace copy with a different version is overwritten by the bundled one
- This repo's runtime copy lives in `~/.copilot/extensions/agendo-work-session/`; edit the file under `resources/canvas/` instead
