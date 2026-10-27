---
status: pending
priority: p2
issue_id: "063"
tags: [canvas, plugin, copilot-harness, investigation]
group: canvas
dependencies: []
---

# Investigate Plugin Support for a Native Canvas

Investigate packaging the `agendo-work-session` canvas as a Copilot plugin so it works natively with the agent harness as a true canvas.

## Problem Statement

The canvas is currently delivered as a Copilot extension installed by the Agendo VS Code extension into `~/.copilot/extensions/agendo-work-session/` (or as a project extension). That install step is a workaround: it depends on the VS Code extension copying files, and it is not discoverable or versioned through the harness. If the harness supports plugin-provided canvases, Agendo could ship the canvas as a plugin. It would then be registered by the harness, listed in `<canvases>`, and usable with `open_canvas` and `invoke_canvas_action` without a manual install.

## Findings

- The canvas lives in the `agendo-work-session` extension (`extension.mjs`, `copilot-extension.json`, `server.mjs`, `board.mjs`, and others), managed from `src/todos/canvasManager.ts` and `src/todos/canvasViewer.ts`.
- It is not yet known whether the harness plugin format can declare canvases, or how a plugin differs from an extension in its manifest, lifecycle, and install locations.

## Proposed Solutions

### Option 1: Package the canvas as a harness plugin

**Approach:** Research the plugin manifest and canvas registration APIs, then prototype shipping the existing canvas as a plugin.

**Pros:** Native discovery, versioning, and no manual file copying.

**Cons:** May depend on plugin API stability or host support.

**Effort:** Medium

**Risk:** Medium

---

### Option 2: Keep the extension-based install

**Approach:** Keep the current model and only improve install and update reliability.

**Pros:** No migration and known behavior.

**Cons:** The canvas stays a workaround rather than a native canvas.

**Effort:** Small

**Risk:** Low

## Recommended Action

Start with Option 1 as a time-boxed investigation. Record whether plugins can provide canvases, what manifest and layout they need, and how install and update work. Then recommend migrate, hybrid, or stay.

## Acceptance Criteria

- [ ] Document how the harness defines plugins and whether they can contribute canvases
- [ ] Document differences from the current extension-based install (manifest, lifecycle, locations, permissions)
- [ ] Build a minimal prototype of the canvas loading as a plugin, or explain why it is not feasible
- [ ] Assess impact on `canvasManager.ts`, install and update flow, and VS Code extension versioning
- [ ] Record a recommendation (migrate, hybrid, or stay) with follow-up todos as needed

## Resume Context

**Current state:** Not started.

**Next step:** Find the harness plugin documentation and manifest spec, and check whether plugins can register canvases.

## Work Log

### 2026-10-26 - Todo Created

**By:** Copilot

**Actions:**

- Created the todo from the request to investigate plugin support so the canvas works natively with the agent harness

**Learnings:**

- None yet
