---
status: pending
priority: p2
issue_id: "046"
tags: [canvas, copilot, navigation, filtering]
group: copilot-integration
dependencies: ["043", "044"]
---

# Agent-Driven Canvas Navigation and Filter Actions

Expose focused actions that let the agent bring relevant work into the existing shared UI instead of merely describing where the user should navigate.

## Problem Statement

Agendo's canvas input currently focuses a todo ID. As board and group views are integrated, the agent should be able to select an available view, apply filters, and focus a finding while preserving navigation context. These UI actions must not mutate todo work state or create a new panel for every request.

## Findings

- The existing adapter declares an input schema and reuses a server by `instanceId` when opening a todo.
- The canvas SDK exposes open/close lifecycle and agent-callable actions; these can delegate to shared navigation rather than duplicating it.
- Todo 043 provides the shared view/navigation boundary; todo 044 makes the resulting selection queryable.
- Todo 042 separately decides the useful group-view experience. Unsupported views should remain capability-gated rather than being reimplemented in this task.

## Recommended Action

Expose a minimal set of navigation/filter/focus actions for implemented views. Reuse the existing canvas instance, acknowledge the selected view and applied scope, and keep browser state synchronized. Treat layout and selection changes as UI operations, not implicit authorization to modify files or start agent work.

## Acceptance Criteria

- [ ] Agent actions can navigate to supported board/group/todo views and focus an available finding or dependency
- [ ] Filters and source/group scope use the same semantics as the user-facing UI
- [ ] Stable full todo/finding identities are used instead of visible short labels or array positions
- [ ] Repeated actions reuse the intended canvas instance and preserve meaningful back/forward context
- [ ] Action results describe what was selected/applied and distinguish accepted requests from unavailable or failed display operations
- [ ] Actual UI state is available through 044 after a navigation/filter action
- [ ] Unsupported views/actions, stale targets, invalid filters, and closed instances are reported explicitly
- [ ] Navigation alone does not alter todo lifecycle, criteria, import grouping, or saved opening preferences, and does not submit prompts
- [ ] Tests cover repeated navigation, mixed scanner IDs, filter parity, scope isolation, state round trips, and unsupported-host/view behavior

## Technical Details

Primary areas: the shared navigation model from 043, canvas input/action schemas, server state, and the Copilot adapter. Preserve the distinction between todo IDs, group names, and view identities. Prefer a small coherent action set over exposing arbitrary UI scripting.

## Resources

- https://unpkg.com/@github/copilot-sdk@1.0.26/dist/canvas.d.ts

## Resume Context

**Current state:** Pending. The adapter still opens individual todos through its existing input schema.

**Next step:** Map the first shared board-to-todo navigation flow to typed canvas actions and verify its observable state through 044.

## Work Log

### 2026-10-25 - Todo Created

**By:** Kilo

**Actions:**

- Captured agent-driven view selection, filtering, and finding focus
- Linked the actions to shared navigation rather than another Copilot-specific UI implementation
