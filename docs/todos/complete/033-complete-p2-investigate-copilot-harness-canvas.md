
---
status: complete
priority: p2
issue_id: "033"
tags: [vscode, agent-harness, investigation]
dependencies: []
---

# Investigate Canvas Support in GitHub Copilot Harness

Research how VS Code's canvas feature works with the GitHub Copilot agent harness to determine if and how it can be leveraged.

## Problem Statement

VS Code has introduced canvas support for the Copilot agent harness. Understanding how this works and whether it applies to our setup could improve agent interaction and output visualization.

## Findings

Canvas support is a **preview** feature (as of VS Code 1.142.0, Oct 2026) that provides interactive visual surfaces shared between the user and the Copilot agent.

**What canvases are:**
- Interactive UI surfaces where users can inspect diagrams the agent updates or adjust controls whose values flow back to the agent
- Every canvas is provided by a canvas extension
- Appear in an editor tab, associated with the owning chat session
- Agent can invoke actions exposed by the canvas to inspect/update its state
- User interactions can feed back into the session

**Enabling canvases:**
- Set `"chat.canvases.enabled": true` in settings before creating a new supported Copilot session

**Verified workflow in this repository:**
- Enable canvases first, then create a new local session using the Copilot Agent Host harness; enabling the setting or restarting VS Code does not make an already-created session canvas-capable
- Create or reload the project extension under `.github/extensions/`, then use the canvas tools to inspect available capabilities and open a canvas
- A successful `open_canvas` response confirms the runtime accepted the request, but does not prove the canvas is visible; confirm the editor tab is actually shown
- In the Agents window, an available canvas can also be opened from **Add Tab (+)** > **Canvas**
- The Agendo work-session prototype was confirmed visible in a new supported session and its actions successfully read and updated todo 033

**How to get canvases:**
1. **Create your own**: Use the `/create-canvas` skill in chat - describe the UI you want and it generates a canvas extension in your workspace
2. **Install from plugins**: Install a chat plugin from the GitHub Copilot app that includes a canvas extension
3. **Agents window**: Open via **Add Tab (+)** > **Canvas**

**Limitations:**
- Desktop only
- Only works in supported **local Copilot Agent Host sessions**
- NOT supported for: Claude, Codex, extension-host Local sessions, remote Agent Host sessions, browser/web clients, auxiliary-window hosting

**Ecosystem:**
- 87+ community canvas extensions exist (see https://awesome-copilot.github.com/extensions/)
- Examples: kanban boards, Azure tools, artifact explorers, game canvases, APNG studio
- Canvas extensions also work in the GitHub Copilot app

**Relevance to agendo:**
- Could potentially power an interactive todo kanban board or dependency visualization
- The `/create-canvas` skill could scaffold a canvas extension within the agendo workspace
- Would require users to enable `chat.canvases.enabled` and use the Copilot harness
- Feature is preview-stage and may change before GA

Reference documentation:
- https://code.visualstudio.com/docs/agents/run/agent-harnesses#_use-canvases-with-the-copilot-harness
- https://docs.github.com/en/copilot/how-tos/github-copilot-app/working-with-canvas-extensions
- https://github.com/microsoft/vscode/issues/340946 (TPI issue)
- https://awesome-copilot.github.com/extensions/ (community canvas examples)

## Potential Use Cases While Working on Todos

**1. Triage Assistant Canvas**
- Visual list of pending todos with priority badges
- Quick-action buttons per todo: Approve (→ in-progress), Backlog, Cancel
- Agent reads selections and performs the file moves + frontmatter updates
- Use case: Batch-triage a pile of pending todos without leaving the chat context

**2. Todo Kanban Board**
- Columns: pending, in-progress, ready, backlogged (complete/cancelled optional)
- Drag-and-drop to change status; canvas extension triggers agent to move files
- Visual progress indicator showing count per column
- Use case: High-level workflow overview, especially useful with many active todos

**3. Dependency Graph Visualization**
- Interactive directed graph of todos and their dependencies
- Highlight critical path (chain of dependencies blocking most work)
- Click a node to see details: status, priority, blocker reason
- Agent can recompute graph when todos are created/completed
- Use case: Understanding what's blocking what before starting work

**4. Work Log Timeline**
- Horizontal timeline showing work log entries across all active todos
- Color-coded by status, grouped by date
- Click to jump to specific todo and time period
- Use case: Reviewing progress over time, especially across multiple sessions

**5. Reconciliation Dashboard**
- During todo audit, show stale/outdated todos with evidence
- Side-by-side: todo claims vs. current codebase state
- Quick actions: "Mark complete", "Update", "Cancel" per stale todo
- Use case: The reconcile/audit workflow becomes visual rather than text-only

**6. Session Context Panel**
- Persistent canvas showing current todo's resume context, next step, dependencies
- Auto-updates when work log or resume context changes
- Links to related todos and blocked-by relationships
- Use case: Always-visible context while working, reducing need to re-read files

**Feasibility Assessment:**

| Use Case | Effort | Value | Complexity | Notes |
|----------|--------|-------|------------|-------|
| Triage Assistant | Low | Medium | Simple list + buttons | Duplicates tree/board views? |
| Kanban Board | Medium | Low | Drag-drop, state sync | **Redundant** - agendo already has board view |
| Dependency Graph | Medium-High | High | Graph layout, interactivity | Novel visualization |
| Work Log Timeline | Medium | Medium | Data aggregation, rendering | Niche use |
| Reconciliation Dashboard | Medium | High | File comparison, evidence | Could be valuable |
| Session Context Panel | Low | Medium | File watching, updates | Duplicates resume context |

**Open Questions / Uncertainties:**

- When exactly does a user open/use a canvas? Is it per-session or persistent?
- How does the user discover available canvases?
- Does it auto-appear for certain workflows, or is it always manual?
- How does a canvas interact with existing extension views (agendo tree, board)?
- Is the canvas tied to one chat session only, or shared across sessions?
- What's the lifecycle - does it persist after the chat session ends?

**Canvas Extension Architecture (from community examples):**

Based on Artifact Explorer and other extensions, the pattern is:
- Canvas extensions are installed as plugins (`copilot plugin install <name>@<source>`) or copied to `~/.copilot/extensions/` (user) or `.github/extensions/` (project)
- Each canvas exposes **agent actions** - named functions the agent invokes with JSON parameters (e.g., `open_pull_request { repository, pullNumber }`)
- Canvases can run a local extension server for authenticated API access (tokens stay in the server process, canvas only gets sanitized data)
- The canvas renders interactive web UI (HTML/CSS/JS), and the agent drives it through actions
- Example actions from Artifact Explorer: `open_pull_request`, `inspect_artifact`, `cache_status`, `clear_cache`, `accounts`, `set_account`

**What an agendo canvas would look like:**

Expose todo-management agent actions:
- `list_todos { status?, priority? }` - list todos by filter
- `get_todo { id }` - get todo details
- `update_todo_status { id, status }` - transition status
- `create_todo { title, description, priority }` - create new todo
- `get_dependencies { id }` - get dependency info
- `triage { id, action }` - approve/backlog/cancel

The canvas would render a todo list/board, and the agent would manipulate todos by invoking these actions. The extension would handle the actual file operations (move, edit frontmatter).

**Focused use cases (more actionable):**

**1. Objective/Acceptance Criteria Tracker**
- Opens for a specific todo being worked on
- Displays acceptance criteria as interactive checkboxes with progress bar
- Agent checks items off as it completes work and adds evidence (files changed, tests run)
- When all criteria are met, agent can propose moving to `ready` or `complete`
- Canvas actions: `mark_criterion_met { todoId, criterion }`, `get_criterion_status { todoId }`
- Value: Always-visible progress against defined success criteria while working

**2. Automatic Dependency Context Panel**
- When working on a todo, automatically shows related todos:
  - **Blocks this todo**: dependencies and their current status
  - **Blocked by this todo**: reverse dependencies waiting on completion
- Highlights critical path and any stale/outdated blockers
- Updates in real-time as todos transition status
- Canvas actions: `get_dependencies { todoId }`, `get_dependents { todoId }`, `refresh_context { todoId }`
- Value: Eliminates manual grep for dependencies; always shows what's blocking what

**Assessment:** The feature is preview-stage. The supported workflow is now verified, though canvases require a new local Copilot Agent Host session with the setting enabled beforehand. Many proposed use cases overlap with existing agendo extension views (board, tree). The **Objective Tracker** and **Automatic Dependency Context** remain the most promising focused use cases - they provide live, session-specific context that markdown files and the existing extension views can't.

### Prototype built

A project-scoped canvas prototype now combines the acceptance-criteria tracker with a work-session context panel. It lives in `.github/extensions/agendo-work-session/` and currently:

- Displays the selected todo's status, priority, acceptance criteria progress, dependencies, resume context, and recent work log
- Exposes `get_todo_context`, `mark_criterion_met`, and `refresh` actions
- Reads and updates the existing todo Markdown file; no separate todo database is introduced
- Serves its page from an ephemeral HTTP server bound to `127.0.0.1`

The prototype was registered and opened in a new supported local Copilot Agent Host session after enabling `chat.canvases.enabled`. Its context and criterion-update actions were exercised against todo 033, and the criterion update was verified in the Markdown file. The first attempts to view it failed because the session predated enabling canvases and the extension initially lacked required SDK metadata; a successful canvas API response alone did not confirm that an editor tab was visible. The user subsequently confirmed the canvas worked in the new session.

**What ultimately fixed the build:** the canvas still did not appear after the above, even though `open_canvas` reported success. Comparing against the working `backrooms-canvas@awesome-copilot` plugin showed the cause: `open()` returned a bare URL string, but the host expects an object, `{ title, status, url }`. Returning that object made the tab appear. Related hardening, also modeled on the plugin:

- Track each instance's HTTP server in a `servers` map, reuse it on re-open, and close it in an `onClose` handler
- Re-read the todo on every HTTP request so the page shows live state instead of a snapshot taken at open time
- Derive the title from frontmatter `title`, else the first `# ` heading, else `Todo {id}`; use it for the page header and panel tab title

Follow-up fixes: the section-matching regexes used `\Z`, which JavaScript does not support, so they were replaced with a line-based section finder. Status and priority are now read from the filename, which is authoritative. Criterion toggles edit only the targeted checkbox line, leaving frontmatter and the rest of the file untouched. The page also escapes HTML, renders markdown, has interactive checkboxes, a "show all" work log toggle, and auto-reloads when the todo file changes.

The dependency graph remains a separate promising follow-up; it is not part of this prototype.

## Acceptance Criteria

- [x] Understand what canvas support provides in the Copilot harness
- [x] Determine if/when canvas is available and triggered
- [x] Assess relevance to our agendo workflow and tooling
- [x] Document findings in this todo
- [x] Decide if/when to explore building an agendo-specific canvas (optional follow-up)
- [x] Build and verify an initial canvas combining acceptance criteria and work-session context

## Resume Context

**Current state:** Complete. Canvas support was investigated, and a project canvas combining acceptance criteria and work-session context was built and verified. The dependency panel was split into todo 034.

**Next step:** None. Continue with todo 034 for the dependency panel.

## Work Log

### 2026-10-19 - Investigation Complete

**By:** Agent

**Actions:**

- Read VS Code documentation on canvas support in the Copilot harness
- Reviewed the VS Code GitHub TPI issue (#340946)
- Explored community canvas extensions on awesome-copilot.github.com
- Assessed relevance to the agendo workflow

**Learnings:**

- Canvases are preview-stage interactive surfaces for Copilot sessions only
- The `/create-canvas` skill can generate canvas extensions within a workspace
- Significant limitations: desktop-only, local Copilot Agent Host sessions only
- Could be valuable for interactive todo visualization but is not critical for agendo's core functionality

### 2026-10-19 - Work Session Canvas Prototype

**By:** Agent

**Actions:**

- Created `.github/extensions/agendo-work-session/extension.mjs` and the extension metadata file
- Implemented the todo context dashboard and the `get_todo_context`, `mark_criterion_met`, and `refresh` actions
- Reloaded the extension and confirmed the canvas registered, opened, and returned todo 033 context
- Used `mark_criterion_met` and verified the acceptance-criteria checkbox was updated in this todo file
- Opened the canvas in a new supported local Copilot Agent Host session after enabling canvases; the user confirmed it was visible

**Learnings:**

- Canvas support must be enabled before creating the supported Copilot session
- The extension's `open()` response being accepted does not by itself prove the editor tab is visible
- An ephemeral localhost HTTP server is used to serve the canvas UI
- The dependency graph idea is still unimplemented and can be evaluated as a follow-up

### 2026-10-19 - Completed

**By:** Agent

**Actions:**

- Split the dependency panel into todo 034
- Added guidance to the agendo skill to open the work-session canvas when starting work on a todo
- Marked this todo complete

**Learnings:**

- The canvas is a convenience layer; the skill must keep working when canvases are unavailable

### 2026-10-19 - Canvas Open Fix and Title Cleanup

**By:** Agent

**Actions:**

- Installed and enabled `backrooms-canvas@awesome-copilot` as a working reference; it appeared where the prototype did not
- Compared its `extension.mjs` with the prototype and found `open()` must return `{ title, status, url }`, not a bare URL string
- Reworked `open()` with a per-instance server map, live todo reads per request, and an `onClose` cleanup handler
- Changed the canvas and tab title to the todo's real title, falling back from frontmatter `title` to the first `# ` heading
- Reloaded the extension and opened todo 033; the open response returned the new title and the user confirmed the canvas appeared

**Learnings:**

- A successful `open_canvas` response with a bare URL string does not produce a visible tab; the return value must be an object
- Comparing against a known-working plugin canvas was the fastest way to find the mismatch
- The extension reads status and priority from frontmatter only, while the filename is authoritative

### 2026-10-19 - Canvas Workflow Confirmed

**By:** Agent

**Actions:**

- Rechecked the VS Code Copilot harness and GitHub Copilot app canvas documentation
- Confirmed the user could see and use the work-session canvas after creating a new supported local Copilot Agent Host session with canvases enabled
- Recorded that an accepted `open_canvas` request alone is not sufficient evidence that the canvas appeared in the editor

**Learnings:**

- Canvas support is session-scoped; create the session after enabling `chat.canvases.enabled`
- The Agents window's **Add Tab (+)** > **Canvas** path is another way to open an available canvas
- The prototype is a working proof of concept; dependency-graph visualization remains future work

### 2026-10-19 - Todo Created

**By:** Agent

**Actions:**

- Created todo to investigate canvas support in GitHub Copilot harness

**Learnings:**

- None yet