---
status: completed
priority: p2
issue_id: "058"
tags: [canvas, approvals, automation, workflow]
group: copilot-integration
dependencies: ["047"]
---

# Optional Auto-Approval With Visible Change Reporting

Allow routine supported changes to proceed without per-change approval clicks while keeping the changes visible and retaining manual review for focused work.

## Problem Statement

The explicit proposal review implemented in 047 is useful for targeted work, but requiring the user to select and confirm every routine change does not fit their normal workflow. Automatic approval and visible change reporting should be independent: reducing confirmation friction must not remove the record of what changed or its supporting evidence.

## Findings

- The user explicitly wants an auto-approve mode and prefers not to accept routine changes individually
- They still value calling out changes and the ability to use explicit review when working on something specific
- Todo 047 supplies bounded typed criterion proposals, revision checks, native write guards, and before/after evidence
- Supported native hosts now offer manual, selected-todo auto, and workspace auto modes with visible change reporting
- Fresh services default to manual; browser controls explicitly authorize automation and agents cannot change that policy

## Recommended Action

Add an explicit approval policy over the existing typed proposal/application machinery rather than a separate unrestricted write path. Support automatic application within an authorized scope and keep manual review available for selected work. Report automatically applied, rejected, stale, unsupported, and failed changes distinctly.

The implemented scope is the selected todo or current workspace for this canvas session only. Closing a native panel revokes automation while preserving its review history; restarting the service defaults to manual. No saved user/workspace preference or group override is implied. The user's stated preference is a low-friction automatic workflow, so new submissions within an explicitly authorized scope do not require individual approval. Other workspaces, unsupported types, and hosts without a native write guard remain unauthorized.

## Acceptance Criteria

- [x] An explicitly enabled auto-approve mode applies supported typed changes within its authorized scope without per-change selection/confirmation clicks
- [x] Manual review remains available for focused work, with clear behavior when switching modes or narrowing scope
- [x] The active policy, affected scope, and how to pause/disable automatic application are visible
- [x] Automatically applied changes still show before/after values, target identities, rationale, and evidence; proposed work is distinguishable from completed local application
- [x] Revision checks, dirty-document protection, workspace trust, native write guards, validation, and atomic application remain mandatory in every mode
- [x] Auto-approval does not grant shell/code-execution permission, broaden the selected task, authorize unsupported proposal types, or bypass host/tool approvals
- [x] Stale, conflicting, unsupported, or failed changes stop or defer with an honest result rather than being silently accepted or retried indefinitely
- [x] Duplicate callbacks, refreshes, mode changes, and reconnections do not cause repeated application or silently apply previously rejected work
- [x] Local progress and automatic approval are not presented as remote scanner clearance or independent verification
- [x] Tests cover scoped authorization, mode transitions, visible reporting, native/unsupported hosts, and existing proposal safety regressions

## Resume Context

**Current state:** Complete for the bounded existing-criterion type. Explicit session-scoped automation, visible outcomes, guarded writes, revocation, and replay protection pass automated and browser checks. No saved preference or live Copilot write capability is claimed.

**Next step:** No remaining work for this bounded mode. Any saved approval preference, additional scope, or new mutation type needs separately defined authorization and safety checks.

## Work Log

### 2026-10-26 - Scoped Auto-Approval and Change Reporting

**By:** Kilo

**Actions:**

- Added an instance-local approval controller wrapping the same proposal store and native guarded mutation path used for manual application
- Added explicit selected-todo and workspace auto scopes, manual review, active scope display, and Pause Auto-Approval; agents have no policy-changing action
- Captured policy generation at submission and rechecked it after the native guard to cancel paused, retargeted, or disposed automatic work
- Existing pending/rejected proposals are never elevated merely by enabling automation
- Preserved failed automatic outcomes when a user later resolves the proposal manually
- Registered in-flight request IDs before admission, rejected conflicting IDs, and returned current proposal state on replay
- Capped replay tombstones at 256 submissions per service without evicting old protections; new work stops honestly at capacity and requires a service restart
- Browser retries preserve only a digest and replay ID across reload after an ambiguous transport failure, not proposal evidence or approval authority
- Added native panel-close revocation while retaining review history, plus service/SDK close disposal
- Unsupported hosts remain inspect/copy-only; auto-approval never supplies a missing native permission guard
- Bumped the bundled canvas to 0.1.9 and included approval.mjs in installation/update files
- Verification passed: 322 extension tests, 233 canvas/request/proposal/approval tests, compile, lint, bundle, syntax checks, and task-scoped git diff --check
- Browser checks covered opt-in, automatic application without per-change acceptance, old pending work, pause/manual review, mobile layout, unsupported hosts, and dropped-response/reload retry with the same ID
- Independent review and strengthened replay tests were used with no more than two concurrent subagents
- A global whitespace check also reported an unrelated existing docs/skill.md trailing space; it was left untouched
- Todo 045 remains ready for the user's later Copilot verification

### 2026-10-26 - User Workflow Preference Captured

**By:** Kilo

**Actions:**

- Recorded auto-approval as a first-class follow-up to 047 rather than replacing change reporting
- Preserved explicit review as an option for focused tasks
- Separated convenience approval policy from native permissions and mutation safeguards
- No approval policy or permission settings were changed
