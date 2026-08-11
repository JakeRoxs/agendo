---
status: pending
priority: p3
issue_id: "001"
tags: [tooling, vscode-extension, developer-experience, file-todos, skill-update]
dependencies: []
---

# VS Code Extension: File-Todos Manager (view / filter / lifecycle)

Investigation + plan for a lightweight VS Code extension that provides an easier way to
view and manage the `docs/todos/` markdown todos than navigating the file tree, while
keeping every todo `.md`-file-backed in the repo (and gitignored, as today).

> **Note:** This todo (issue `001`) is the first in this repo; it was copied from another
> repo (where it was `060`). A **live example of current file-todos usage** — real todos,
> folder layout, filename/frontmatter contract, and banners in practice — can be inspected
> at `C:\TSS_Website\docs\todos`. Use it as the reference for how the system is actually
> used today when designing/validating the extension.

> **STATUS: v1 build in progress.** The extension has been scaffolded in this repo
> (`todo-ext`) from a third-party VS Code extension template. Core TreeView,
> filtering/search, status transitions, the config bridge, skill bundling +
> install/update commands, and broken-link flagging on move/rename are all
> implemented. Dependency install + `tsc` verification is pending (blocked locally
> by npm registry auth). Remaining item: an optional richer settings webview.

## Problem Statement

The `file-todos` skill (installed at `~/.agents/skills/file-todos/`) tracks work as
markdown files under `docs/todos/` with a strict filename + frontmatter contract. Today the
only way to browse them is the VS Code file tree, which cannot express any of the metadata
that matters:

- No grouping or visibility by **status** (pending / ready / complete / cancelled) or **priority** (p1/p2/p3).
- No **filtering / searching** by tag, jira/issue id, dependency, or free text.
- Opening a todo defaults to the **source editor**, not markdown **preview**.
- Lifecycle changes (complete / cancel / — and the new **backlogged**) require manually
  keeping three things in sync by hand: the filename status token, the frontmatter `status`,
  and the **folder placement**, plus inserting/updating the contextual header banner.

We want a purpose-built, file-backed UI that removes that friction without migrating away
from plain markdown in the repo.

## Findings

Investigation of the current system (source of truth: `~/.agents/skills/file-todos/SKILL.md`,
`assets/todo-template.md`, and the live `docs/todos/` contents).

**Filename contract:** `{issue_id}-{status}-{priority}-{description}.md`
- `issue_id`: global sequential, zero-padded to 3 digits, **never reused** (next is `060`).
- `status` token today: `pending` | `ready` | `complete`. `cancelled` is **used in practice but
  never formalized** in the skill — there's no enum entry, no documented folder, and cancelled
  files are simply dropped into `complete/` next to genuinely-completed work (e.g.
  `053-cancelled-...-superseded-by-057.md`). This todo formalizes it alongside `backlogged`.
- `priority`: `p1` | `p2` | `p3`.
- `description`: kebab-case.

**Folder layout:**
- Active todos (`pending` / `ready`) live **directly** in the todos root, e.g. `docs/todos/`
  (NOT in a subfolder — a `docs/todos/**/*.md` glob MISSES them; must use a directory listing
  or a flat `docs/todos/*.md`).
- Terminal / parked states each get their **own sibling subfolder** under the root:
  - `complete/` — finished successfully (existing today).
  - `cancelled/` — abandoned / superseded (**planned**; today these are wrongly mixed into
    `complete/`, e.g. `053`, and will be migrated out).
  - `backlog/` — deprioritized-but-open (**planned**; new folder).
- Per-todo images live in `assets/{id}/` and **stay put** even after the todo file moves to
  `complete/` / `cancelled/` / `backlog/` (confirmed by existing items).
- **Gitignoring is optional, not a system requirement.** In this repo the convention is to
  gitignore the whole tree (a `.gitignore` containing just `*` in the todos root), but that's a
  per-repo choice — the extension exposes it as a **toggle** and the skill reads the current
  state from `.todos-config.json` (`gitignored`) to pick its file-discovery strategy.

**Frontmatter fields:** `status`, `priority`, `issue_id`, `tags[]`, `dependencies[]`, plus
optional `parent` / `children[]` (epics), `epic: true`, `superseded_by`, `jira`/issue refs.

**Two coupled sources of truth:** the filename status token AND frontmatter `status` must stay
in sync, and folder placement is **derived** from status. This is the main source of manual error.

**Contextual header banners:** cancelled / superseded files carry an in-body blockquote banner
directly under the `# title` (e.g. `> **CANCELLED / SUPERSEDED by [057]...**`). This is the
"contextual header" behavior the extension must generate/update on transitions.

**Cross-references use absolute paths** inside bodies (e.g.
`/C:/TSS_Website/docs/todos/050-...md`). Renames/moves will break these links.

## Decisions already made (from Q&A 2026-07-20)

1. **Scope for now:** investigation / plan only — captured in this todo (no scaffolding yet).
2. **v1 UI:** **native TreeView** in an Activity Bar container (defer any richer webview
   "board" with drag-drop columns to a later iteration).
3. **`backlogged` placement:** a **new `docs/todos/backlog/` subfolder**, mirroring how
   `complete/` keeps the active root clean. Requires a **skill update** (see below).
4. **Extension project location:** OPEN — see Open Questions. (Original question meant: a VS
   Code extension is its own project with its own `package.json`/build; it needs to live
   somewhere — a new folder inside `TSS_Website`, a sibling folder, or a separate repo.)

## Additional requirements (2026-07-20)

The extension should also own the **skill itself** and expose configuration that the skill can
read back — making the extension the single control surface for the whole file-todos system.

1. **Bundle the `file-todos` skill with the extension.** Ship the skill (`SKILL.md`,
   `assets/todo-template.md`, `.skill-meta.json`) inside the `.vsix` and provide a settings
   panel to **enable/install** it into the user's skills directory (`~/.agents/skills/file-todos/`),
   with an optional **update-from-GitHub** source (TBD — my GitHub page as the canonical
   distribution so the skill can be refreshed without a new extension release).
2. **Gitignore toggle.** A setting that, when enabled, writes a `.gitignore` containing exactly
   `*` into the todos root folder (matching today's behavior); disabling it removes that file.
3. **Custom root todos folder.** Allow choosing a root other than the default `docs/todos/`.
4. **Skill awareness of extension config.** The skill must be able to *read* the current
   configuration — specifically the **root folder** and whether the folder is **gitignored** —
   so it knows whether it can rely on VS Code glob search or must fall back to manual file
   discovery (`ls` / PowerShell / `find`). See the config-bridge design below.

### Extension ↔ skill config bridge

VS Code settings (`workspace`/`user` `settings.json`) are not visible to a markdown agent skill.
The extension must therefore also **persist config to a file the skill reads**. Proposal:

- Extension writes a small, committed-or-ignored config file at a **well-known path** the skill
  is taught to look for first — e.g. `<todos-root>/.todos-config.json`:

  ```json
  {
    "root": "docs/todos",
    "gitignored": true,
    "backlogFolder": "backlog",
    "cancelledFolder": "cancelled",
    "completeFolder": "complete"
  }
  ```

- The `file-todos` SKILL.md gets a new **"Read config first"** step: if `.todos-config.json`
  exists, use `root` for all paths and use `gitignored` to decide discovery strategy —
  **glob search is safe** when the folder is tracked, but when `gitignored: true` the agent must
  **not** rely on workspace glob/search (ignored files may be excluded) and should list the
  directory directly (`list_dir` / `Get-ChildItem` / `ls`). This directly addresses the
  existing `docs/todos/**/*.md`-misses-files pitfall.
- The extension keeps VS Code settings and `.todos-config.json` in sync (settings are the
  source of truth; the file is the skill-readable projection).

## Proposed Solution (v1)

Native `TreeDataProvider` in an Activity Bar view container, backed directly by the existing
`.md` files. No data migration required.

**Proposed module layout:**

| Module | Responsibility |
| ------ | -------------- |
| `todoModel.ts` | Parse one file → `{id, status, priority, title, tags, jira, dependencies, parent, folder, uri}` |
| `todoRepository.ts` | Scan `docs/todos/` root + `complete/` + (new) `backlog/`; cache; `FileSystemWatcher` refresh |
| `todoTreeProvider.ts` | `TreeDataProvider` grouping by status → priority; icons/colors per priority & status |
| `statusService.ts` | Transition engine: rewrite frontmatter, rename file (swap status token, keep id/priority/desc synced), move folder, insert/update contextual banner |
| `filterService.ts` | Filter/search state (status, priority, tags, jira, free text); persisted in `workspaceState` |
| `configService.ts` | Read/write VS Code settings; project them to `<root>/.todos-config.json`; resolve the active root folder; manage the gitignore-`*` file |
| `skillManager.ts` | Enable/install the bundled skill into `~/.agents/skills/file-todos/`; check version; optional update-from-GitHub |
| `settingsPanel` | Webview or `configuration` UI: enable/update skill, gitignore toggle, choose root folder |
| `commands.ts` | `openPreview`, `filter`, `search`, `setStatus.*`, `setPriority`, `refresh`, `createTodo`, `enableSkill`, `updateSkill`, `toggleGitignore`, `chooseRoot` |

**Tech:** TypeScript + esbuild bundle; `gray-matter` for frontmatter (or a small custom parser
to stay dependency-free). Open-in-preview default = invoke `markdown.showPreview` on the item
URI instead of opening a text editor.

**Contribution points:** `viewsContainers/activitybar`, `views`, `view/title` menus
(filter / search / refresh / collapse-all), `view/item/context` menus (status actions), and
`configuration` (todos root folder path, default priority, backlog-as-subfolder toggle,
gitignore-todos toggle, skill auto-update source).

### `backlogged` status + transition matrix (statusService)

`backlogged` = a deprioritized-but-still-open state that moves out of the active root into
`docs/todos/backlog/`.

`cancelled` = an **abandoned / superseded** state (terminal, like `complete`, but *not* done).
Today it is undocumented and shares `complete/`, which conflates "finished successfully" with
"never finishing." This plan formalizes it with its own **`docs/todos/cancelled/`** folder
(symmetric with `backlog/` and `complete/`), keeping the existing contextual banner behavior
(`> **CANCELLED / SUPERSEDED by [nnn]...**` under the title) and adding a `cancelled` tag.
Existing cancelled files in `complete/` (e.g. `053`) get a one-time migration into `cancelled/`.

| From → To | Filename token | Folder move | Frontmatter | Body / header |
| --------- | -------------- | ----------- | ----------- | ------------- |
| pending → ready | swap | none | `status` | — |
| any → backlogged | swap | → `backlog/` | `status: backlogged` | — |
| backlogged → ready/pending | swap | → root | `status` | — |
| any → complete | swap | → `complete/` | `status: complete` | append Work Log entry |
| any → cancelled | swap | → `cancelled/` | `status: cancelled` | insert `> **CANCELLED**` banner + `cancelled` tag |
| cancelled → ready/pending (reopen) | swap | → root | `status` | remove `CANCELLED` banner |

## Required skill update (`file-todos`)

Adding `backlogged` is a contract change and must be reflected in
`~/.agents/skills/file-todos/SKILL.md`:

- Add `backlogged` to the status enum (filename token + frontmatter).
- Document the new `docs/todos/backlog/` folder and that backlogged items live there.
- **Formalize `cancelled`** in the status enum (it's currently used but undocumented) and
  document the new `docs/todos/cancelled/` folder, the `CANCELLED`/`SUPERSEDED` banner, and the
  `cancelled` tag convention. Split it out from `complete/` and note the one-time migration of
  existing cancelled files.
- Exclude `backlogged` from "active / ready / find-next-work" queries and counts.
- Treat both `complete` and `cancelled` as **terminal** (excluded from active work), but keep
  them distinguishable (successful vs. abandoned) in queries and counts.
- Note `assets/{id}/` stays in place across a backlog/cancel move (same as complete).
- **Add a "Read `.todos-config.json` first" step** so the skill honors the extension's chosen
  `root` folder and uses `gitignored` to pick its discovery strategy (glob when tracked;
  direct directory listing when ignored). Skill must degrade gracefully when the config file
  is absent (fall back to the `docs/todos/` default + list-the-directory behavior it uses today).
- Keep the skill self-contained so it still works when installed **without** the extension
  (the extension is a convenience layer, not a hard dependency).

## Open Questions

- **Where should the extension project live?** ✅ **RESOLVED (2026-07-21): its own git
  repo** (`todo-ext`), separate from the app repo, installed as a `.vsix`. The todo was moved
  here alongside a third-party extension template used as the scaffold reference. (Superseded
  options: colocated `tools/` folder, or a sibling folder in the app workspace.)
- Should the extension **auto-rewrite** absolute cross-reference links in bodies on
  rename/move, or just **flag** broken links? (Lean: flag in v1.)
- Self-heal vs. warn on **filename↔frontmatter status desync**?
- **Skill update source:** which GitHub page/repo is canonical for the bundled skill, and
  what's the update mechanism (raw file fetch, release asset, `git` pull)? Pin a version so
  "update available" can be detected. (TBD.)
- **Where does `.todos-config.json` live and is it committed?** If the todos folder is
  gitignored (`*`), the config file is ignored too; decide whether to force-track it
  (`!.todos-config.json`) so teammates/CI share the config, or keep it purely local.
- Precedence when VS Code settings and `.todos-config.json` disagree (lean: settings win,
  extension rewrites the file).

## Edge cases to design for

- Filename ↔ frontmatter `status` desync → self-heal or surface a warning badge.
- Absolute-path cross-references break on rename/move (flag, don't auto-rewrite in v1).
- ID collisions on create → verify against `docs/todos/`, `complete/`, AND new `backlog/`.
- Epic index files (`epic: true`, `children[]`) — display as parents, don't treat as normal leaf.
- `docs/todos/**/*.md` glob pitfall — always list the directory / use flat globs.

## Acceptance Criteria

- [x] Decision recorded for extension project location.
- [x] `file-todos` SKILL.md updated to add `backlogged` + `docs/todos/backlog/` folder. *(bundled `resources/skill/SKILL.md`)*
- [x] `file-todos` SKILL.md updated to formalize `cancelled` + `docs/todos/cancelled/` folder. *(bundled skill; one-time migration of existing cancelled files belongs to the source repo, `C:\TSS_Website\docs\todos`, and is out of scope here.)*
- [x] `file-todos` SKILL.md updated to read `.todos-config.json` (root + gitignored discovery strategy). *(bundled skill)*
- [x] (Build phase) TreeView groups todos by status → priority with icons/colors.
- [x] (Build phase) Filter/search by status, priority, tag, jira, and free text.
- [x] (Build phase) Todos open in markdown preview by default.
- [x] (Build phase) Status transitions keep filename token, frontmatter, and folder in sync.
- [x] (Build phase) Cancel transition inserts/updates the contextual header banner.
- [x] (Build phase) Skill is bundled and can be enabled/installed from a settings panel (+ optional GitHub update).
- [x] (Build phase) Gitignore toggle writes/removes a `*` `.gitignore` in the todos root.
- [x] (Build phase) Custom root folder is selectable and projected to `.todos-config.json` for the skill.

## Work Log

### 2026-07-20 - Investigation + plan captured

**By:** GitHub Copilot / jake.morgeson

**Actions:**
- Investigated the `file-todos` skill contract (SKILL.md, todo-template.md) and live
  `docs/todos/` layout (statuses, folders, filename pattern, banners, asset handling).
- Designed a v1 native-TreeView extension with a module breakdown and transition matrix.
- Captured user decisions: investigation-only for now, native TreeView v1, `backlogged` →
  new `docs/todos/backlog/` folder, extension location left as an open question.
- Identified the required `file-todos` skill update to introduce `backlogged` + `backlog/`.

**Learnings:**
- Folder placement is derived from status, and filename token + frontmatter `status` are a
  coupled dual source of truth — the transition engine is the highest-value / highest-risk part.
- Body cross-references are absolute paths and will break on move/rename; v1 should flag them.

### 2026-07-20 - Added skill-bundling, settings panel, and config bridge

**By:** GitHub Copilot / jake.morgeson

**Actions:**
- Expanded scope: bundle the `file-todos` skill inside the `.vsix` with a settings panel to
  enable/install it (optional update-from-GitHub source, TBD).
- Added a gitignore-`*` toggle and a configurable custom root todos folder.
- Designed an extension↔skill **config bridge** (`<root>/.todos-config.json`) so the skill can
  read the active `root` and `gitignored` flag and pick glob vs. manual directory discovery.
- Added `configService.ts` / `skillManager.ts` / settings panel modules and the corresponding
  skill-update and acceptance-criteria items; logged new open questions (update source,
  whether the config file is committed, settings-vs-file precedence).

**Learnings:**
- VS Code settings are invisible to a markdown agent skill, so a file-based projection is
  required for the skill to honor extension config — and it neatly resolves the existing
  "can I glob or must I list the directory?" ambiguity via the `gitignored` flag.
- The skill must stay self-contained (work without the extension); the extension is a
  convenience/control layer, not a hard dependency.

### 2026-07-20 - Formalized `cancelled` as a first-class status

**By:** GitHub Copilot / jake.morgeson

**Actions:**
- Formalized `cancelled` alongside `backlogged`: gave it its own `docs/todos/cancelled/` folder
  (split out of `complete/`), added it to the transition matrix (incl. a reopen row that strips
  the banner), and extended the config bridge (`cancelledFolder`) and skill-update list.
- Noted a one-time migration of existing cancelled files (e.g. `053`) from `complete/` to
  `cancelled/`, and added matching acceptance criteria.

**Learnings:**
- `cancelled` and `complete` are both terminal but semantically opposite (abandoned vs. done);
  sharing `complete/` conflated them. Separate folders keep the tree honest and let the
  extension/skill count and filter them independently while both stay excluded from active work.

### 2026-07-21 - Reconciled Folder layout findings with the plan

**By:** GitHub Copilot / jake.morgeson

**Actions:**
- Updated the Findings "Folder layout" section, which still described the legacy state: it now
  documents the planned sibling subfolders `complete/`, `cancelled/` (planned), and `backlog/`
  (planned), instead of claiming cancelled lives in `complete/`.
- Reframed gitignore as an **optional per-repo convention exposed as a toggle** (not a system
  requirement), consistent with the config-bridge `gitignored` flag the skill reads.

**Learnings:**
- Findings had drifted from the evolving design; the current-state description and the target
  layout need to be kept explicitly distinct (marking planned items as **planned**) to avoid
  re-confusing them later.

### 2026-07-21 - Scaffolded v1 extension in the `todo-ext` repo

**By:** GitHub Copilot / jake.morgeson

**Actions:**
- Resolved the extension-location open question: the extension lives in its **own repo**
  (`todo-ext`), scaffolded from a third-party VS Code extension template attached to the
  workspace as reference.
- Built the v1 module layout adapting the template's conventions (`output.ts` tagged-template
  logger, `configuration.ts` `Settings` enum + get/set, `tsc` build, mocha tests):
  - `todos/todoModel.ts` — dependency-free frontmatter parser + filename-contract parsing.
  - `todos/configService.ts` — settings accessors, `.todos-config.json` projection, gitignore-`*`.
  - `todos/todoRepository.ts` — scans root + `complete/` + `cancelled/` + `backlog/`, caches,
    `FileSystemWatcher` refresh, id allocation.
  - `todos/filterService.ts` — status/priority/tag/free-text filter persisted in workspace state.
  - `todos/todoTreeProvider.ts` — status → priority → todo grouping with icons/priority colors,
    open-in-preview default.
  - `todos/statusService.ts` — transition engine (frontmatter rewrite + filename token swap +
    folder move + `CANCELLED` banner insert/remove); `setPriority` rename.
  - `extension.ts` — wiring + all commands (refresh, filter, search, clearFilters, createTodo,
    openPreview, setStatus.*, setPriority, chooseRoot, toggleGitignore).
- Authored `package.json` contributes (Activity Bar container + view, title/context menus,
  configuration), `tsconfig`, `.eslintrc`, `.vscode/launch+tasks`, `.vscodeignore`, `.gitignore`,
  README, CHANGELOG, and a `todoModel` unit-test suite.
- Verified: VS Code TypeScript service reports **no type errors** across all modules (remaining
  editor squiggles are Sonar style hints / false-positive "TODO" matches on the word "todo").

**Learnings:**
- Dependency install is blocked in this environment: the configured private npm feed
  (`sol.schwab.com`) returns 401 (needs auth) and the public registry fails with a corporate
  SSL cert error (`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`). `npm install` + `npm run compile` must
  be run by the user with their normal registry credentials before an `F5` Extension Dev Host run.
- Filename token is treated as the authoritative source for status/priority (frontmatter is a
  secondary/relational field), which keeps the transition engine's rename+move deterministic.

**Remaining (still plan-only):**
- Bundle the `file-todos` skill in the `.vsix` + settings panel to enable/install it (+ GitHub update source).
- Update `file-todos` SKILL.md for `backlogged`/`cancelled` folders and `.todos-config.json` reading.
- Flag (not auto-rewrite) broken absolute cross-reference links on move/rename.

### 2026-08-11 - Renumbered to 001 and built skill-bundling, config bridge, and link flagging

**By:** GitHub Copilot / jake.morgeson

**Actions:**
- Renumbered this todo `060` → `001` (first in the new `todo-ext` repo; copied from another
  repo) and recorded that a live example of current file-todos usage lives at
  `C:\TSS_Website\docs\todos`.
- Bundled the `file-todos` skill inside the extension at `resources/skill/`
  (`SKILL.md`, `assets/todo-template.md`, `.skill-meta.json` with a `version` field). The
  bundled `SKILL.md` was rewritten to: add `backlogged` + `docs/todos/backlog/`, formalize
  `cancelled` + `docs/todos/cancelled/` (banner + `cancelled` tag), add a "Read
  `.todos-config.json` first" step (root + `gitignored` discovery strategy), split active vs.
  terminal status rules, and note `assets/{id}/` stays put across moves. `.vscodeignore` does
  not exclude `resources/`, so it ships in the `.vsix`.
- Added `src/todos/skillManager.ts`: installs the bundled skill into
  `~/.agents/skills/file-todos/`, compares bundled vs. installed `version`, and can refresh from
  a configurable raw GitHub base URL (`file-todos.skillUpdateSource`). Wired up
  `file-todos.enableSkill` / `file-todos.updateSkill` commands + view/title menu entries.
- Added `src/todos/linkService.ts`: after a status/priority move/rename, scans the root and
  `complete/`/`cancelled/`/`backlog/` folders for other todos still referencing the old
  filename and **flags** them (non-blocking warning + "Show Referrers" search) — it does not
  auto-rewrite links, per the v1 decision. `statusService` now returns the new `Uri` so the
  warning only fires on an actual move and excludes the moved file itself.

**Learnings:**
- Dependency install is still blocked locally (private feed `sol.schwab.com` → 401; no global
  `tsc`), so verification was via the VS Code TypeScript language service only (no new type
  errors; remaining squiggles are Sonar style hints and false-positive "TODO" matches on the
  word "todo"). The user must run `npm install` + `npm run compile` with their registry
  credentials before an `F5` Extension Dev Host run.
- The bundled skill is the canonical source; the `enableSkill` command projects it into the
  user's skills dir, keeping the skill self-contained and installable without the extension.

