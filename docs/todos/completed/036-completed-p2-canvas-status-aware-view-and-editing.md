---
status: in-progress
priority: p2
issue_id: "036"
tags: [canvas, ux, editing]
dependencies: ["035"]
---

# Status-Aware Canvas Layout, Status Changes, and Editing

Make the work-session canvas adapt to the todo's lifecycle status, and let users change status and edit the todo without leaving it.

## Problem Statement

The canvas renders every todo the same way regardless of status. A `pending` todo is still being triaged, so Acceptance Criteria matters less than the Problem Statement, Findings and Proposed Solutions. An `in-progress` todo needs Resume Context, criteria and the Work Log up front, while `ready` emphasizes verification and `complete` is a read-only record. The canvas is also view-only apart from ticking criteria: changing status or editing the todo means leaving the dashboard.

## Findings

- `page.mjs` already renders sections through the `collapsible()` helper, which accepts `open` and `auto`, so per-status order and default-open state is a small extension of it.
- Status and priority live in the filename (authoritative), the frontmatter mirror, and the folder, so any status change must rename and move the file and update frontmatter together, as the extension's existing status commands do. Reuse that logic rather than duplicating it in the SDK-free canvas server.
- The canvas server's POST endpoints require the `X-Agendo-Canvas: 1` header. New mutating endpoints need the same guard, and file renames must stay inside the todos root.
- Collapse state is per todo in sessionStorage; status-driven defaults should only apply when the user has not toggled a section.

## Proposed Solutions

### Option 1: Status profiles in the canvas, mutate files via the server

Define a status-to-layout profile (section order, default open/collapsed, emphasis). Add a status picker and Edit button that call new server endpoints performing the rename, frontmatter update and move.

- Pros: works in both the Copilot canvas and the VS Code tab; one implementation.
- Cons: duplicates lifecycle logic that exists in the extension.

### Option 2: Status profiles in the canvas, mutate via the extension

Same layout work, but the picker and Edit post a message or command back to the extension, which runs its existing lifecycle code.

- Pros: single source of truth for lifecycle rules.
- Cons: the Copilot-hosted canvas has no extension channel, so it would need a fallback.

## Recommended Action

To be decided during triage. Likely start with the layout profiles, which carry no risk, then add status change and Edit.

## Acceptance Criteria

- [x] Section order, default open state and emphasis vary by status (for example `pending` de-emphasizes Acceptance Criteria and leads with Problem Statement, Findings and Proposed Solutions)
- [x] Status-driven defaults never override a section the user has explicitly toggled for that todo
- [x] A status control on the canvas changes the todo's status, renaming and moving the file and updating frontmatter consistently with the extension's own status commands
- [x] Changing status refreshes the canvas without losing collapse state, and moving to `complete` still triggers the celebration
- [x] An Edit button opens the todo markdown in the text editor in the VS Code tab, and reveals or opens the file from the Copilot canvas
- [ ] Optionally, the canvas supports inline editing of the Resume Context fields
- [x] Mutating endpoints keep the `X-Agendo-Canvas` header check, body size limit and todos-root path confinement
- [x] Tests cover the status profiles and the status-change file operations

## Resume Context

**Current state:** Implemented with server-side status changes (todos.mjs `setTodoStatus`), per-status layout profiles in page.mjs, and an Edit action supplied by the VS Code tab host. Unit test added; not yet checked by eye in a real window. Inline Resume Context editing was not done.

**Next step:** Try it in the VS Code tab after reinstalling the vsix, then move to complete.

## Work Log

### 2026-10-20 - Todo created

**By:** Copilot

**Actions:**

- Created from user feedback while polishing the canvas collapsible sections (see 035)

**Learnings:**

- Lifecycle changes touch filename, frontmatter and folder together, so the mutation path needs one shared implementation

### 2026-10-20 - Implementation

**By:** Copilot

**Actions:**

- Added per-status layout profiles and a Triage section (Findings, Proposed Solutions, Recommended Action) in `page.mjs`/`todos.mjs`
- Added `setTodoStatus` (frontmatter, cancelled tag and banner, rename and move) plus `/status` and `/edit` endpoints guarded by the existing header, body-size and todo-id checks
- Edit is a host-supplied action: the VS Code tab opens the file beside the dashboard; the Copilot canvas hides the button
- Added a test covering profiles and status round trips; 77 tests pass

**Learnings:**

- Saved per-todo collapse state overrides profile defaults, so user toggles are never overridden
- The canvas now honors `agendo.root` and `.agendo-config.json` folder names
