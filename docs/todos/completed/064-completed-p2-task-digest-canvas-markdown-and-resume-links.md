---
status: completed
priority: p2
issue_id: "064"
tags: [canvas, digest, markdown, todos]
group: canvas
dependencies: [059, 063]
---

# Task Digest: Canvas Markdown Rendering, Resume Sub-grouping, and File Links

## Problem Statement

The task digest opened in the canvas was rendering blank/bright-white text because the inlined Markdown renderer used nested template literals (`${}` inside a `String.raw` template executed in an iframe), which V8/Node cannot parse, and the renderer's hardcoded light theme fell back to `#f5f5f5` against a dark canvas. Additionally, resume "Now/Next" context was not sub-grouped under its in-progress item, and todo/file references were not linked within the canvas.

## Acceptance Criteria

- [ ] Digest renders formatted Markdown (bold, italic, headings, lists, fenced code, links) with dark-theme contrast in the canvas
- [ ] Resume "Now/Next" content is sub-grouped under the in-progress item with `### In Progress` / `### Ready` status sub-headers
- [ ] Todo/file references in the resume are linked as `[id · title](/open/<id>)` and open the todo in the canvas on click
- [ ] `npm run compile` passes
- [ ] `npm run test:canvas` (254 tests) all pass
- [ ] VS Code suite (`npm run test`) all pass
- [ ] Extension bundles successfully

## Resume Context

**Current state:** The digest flow works end-to-end (`ShowDigest` → canvas `{ kind: "digest", scope }` → `server.mjs` `/digest-snapshot` → `getDigest` action → `digest.mjs` renderer). The renderer has been rewritten to use string concatenation instead of nested template literals, regex literals replaced with `new RegExp(...)`, backticks escaped, and fenced-code join fixed to `fence.join('\n')`. Styling fallback background changed from `#f5f5f5` to `#252525` with `color: var(--fg-secondary, #d4d4d4)` and border fallback `#3a3a3a`. `markdown.mjs` `inlineMarkdown` now supports relative (`/open/...`), angle-bracket, and URL links with a fixed href capture. `src/todos/digestService.ts` groups resume context by status with `###` sub-headers and inserts `[${todo.id} · ${todo.title}](/open/${todo.id})` links. `digest.mjs` added a click handler for `a[href^="/open/"]` links to open the todo in the canvas.

**Blocked:** The changes (digestService.ts, markdown.mjs, digest.mjs) are in a git stash; `git stash pop` is blocked by a `.vscode/launch.json` working-tree modification (added "Extension Tests" launch config). The changes are not in the working tree.

**Verification done:** `npm run test:canvas` → 254 pass / 0 fail; `tsc` compile OK; markdown rendering of relative/URL/angle links, bold+link, code, plain text all correct. One VS Code suite test failed after the changes; reverting (stash) restored a clean 353 passing run, so the failure is attributable to the current changes and must be re-confirmed after restoring the stash.

**Next step:** Restore `.vscode/launch.json` to HEAD, `git stash pop` to restore the changes, re-run `npm run test:canvas` and `npm run test`, adjust any failing resume/link format test expectations, then `npm run compile` and `npm run package:vsix`.

## Work Log

### 2026-10-27 - Digest Rendering and Resume Links

**By:** Copilot

**Actions:**

- Root-caused the blank/bright-white digest: nested `${}` template literals inside the `String.raw` bootstrap string executed in an iframe are not parseable by V8/Node; the renderer's light-theme fallback `#f5f5f5` produced low contrast.
- Rewrote the inlined renderer in `digest.mjs`: HTML output via string concatenation, regex literals → `new RegExp(...)`, backticks escaped for `startsWith('\`\`\`')`, fence close uses `fence.join('\n')`.
- Fixed `.digest-markdown` styling: background fallback `#f5f5f5` → `#252525`, added `color: var(--fg-secondary, #d4d4d4)`, border fallback `#3a3a3a`.
- Updated `markdown.mjs` `inlineMarkdown` to support relative links (`/open/...`), angle-bracket links (`<...>`), and URL links; fixed href capture to `escapeHtml(link[2])`.
- Updated `src/todos/digestService.ts` `buildTodoDigest`: resume context grouped by status with `### In Progress` / `### Ready` sub-headers; resume lines include `[${todo.id} · ${todo.title}](/open/${todo.id})` file links.
- Added `digest.mjs` click handler for `a[href^="/open/"]` links to open the todo in the canvas.
- Verified: `npm run test:canvas` 254 pass / 0 fail; `tsc` compile OK; markdown link/code/bold/plain rendering correct.

**Blocked:**

- `git stash pop` to restore the changes is blocked by a `.vscode/launch.json` working-tree modification (added "Extension Tests" launch config). Changes remain in the stash.

**Learnings:**

- The digest renderer must be inlined (no node module imports) because it runs inside an iframe bootstrap `String.raw` string; nested template literals and regex literals are not parseable.
- CSP `frame-ancestors * vscode-webview: vscode-file:` is required for the loopback iframe to load in Chromium.

### 2026-10-27 - Completion

**By:** Copilot

**Actions:**

- Restored `.vscode/launch.json` to HEAD (content identical; line-ending side-effect only).
- `git stash pop` succeeded; digest changes (`digest.mjs`, `markdown.mjs`, `digestService.ts`) restored to working tree.
- `npm run compile` passes.
- `npm run test:canvas` → 254 pass / 0 fail.
- `npm run test` → 353 passing, 0 failing (one failure from stashed link rendering fixed by stripping angle brackets from markdown link destinations in `markdown.mjs`).
- `npm run package:vsix` succeeded → `.artifacts/agendo-0.3.0.vsix`.

**Result:** All acceptance criteria met. Digest renders formatted Markdown with dark-theme contrast, resume context grouped by status with `###` sub-headers, `/open/` file links open todos in the canvas.
