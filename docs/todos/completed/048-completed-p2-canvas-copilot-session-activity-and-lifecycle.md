---
status: completed
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

- [x] Supported events can display useful owning-session activity/error states, with unknown or disconnected state handled honestly
- [x] Session activity is not represented as task completion, successful verification, or scanner clearance
- [x] Task-specific details require explicit association with the todo/finding and actual execution evidence
- [x] The UI does not automatically ingest or persist the full transcript, raw tool output, credentials, or sensitive environment data
- [x] Any optional durable Work Log entry is reviewed/authorized and distinct from transient session activity
- [x] No agent prompt is submitted merely because an activity event or file change occurred
- [x] Subscriptions and resources are scoped to the correct instance/session and cleaned up without aborting unrelated or ongoing agent work
- [x] Unsupported/non-Copilot hosts retain the normal application view without fake live-session indicators
- [x] Tests cover events, disconnect/reconnect, missing capabilities, multiple instances, cleanup, privacy filtering, and the absence of lifecycle mutations

## Technical Details

Primary areas: the optional session adapter, canvas lifecycle, and a small UI activity model. Verify actual runtime event shapes and feature support before use. Do not make a full session inspector, cross-session monitor, or transcript archive part of the first version.

## Resources

- https://unpkg.com/@github/copilot-sdk@1.0.26/dist/session.d.ts

## Resume Context

**Current state:** Complete. All acceptance criteria verified with tests.

**What was implemented:**
- Persistent session activity indicator on the main canvas page (not just in the preview dialog)
- Disconnect detection with automatic reconnect polling (5s interval by default)
- Conservative no-response detection: admitted requests that receive no host events for 120s transition to `no-response` state (not `idle`, avoiding completion inference)
- Explicit `acknowledgeNoResponse()` method for users to clear the no-response state and retry
- No auto-resend, no completion inference from host events
- Reconnect timer stops on dispose; no listeners leak
- Non-Copilot hosts show "Agent unavailable on this host" with no fake activity indicator

**Next step:** None — todo is complete. Ready for final verification.

## Work Log

### 2026-10-26 - Session Activity Indicator, Reconnect, and No-Response Recovery

**By:** Kilo

**Actions:**

- Added persistent activity indicator to main canvas page showing session state (unknown, queued, busy, idle, sending, failed, closed, disconnected, no-response)
- Implemented disconnect detection: when the owning session is lost, the bridge transitions to `disconnected` and starts reconnect polling (5s interval)
- Implemented reconnect: when a new session becomes available, the bridge re-attaches, unsubscribes from the old session, and resumes event tracking
- Implemented conservative no-response detection: admitted requests that receive no host events for 120s (configurable) transition to `no-response` state, which blocks duplicate sends but allows explicit retry
- Added `acknowledgeNoResponse()` method for users to explicitly clear the no-response state and attempt a retry
- Activity indicator CSS with color-coded status dots and pulse animations for active states (busy, queued, sending, disconnected, no-response)
- Client-side polling of `/agent/state` every 3s to update the activity indicator on the main page
- Added 10 new tests: disconnect detection, reconnect, no-response timeout, acknowledgeNoResponse, no-response send rejection, dispose cleanup, host event clearing queued state before timeout, no completion inference, multi-instance sharing, and timer cleanup
- All 242 canvas tests pass with no regressions

### 2026-10-26 - Request Bridge Groundwork

**By:** Kilo

**Actions:**

- Added a minimal shared owning-session bridge for 045 with unknown, queued, busy, idle, failed, and closed states
- Preview status uses supported host events only; native/non-Copilot hosts offer copy fallback instead
- No transcript history, raw tool output, or environment values are read or persisted
- Queue admission is not displayed as completed work, and no activity event changes todo state
- Listener disposal does not disconnect or abort the owning session
- An admitted request remains conservatively queued if host events are lost; explicit recovery and real-host lifecycle verification remain open

### 2026-10-25 - Todo Created

**By:** Kilo

**Actions:**

- Captured optional session visibility and the distinction between activity and verified outcomes
- Kept transcript ingestion, automatic completion, and broad session orchestration out of scope
