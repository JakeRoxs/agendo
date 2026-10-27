---
status: ready
priority: p2
issue_id: "067"
tags: [canvas, board, ux, consistency]
group: canvas
dependencies: [066]
---

# Unify Board Top Bar with Canvas Views

The board view's top bar uses inline VS Code theme styles and a separate toolbar div, while the todo and group canvases use the shared `page.css` with `canvas-toolbar`/`history` structure. Unify the board's top bar so it matches the other two views.

## Problem Statement

The board view (`board.html` + `board.mjs`) renders its top bar with inline `<style>` using `var(--vscode-*)` theme variables and a `.toolbar` div, while the canvas views use `/page.css` with `.canvas-toolbar`, `.history`, and `.edit-button` classes. The visual result is a top bar that looks different from the todo and group canvases.

## Recommended Action

1. **`board.html`**: Replace the inline toolbar/settings styles with a link to `/page.css`. Restructure the top bar so navigation and board controls live inside a `.canvas-toolbar` div, matching the canvas views.
2. **`board.mjs`**: Change the navigation wrapper from `.workspace-navigation` to `.canvas-toolbar`. Append board-specific controls (Refresh, Filter, Search, Clear Filters, Card settings, Settings) to the same toolbar.
3. **`page.css`**: Add board-specific toolbar button styling if needed (board buttons are created dynamically in JS).

## Acceptance Criteria

- [x] Board top bar uses `.canvas-toolbar` class like the todo/group canvases
- [x] Board navigation is inside the same toolbar as action buttons (not a separate div)
- [x] Board loads `/page.css` instead of inline toolbar styles (native fallback embeds the same stylesheet)
- [x] Board-specific settings panel no longer uses inline styles that conflict with `page.css`
- [ ] Visual parity: board top bar matches canvas top bar height, spacing, and button styling
- [x] All canvas and extension tests pass

## Technical Details

- `resources/canvas/agendo-work-session/board.html` — remove inline toolbar styles, add `/page.css` link, restructure top bar
- `resources/canvas/agendo-work-session/board.mjs` — change `workspace-navigation` to `canvas-toolbar`
- `resources/canvas/agendo-work-session/assets/page.css` — ensure `.canvas-toolbar` and button styles work for board's dynamically created buttons

## Resume Context

**Current state:** Both boards share `.canvas-toolbar`, navigation markup, action-button styling, and scoped board rules in `page.css`. HTTP permits the same-origin stylesheet; native fallback embeds the identical CSS. The missing grid/card rules and malformed HTML are repaired. Automated suites and browser-fixture checks pass; rebuilt-extension visual comparison remains outstanding.

**Next step:** Rebuild/reload the extension and compare real regular/scanning board headers with todo/group headers in VS Code, including history and scoped actions. Keep ready until this installed-host visual check passes.

## Work Log

### 2026-10-27 - Restore layout and complete shared stylesheet integration

**By:** Kilo

**Actions:**

- Fixed the missing `</head>` and replaced the hardcoded HTTP stylesheet link with a host stylesheet placeholder
- Restored grid, cards, density, drag/drop, metadata, hover actions, busy indicators, settings, and scanning sections in `assets/page.css`, scoped under `.board-page`
- HTTP injects `/page.css`; native `BoardViewProvider.getHtml` embeds that same stylesheet, avoiding blocked webview resource requests
- Updated HTTP board CSP to allow same-origin stylesheets while preserving script nonce restrictions
- Reused shared toolbar/action-button CSS and wired the recent menu with outside-click/Escape dismissal
- Fixed narrow-screen layout to honor the actual column count instead of forcing five columns
- Added both-scope HTTP/CSP/stylesheet coverage and native shared-CSS parity checks; removed stale tests requiring CSS inside HTTP HTML
- Validation: `npm test` passed (364 tests, compile and lint); all canvas tests passed (297 tests); production bundles succeeded
- Browser fixture verified six-column grids at 1206px and 800px, settings visibility, work-session/board round trip, and recent-menu open/Escape dismissal

**Learnings:**

- The screenshot reflected deleted board rules plus a CSP-blocked stylesheet; restoring only the link or only the toolbar markup was insufficient
- Browser reports an existing diagnostic that `frame-ancestors` is ignored in meta CSP; the response header still carries the directive, and stylesheet loading is no longer blocked

### 2026-10-27 - Todo Created

**By:** Kilo

**Actions:**

- Created the todo from the observation that the board top bar differs from the canvas views

**Learnings:**

- None yet
