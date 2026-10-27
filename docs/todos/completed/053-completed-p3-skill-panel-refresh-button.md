---
status: completed
priority: p3
issue_id: "053"
tags: [ui, skill-panel, refresh]
dependencies: []
---

# Skill panel refresh button to check for updates

## Problem Statement

The skill panel should have a "refresh" button that explicitly checks for updates to installed
skills. Users should be able to trigger this action on demand without relying on automatic or
background update checks.

## Acceptance Criteria

- [x] Add a visible refresh button to the skill panel UI
- [x] Clicking refresh triggers an explicit check for skill updates
- [x] Display results of the update check (e.g., "all up to date", "N updates available")
- [x] Provide clear feedback during the check (loading state)

## Resume Context

**Current state:** Skill panel refresh explicitly checks installed/bundled/source versions for skill and canvas. Loading feedback, duplicate-request protection, source failure warnings, and last-checked panel details are implemented.

**Next step:** No remaining work for 053. Refresh never installs or overwrites files.

## Work Log

### 2026-10-26 - Implemented and Verified

**By:** Kilo

**Actions:**

- Added a visible Skill panel refresh action and disabled spinner while checking
- Checked both components in parallel and reported newer versions, uninstalled components, and unavailable sources distinctly
- Cached only the last source-check result for the current configured source URL; rendering the panel does not trigger network requests
- Kept all installations separate and explicit
- Added six regression tests for checks, results, failure handling, concurrent clicks, panel details, and toolbar contributions
- Verified: 221 extension tests pass, compilation and lint pass with the existing Biome schema-version informational notice

### 2026-10-26 - Todo created

**By:** Kilo

**Actions:**

- Created todo for skill panel refresh button feature
