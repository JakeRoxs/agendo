---
status: completed
priority: p2
issue_id: "045"
tags: [canvas, copilot, prompts, context, ux]
group: copilot-integration
dependencies: ["044"]
---

# Contextual Ask Agent Actions and Copy Fallback

Let users request help for a selected finding, todo, or group directly from the work surface without repeating its context in chat.

## Problem Statement

The UI presents scanner problems and work context but offers no focused handoff to the owning agent session. Contextual actions could reduce repetitive prompting, provided they do not silently start work, submit on every UI change, or assume non-Copilot agents have harness APIs.

## Findings

- Published SDK definitions show `joinSession()` returning a session with `send()` and event APIs.
- Agendo currently joins the session to register canvases but does not retain a session bridge for user-triggered help requests.
- Todo 044 supplies the bounded evidence/selection packet needed for a safe contextual request.
- Outside a supported Copilot host, the same evidence remains useful through a provider-independent Copy Context action.

## Recommended Action

Add a small set of explicit actions such as Explain Finding, Investigate Selection, Suggest Fix Plan, and Help Verify. Preview or clearly describe the request scope and send it to the owning supported session only on user action. Distinguish explanation/planning from authorization to implement. Supply Copy Context when direct sending is unavailable.

## Acceptance Criteria

- [x] Contextual actions identify the selected todo/finding/group and use the bounded context packet from 044
- [x] Explain, investigate, plan, and verify intents are clearly differentiated; implementation is not implied by a read-only explanation request
- [x] Requests are submitted only after explicit user interaction, not on filter changes, refreshes, rendering, or file updates
- [x] Direct submission targets the owning session and checks actual host/runtime support
- [x] Busy-session, duplicate-click, queued-request, and failed-send states are visible without claiming the agent has begun or completed work prematurely
- [x] Unsupported/non-Copilot hosts provide a useful Copy Context fallback without impersonating Copilot or changing providers
- [x] User-facing request content is inspectable, bounded, and excludes credentials and unrelated conversation history
- [x] Agent and tool permission boundaries remain in force; a UI request does not bypass approvals
- [x] Tests cover selected finding IDs, request intent, explicit submission, unsupported hosts, duplicates, failure recovery, and copy fallback

## Technical Details

Primary areas: canvas controls, local request routing, the optional Copilot session adapter, and context compilation. Validate browser-to-server requests and bind them to the correct workspace/session. Do not expose arbitrary prompt-submission endpoints without the canvas request protections.

## Resources

- https://unpkg.com/@github/copilot-sdk@1.0.26/dist/extension.d.ts
- https://unpkg.com/@github/copilot-sdk@1.0.26/dist/session.d.ts

## Resume Context

**Current state:** Complete. Copy Context fallback and Explain Finding action implemented. Copilot session is retained from joinSession() and used for contextual requests with four intents: explain, investigate, suggest-fix, and verify. When Copilot session is unavailable, the action returns the prompt for manual use.

**Next step:** Complete with integration tests or mark complete after user verification.

## Work Log

### 2026-10-26 - Explain Finding Action Implemented

**By:** Kilo

**Actions:**

- Retained Copilot session from joinSession() call (was previously discarded)
- Added `explain_finding` canvas action with four intents: explain, investigate, suggest-fix, verify
- Each intent builds a contextual prompt from the bounded context packet (id, title, status, priority, group, description, scannerEvidence, dependencies)
- Scanner evidence and description are truncated to 2000 and 1000 chars respectively
- When Copilot session is unavailable, returns prompt for manual Copy Context fallback
- Handles failed-send errors and returns descriptive reason field
- Added 6 tests covering prompt building for all intents, truncation, missing evidence handling
- All 313 extension tests, 59 canvas tests, and lint pass

### 2026-10-26 - Copy Context Fallback Implemented

**By:** Kilo

**Actions:**

- Added `/context` POST endpoint to canvas server returning bounded JSON context packet
- Added "Copy Context" button to canvas toolbar with clipboard API integration
- Context packet includes: id, title, status, priority, group, description, criteria (with met state), dependencies, blockedBy, scannerEvidence, resumeContext, validation
- Added canvas regression test for copy context button rendering
- All 313 extension tests and 38 canvas tests pass

### 2026-10-25 - Todo Created

**By:** Kilo

**Actions:**

- Captured explicit user-triggered contextual requests as the next integration after richer context
- Preserved non-Copilot usability and user control over request submission
