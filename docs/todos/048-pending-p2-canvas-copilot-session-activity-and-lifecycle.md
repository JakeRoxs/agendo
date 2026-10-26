---
status: pending
priority: p2
issue_id: "048"
tags: [canvas, copilot, session, activity, privacy]
group: copilot-integration
dependencies: []
---

# Canvas Copilot Session Activity and Lifecycle

Show useful activity from the owning Copilot session without confusing agent activity with completed or verified todo work.

## Problem Statement

The canvas can show file-backed progress but does not explain whether its owning agent is working, idle, or encountering an error. Session feedback could improve coordination, but indiscriminate transcript ingestion, unsupported status assumptions, or automatic completion would create privacy and correctness problems.

## Findings

- The published session API supports event subscriptions, unsubscribing handlers, session logging, and a snapshot of known open canvases.
- Existing canvas instances already have open/close lifecycles that can bound subscriptions and resources.
- Tool/session events alone do not establish which finding was fixed, which test passed, or whether a todo is complete.
- This can be implemented independently as an optional read-only enhancement without waiting for the board migration.

## Recommended Action

Show a small capability-gated activity indicator based on events the connected host actually reports. Bind it to the owning session, and show task-specific execution or verification details only when explicit correlation and evidence are available. Use concise session logging for intentional application milestones where useful, not a copied transcript or a continuous prompt loop.

## Acceptance Criteria

- [ ] Supported events can display useful owning-session activity/error states, with unknown or disconnected state handled honestly
- [ ] Session activity is not represented as task completion, successful verification, or scanner clearance
- [ ] Task-specific details require explicit association with the todo/finding and actual execution evidence
- [ ] The UI does not automatically ingest or persist the full transcript, raw tool output, credentials, or sensitive environment data
- [ ] Any optional durable Work Log entry is reviewed/authorized and distinct from transient session activity
- [ ] No agent prompt is submitted merely because an activity event or file change occurred
- [ ] Subscriptions and resources are scoped to the correct instance/session and cleaned up without aborting unrelated or ongoing agent work
- [ ] Unsupported/non-Copilot hosts retain the normal application view without fake live-session indicators
- [ ] Tests cover events, disconnect/reconnect, missing capabilities, multiple instances, cleanup, privacy filtering, and the absence of lifecycle mutations

## Technical Details

Primary areas: the optional session adapter, canvas lifecycle, and a small UI activity model. Verify actual runtime event shapes and feature support before use. Do not make a full session inspector, cross-session monitor, or transcript archive part of the first version.

## Resources

- https://unpkg.com/@github/copilot-sdk@1.0.26/dist/session.d.ts

## Resume Context

**Current state:** Pending. No session event subscription or activity display has been added.

**Next step:** Verify the supported host's minimal activity events and prototype a read-only indicator with lifecycle cleanup and no todo writes.

## Work Log

### 2026-10-25 - Todo Created

**By:** Kilo

**Actions:**

- Captured optional session visibility and the distinction between activity and verified outcomes
- Kept transcript ingestion, automatic completion, and broad session orchestration out of scope
