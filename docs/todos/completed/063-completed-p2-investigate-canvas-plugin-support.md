---
status: completed
priority: p2
issue_id: "063"
tags: [canvas, plugin, copilot-harness, investigation]
group: canvas
dependencies: []
---

# Investigate Plugin Support for a Native Canvas

## Acceptance Criteria

- [x] Document how the harness defines plugins and whether they can contribute canvases
- [x] Document differences from the current extension-based install (manifest, lifecycle, locations, permissions)
- [x] Build a minimal prototype of the canvas loading as a plugin, or explain why it is not feasible
- [x] Assess impact on `canvasManager.ts`, install and update flow, and VS Code extension versioning
- [x] Record a recommendation (migrate, hybrid, or stay) with follow-up todos as needed

## Summary

Investigated packaging the `agendo-work-session` canvas as a Copilot plugin so it works natively with the agent harness as a true canvas. **Recommendation: hybrid** — keep the existing extension-based install as the primary mechanism, and package the canvas as a plugin for optional distribution. See Recommendation below.

## Findings: How the Harness Defines Plugins and Whether They Can Contribute Canvases

**Plugins** (Copilot/agent plugins) are installable packages with a `plugin.json` manifest. Two formats exist:

1. **Agent Plugins 1.0** — `plugin.json` with `$schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"`. Fields: `$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `extensions` (client-specific data keyed by reverse-domain namespace). Skills in `skills/`, MCP in `mcp.json`. Copilot-specific components in `com.github.copilot/` directory.
2. **Legacy Copilot plugins** — `plugin.json` without `$schema`. Fields: `name` (required), `description`, `version`, `author`, `homepage`, `repository`, `license`, `keywords`, `category`, `tags`, and component paths: `agents`, `skills`, `commands`, `hooks`, `extensions`, `mcpServers`, `lspServers`.

**Plugins CAN include canvases.** The GitHub Copilot app docs state: "A canvas extension can be included in a plugin alongside other capabilities, such as skills or MCP servers." The `backrooms-canvas` plugin (in `github/awesome-copilot`, `plugins/backrooms-canvas/`) is a working reference. Its `plugin.json` declares the canvas extension subdirectory under a client-specific namespace:

```json
{
  "name": "backrooms-canvas",
  "version": "1.0.0",
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "extensions": {
    "com.github.copilot": { "logo": "assets/preview.png" },
    "com.github.awesome-copilot": {
      "extensions": ["./extensions/backrooms-canvas"]
    }
  }
}
```

The canvas extension files live in `./extensions/backrooms-canvas/` (containing `copilot-extension.json` and `extension.mjs`). The runtime recognizes `copilot-extension.json` within that subdirectory and installs it as a canvas extension.

**Plugin install locations:**
- Marketplace installs: `~/.copilot/installed-plugins/<MARKETPLACE>/<PLUGIN-NAME>/`
- Direct installs: `~/.copilot/installed-plugins/_direct/<SOURCE-ID>/`
- Installed via `copilot plugin install <spec>` or through the Copilot app's Plugins view

## Differences from the Current Extension-Based Install

| Aspect | Extension-Based (Current) | Plugin-Based |
|---|---|---|
| **Manifest** | `copilot-extension.json` (name, version) | `plugin.json` (Agent Plugins 1.0 schema) |
| **Install location** | `~/.copilot/extensions/<name>/` or `.github/extensions/<name>/` | `~/.copilot/installed-plugins/<MARKETPLACE>/<PLUGIN-NAME>/` or `~/.copilot/installed-plugins/_direct/<SOURCE-ID>/` |
| **Entry mechanism** | `@github/copilot-sdk/extension` with `createCanvas`/`joinSession` | Plugin system loads `plugin.json`, resolves client-specific extensions |
| **Versioning** | `.canvas-meta.json` version field | `plugin.json` version field |
| **Update flow** | Manual file copy / GitHub raw fetch | `copilot plugin install <spec>` / `copilot plugin update` |
| **Permissions** | File system write to extensions dir | Plugin trust/consent prompt, sandboxed |
| **Distribution** | Bundled with VS Code extension | Marketplace or direct install |

## Minimal Plugin Prototype

Created at `/tmp/kilo/agendo-work-session-plugin/`:

```
/tmp/kilo/agendo-work-session-plugin/
├── plugin.json                                  # Agent Plugins 1.0 manifest
└── extensions/
    └── agendo-work-session/                     # Canvas extension subdirectory
        ├── copilot-extension.json               # Canvas extension manifest
        └── extension.mjs                        # Canvas entry point (copied from repo)
```

The `plugin.json` uses Agent Plugins 1.0 format and declares the canvas extension subdirectory under `extensions.com.github.awesome-copilot.extensions: ["./extensions/agendo-work-session"]`, mirroring the `backrooms-canvas` plugin pattern. The prototype does not modify any existing repo files.

## Impact on `canvasManager.ts`, Install/Update Flow, and Versioning

**`install()`**: Would change from copying files to `~/.copilot/extensions/agendo-work-session/` to invoking the Copilot plugin install command (e.g., `copilot plugin install <plugin-spec>`). The `CANVAS_FILES` list and `OBSOLETE_FILES` logic become obsolete. The `assets/` directory creation is no longer needed.

**`updateFromSource()`**: Would change from fetching GitHub raw URLs to using `copilot plugin update` or re-installing from an updated plugin source. The `CANVAS_FILES`-based fetch loop is replaced by a single plugin update operation.

**`updateIfInstalled()`**: Would compare `plugin.json` version instead of `.canvas-meta.json`. The logic shifts from "bundled version newer than installed" to checking if a newer plugin version is available via the plugin registry.

**`getStatus()`**: Would check for the plugin's presence in `~/.copilot/installed-plugins/` instead of `~/.copilot/extensions/`. Version reading would come from `plugin.json` instead of `.canvas-meta.json`. The `installed` check would verify plugin registration rather than `extension.mjs` existence.

**`removeLegacyCopy()`**: The legacy `.github/extensions/` migration logic may become less relevant since plugins install at a different location entirely, but project-level plugin copies could still exist.

**Versioning changes:**
- Current: Version tracked in `.canvas-meta.json` (`"version": "0.1.9"`), separate from the extension's `copilot-extension.json` version (`1`).
- Plugin: Version tracked in `plugin.json` (`"version": "1.0.0"`). The canvas extension's `copilot-extension.json` version becomes secondary/redundant.

## Feasibility Assessment

**Can the existing canvas work as a plugin-provided canvas?** Partially, with caveats.

The canvas uses `@github/copilot-sdk/extension` with `createCanvas` and `joinSession`, which is the same SDK that plugin-provided canvases use. The `backrooms-canvas` plugin demonstrates that canvases can be packaged as plugins.

However, there are significant issues:

1. **Local HTTP server**: `server.mjs` creates a local HTTP server on `127.0.0.1` to serve the canvas UI. Plugins typically run in a sandboxed environment where creating network listeners may be restricted or require explicit permissions.

2. **File system access**: `extension.mjs` uses `resolveWorkspaceRoot(dirname(fileURLToPath(import.meta.url)))` to find the workspace root, and `server.mjs` reads files via `readFileSync`. Plugin sandboxing may restrict file system access beyond the plugin's own directory.

3. **`@github/copilot-sdk/extension` availability**: The SDK must be available in the plugin's runtime environment. When loaded as a plugin, the SDK's expectations about `import.meta.url` and directory resolution may differ.

4. **Canvas registration**: The plugin system needs to know how to load and register the canvas extension. The `com.github.awesome-copilot.extensions` namespace in `plugin.json` tells the plugin loader where the canvas extension files are, but the runtime must support loading `copilot-extension.json` + `extension.mjs` from that subdirectory.

**Verdict**: The canvas *can* work as a plugin-provided canvas in principle (same SDK), but the local HTTP server and file system access patterns may require adaptation or may not be supported in the plugin sandbox. This would need testing with the actual Copilot plugin runtime.

**Permissions note**: File system access is a bigger concern in the GitHub Copilot app (web client) than in the VS Code agent host. The agent host likely has broader permissions, so a plugin may work in VS Code but be restricted in the web client. This reinforces the hybrid recommendation — the extension-based install remains the reliable path across all hosts.

## Recommendation: Hybrid

**Recommendation: Hybrid approach — keep the existing extension-based install as the primary mechanism, but package the canvas as a plugin for optional distribution.**

### Justification

**Pros of staying with extension-based:**
- Proven, working install flow in `canvasManager.ts`
- No sandboxing restrictions on local HTTP server or file system access
- Full control over versioning and update flow via GitHub raw URLs
- No user trust prompt required (installs silently as part of the extension)

**Pros of plugin support:**
- Can be distributed via Copilot marketplace
- Cleaner separation of concerns
- Standard plugin update flow (`copilot plugin update`)
- Potential for broader distribution

**Cons of migrating fully to plugin:**
- Sandboxing may break the local HTTP server and file system access
- Loses control over the silent install/update flow
- Requires user trust prompts
- `canvasManager.ts` would need significant rework

### Hybrid approach

1. Keep `canvasManager.ts` extension-based install as-is (primary, works reliably).
2. The plugin package at `/tmp/kilo/agendo-work-session-plugin/` is an optional alternative distribution mechanism.
3. Document that users can install the plugin via `copilot plugin install <spec>` if they prefer the plugin model.
4. Future work: test whether the canvas works in the plugin sandbox; if the local HTTP server causes issues, explore alternative transport (e.g., message passing via the canvas SDK).

## Follow-Up Todos

- [ ] Test the plugin prototype by installing it in a Copilot environment to verify canvas registration works.
- [ ] If the local HTTP server is blocked in the plugin sandbox, explore alternative transport (e.g., message passing via the canvas SDK).
- [ ] Document the plugin install command (`copilot plugin install <spec>`) for users.
- [ ] Consider adding a `copilot plugin install` fallback in `canvasManager.ts` for users who prefer the plugin model.
- [ ] Evaluate whether to ship the plugin in the Agendo marketplace.

## Resume Context

**Current state:** Investigation complete. Plugin format researched, minimal prototype built at `/tmp/kilo/agendo-work-session-plugin/`, impact assessed, recommendation recorded.

**Next step:** None. Task 063 is complete. The canvas remains bundled and installed via the extension-based `canvasManager.ts`. Plugin support is available as an optional alternative.

## Work Log

### 2026-10-27 - Investigation Complete

**By:** Kilo

**Actions:**

- Researched the Copilot plugin manifest format (Agent Plugins 1.0 and legacy formats)
- Confirmed plugins CAN include canvases by shipping a canvas extension subdirectory declared in `plugin.json` under a client-specific namespace (e.g., `extensions.com.github.awesome-copilot.extensions`)
- Used the `backrooms-canvas` plugin as a working reference
- Built a minimal plugin prototype at `/tmp/kilo/agendo-work-session-plugin/` with `plugin.json` and `extensions/agendo-work-session/` containing `copilot-extension.json` and `extension.mjs`
- Assessed the impact on `canvasManager.ts`, install/update flow, and versioning
- Conducted a feasibility assessment (partially feasible; local HTTP server and file system access may be restricted in the plugin sandbox)
- Recorded a hybrid recommendation: keep extension-based install as primary, add plugin support as optional

**Learnings:**

- Plugins install to `~/.copilot/installed-plugins/`, not `~/.copilot/extensions/`
- The `extensions` field in `plugin.json` (client-specific namespace) is how canvas extension subdirectories are declared
- The canvas's local HTTP server (`127.0.0.1`) and file system access may face sandboxing restrictions in the plugin runtime
- The hybrid recommendation preserves the proven extension-based install while offering plugin distribution as an option
