---
status: pending
priority: p2
issue_id: "076"
tags: [mcp, vscode, diagnostics, integration]
dependencies: []
---

# Expose VS Code Problems Through Agendo MCP

Add a read-only Agendo MCP tool that returns diagnostics published by the selected VS Code window, including diagnostics for unsaved edits when language extensions publish them.

## Problem Statement

MCP clients cannot currently query the Problems reported by the active Agendo extension host. Exposing a scoped, read-only diagnostics snapshot through Agendo's existing MCP server would let agents inspect compiler and language-service feedback, including diagnostics from unsaved buffers, without requiring access to VS Code internals.

The initial implementation targets desktop VS Code on Linux and Windows, with an MCP client and the extension host on the same machine. The selected window is explicit through a per-window local IPC endpoint, avoiding ambiguous workspace discovery.

## Findings

- Kilo's local MCP config accepts `type: "local"`, a `command` string array (executable followed by arguments), optional `cwd`, environment, enabled flag, and timeout. Its MCP client uses stdio transport, pipes stderr separately, and sanitizes its environment rather than inheriting all backend credentials (`kilocode/packages/core/src/v1/config/mcp.ts`, `kilocode/packages/opencode/src/mcp/index.ts`).
- Kilo exposes connected tools as `<server-name>_<tool-name>` after replacing characters outside `[A-Za-z0-9_-]` with underscores (`kilocode/packages/opencode/src/mcp/catalog.ts`). With server key `agendo` and tool `get_problems`, the exposed name is `agendo_get_problems`.
- MCP tool permissions use the exposed tool name. Kilo has special default read mapping for MCP resource-list/read tools, but not arbitrary custom tools (`kilocode/packages/opencode/src/permission/index.ts`). The generated config should not imply that this tool bypasses the user's configured agent permissions; test and document permission behavior for `agendo_get_problems`.
- Agendo already depends on `@modelcontextprotocol/sdk` and has a bundle step for an MCP server (`package.json`), so protocol registration does not require introducing the SDK. `activate()` receives an extension context whose subscriptions are disposed by VS Code, while the current exported `deactivate()` has no explicit cleanup (`src/extension.ts`).
- Agendo already has a generic stdio MCP server in `resources/mcp/server.mjs`, an MCP configuration command in `src/commandRegistration.ts`, and an MCP SDK runtime dependency. The server is launched as a separate process and currently handles todo operations; it cannot directly call the VS Code API. `get_problems` should extend this server and use an extension-host bridge, rather than introduce a second MCP server/configuration.
- The existing “Show MCP Configuration” command emits a generic `mcpServers` config with the installed extension's bundled server path. The new tool should be available through this existing server entry; Kilo compatibility should be validated without making Kilo-specific config the product contract.
- Local IPC needs platform-specific endpoint naming: Unix-domain sockets on Linux and named pipes on Windows. Node's `net` APIs can expose the same request protocol over either endpoint, but endpoint creation, permissions, stale endpoint handling, and cleanup differ by OS. On Windows, use a per-user location/name with appropriate access control rather than assuming Unix `chmod` semantics.
- Node's `node:net` API supports Unix-domain sockets on non-Windows and named pipes on Windows, so one transport implementation can select an endpoint by `process.platform`. On Linux, filesystem socket paths are typically limited to 107 bytes; Node removes a socket on normal server close but a process crash can leave it behind. On Windows, pipe names use the `\\.\pipe\` namespace and do not persist after the final handle closes. Node's IPC server options default `readableAll` and `writableAll` to false; use the defaults and verify actual access behavior on supported Windows versions.
- The extension manifest supports VS Code 1.103+, targets Node 18 for the MCP bundle, and already packages `resources/mcp/server.bundle.mjs` while excluding the unbundled source. Keep new runtime code within the Node/Vscode API baseline and test the actual packaged artifact, not only `server.mjs`.
- `vscode.languages.getDiagnostics()` returns all diagnostic URI/array pairs synchronously. `vscode.languages.onDidChangeDiagnostics` is available if the bridge later needs cache invalidation, but the simplest correct v1 is to read the snapshot on each request. Use `vscode.workspace.getWorkspaceFolder(uri)` to associate file diagnostics with a workspace folder; do not infer a folder by string prefix alone.
- VS Code diagnostics use zero-based `Position` line and character values; the tool contract promises one-based positions, so serialize each start/end line and character as API value + 1. Normalize relative paths to `/` separators on both operating systems. Limit workspace scope to file URIs whose diagnostics resolve to one of the selected workspace folders; skip non-file/virtual resources rather than inventing filesystem paths.
- The extension may run in a remote extension host or web host where a local client process cannot reach the endpoint. The v1 contract should explicitly support only local desktop extension hosts, disable/refuse bridge startup for remote/web environments, and explain that the MCP client and VS Code extension host must share the machine/OS IPC namespace.
- The diagnostics bridge should be enabled by default on supported local desktop hosts, per the user's decision. Provide `agendo.mcp.problems.enabled` as an explicit opt-out (default true); disabling it closes the active listener and makes tool calls return an unavailable/disabled error. “Show MCP Configuration” should display config for the active window without an enable prompt. Re-running the command for another window produces that window's endpoint; no global discovery/ambiguity mechanism is required.
- Endpoint persistence is a separate design constraint: a random per-extension-host endpoint is safest and distinguishes two VS Code windows, but changes after a restart and makes a copied MCP config stale. A stable workspace endpoint survives restarts but two windows opened on the same workspace collide and need a defined owner/selection policy. Do not claim persistent MCP configuration until this is resolved. MVP can explicitly make endpoint/config session-scoped and require rerunning “Show MCP Configuration” and reconnecting the MCP client after the originating window restarts.
- Linux endpoint recommendation: create a short, extension-owned directory under `os.tmpdir()` with `fs.mkdtemp`, set directory mode `0700`, and put one socket with a short filename inside. On normal shutdown close the server and remove the owned directory; after a crash, only reclaim a directory with the extension-owned naming pattern and verified private ownership, and only after confirming no listener is active. Fail closed rather than unlinking an endpoint that may belong to another process. On Windows, use a per-user named pipe such as `\\.\pipe\agendo-<stable-user-scope>-<random-window-token>`; use an unguessable per-window token and do not enable `readableAll`/`writableAll`.
- Use a small newline-delimited JSON request/response protocol over IPC with one request per connection, a strict maximum input size, timeout, and socket close after response. Avoid sending MCP protocol bytes across the bridge; MCP remains stdio between client and Agendo's existing server.
- The explicit per-window IPC endpoint selects a specific extension host/window. Therefore `ambiguous_window` is not a v1 error case; it only becomes relevant if future discovery selects an endpoint by workspace identity.
- `get_problems` should treat `workspaceFolder` as a workspace-folder identifier/path, not merely a display name. In a multi-root workspace, require an unambiguous workspace-relative path base. A request naming a folder outside the selected window's workspace must fail validation rather than return diagnostics from elsewhere.
- The endpoint is read-only but exposes source content through diagnostic messages and paths. The socket directory and socket must be restricted to the current OS user, socket permissions should be private, and the extension should only accept local requests from that socket. Define stale-socket cleanup and bounded request/response behavior.

## Recommended Action

Implement v1 as a local IPC bridge enabled by default for Linux and Windows desktop extension hosts, with an explicit endpoint per VS Code window:

1. Add a small diagnostics service that reads `vscode.languages.getDiagnostics()` on every request, resolves the workspace folder, validates workspace-relative path filters, applies severity and limit filters, and serializes stable JSON positions and optional source/code fields.
2. Add `agendo.mcp.problems.enabled`, default true. Start the diagnostics bridge automatically on supported local desktop extension hosts and stop it when explicitly disabled. The existing “Show MCP Configuration” command displays config with the active window's endpoint without an enable prompt. For v1, label the generated endpoint/config as session-scoped and require users to regenerate it and reconnect after that VS Code window restarts.
3. Put the IPC framing and endpoint selection behind a small shared helper used by extension host and stdio server. Use newline-delimited JSON, one request per connection, maximum request/response sizes, and a short timeout. Use a short private `mkdtemp`-created Unix socket directory on Linux and a per-user, random per-window named pipe on Windows. Do not enable Node's `readableAll` or `writableAll`. Never remove an active or unverified endpoint to recover from a bind collision.
4. Register the listener with `context.subscriptions` and ensure deactivation closes the listener and removes only its owned endpoint. Map absent/unreachable endpoint to a typed `editor_unavailable` tool error. Register protocol/log diagnostics only on stderr; keep MCP stdout clean.
5. Add `get_problems` to the existing stdio server in `resources/mcp/server.mjs` using the already-installed SDK. Extend the existing “Show MCP Configuration” command to include the installed bundled server path and current window endpoint. Keep server key `agendo` and tool name `get_problems`; verify Kilo exposes `agendo_get_problems`, while preserving client-neutral MCP behavior and normal Kilo per-agent permissions.
6. Keep workspace-based endpoint discovery, remote/web extension-host support, cross-machine IPC, automatic edits to client configuration files, and `ambiguous_window` behavior out of v1.

**Triage decision:** The diagnostics bridge is enabled by default, with `agendo.mcp.problems.enabled` as an explicit opt-out. Keep pending until the session-scoped configuration lifecycle and endpoint ownership/cleanup protocol are accepted; implementation has not been authorized by this triage note.

## Tool Contract

```ts
get_problems({
  path?: string,             // Workspace-relative file or directory
  workspaceFolder?: string,  // Required when the workspace has multiple roots
  severity?: ("error" | "warning" | "information" | "hint")[],
  limit?: number              // Default 100, capped at 500
})
```

Return `{ workspaceFolder, capturedAt, total, truncated, diagnostics }`. Each diagnostic includes a workspace-relative path with `/` separators, one-based start/end line and character positions, severity, message, and source and code when supplied. `capturedAt` is an ISO-8601 UTC timestamp recorded when Agendo read the snapshot. `total` is the count after scope/path/severity filtering and before applying the limit; `truncated` is true when matching diagnostics were omitted by the limit. An empty diagnostics array means VS Code had no published file diagnostics in scope at that moment. Invalid workspace selectors, paths outside the selected folder, and invalid limits return explicit input errors.

## Example Client Configuration

Illustrative client configuration using Agendo's existing MCP server entry. Agendo supplies the installed server path and the current window's platform-specific IPC endpoint:

```json
{
  "mcp": {
    "agendo": {
      "type": "local",
      "command": [
        "node",
        "/absolute/path/to/agendo/resources/mcp/server.bundle.mjs",
        "--endpoint",
        "<current-window-local-ipc-endpoint>"
      ],
      "enabled": true
    }
  }
}
```

The MCP server key is `agendo`; Kilo exposes the tool as `agendo_get_problems` and its normal per-agent tool permissions still govern invocation. Other MCP clients should use their equivalent stdio server configuration and can call `get_problems`.

## Acceptance Criteria

- [ ] The diagnostics bridge starts by default (setting defaults true), can be explicitly disabled, works on Linux and Windows local desktop VS Code, and reads the current published diagnostic snapshot on each request, including diagnostics published for unsaved edits.
- [ ] The tool supports workspace-relative file/directory filters, explicit multi-root folder selection, severity filtering, and a default limit of 100 capped at 500; invalid/out-of-scope paths are rejected.
- [ ] Results include selected workspace folder, ISO-8601 UTC capture time, filtered total, truncation metadata, POSIX-style relative paths, one-based start/end line and character positions (converting VS Code's zero-based API positions), severity, message, and optional source/code values; non-file diagnostics are excluded from the filesystem-path contract.
- [ ] The extension bridge uses an explicit per-window Unix socket on Linux (short private directory; path under OS limits) and named pipe on Windows (per-user scope and random window token), validates request framing/size, handles stale owned endpoints without deleting active/unverified endpoints, and closes/cleans up its endpoint on deactivation.
- [ ] `get_problems` is added to the existing stdio MCP server, which reserves stdout for protocol messages, sends logs to stderr, bounds requests, and returns `editor_unavailable` when the configured extension host is unavailable.
- [ ] The existing MCP configuration command generates a working session-scoped config using the installed server path and current window endpoint for supported generic MCP clients, explains that it must be regenerated/reconnected after the window restarts, and Kilo exposes `agendo_get_problems` without bypassing normal per-agent permissions.
- [ ] Tests cover severity/path filtering, multi-root requirements, invalid selectors, limits/truncation, serialization, Linux socket and Windows named-pipe security/cleanup, remote/web host refusal, unavailable editor behavior, and bridge disposal.
- [ ] End-to-end validation introduces a language-server diagnostic in an unsaved buffer, queries that file through at least one generic MCP client and Kilo, and confirms returned message and position match VS Code; closing the originating window makes the same call return `editor_unavailable`.

## Technical Details

- `src/extension.ts` — register/start the default-on diagnostics bridge from `activate()` and dispose it during deactivation.
- Diagnostics service — read VS Code diagnostics, validate selected workspace/path scope, filter, and serialize results.
- `resources/mcp/server.mjs` — add `get_problems` to the existing client-neutral stdio MCP server and communicate with the extension over local IPC.
- `src/commandRegistration.ts` — extend the existing MCP configuration command with the current window's platform-specific IPC endpoint.
- IPC bridge — use Unix-domain sockets on Linux and named pipes on Windows with platform-appropriate per-user protection and cleanup.
- Kilo reference source — `/home/jake/repos/kilocode/packages/core/src/v1/config/mcp.ts`, `/home/jake/repos/kilocode/packages/opencode/src/mcp/index.ts`, `/home/jake/repos/kilocode/packages/opencode/src/mcp/catalog.ts`, and `/home/jake/repos/kilocode/packages/opencode/src/permission/index.ts`.

## Resources

- [Agendo extension entry point](../../src/extension.ts#L24)
- [VS Code Diagnostics API](https://code.visualstudio.com/api/references/vscode-api#languages.getDiagnostics)
- [VS Code Workspace API](https://code.visualstudio.com/api/references/vscode-api#workspace.getWorkspaceFolder)
- [Node.js 22 IPC support](https://nodejs.org/docs/latest-v22.x/api/net.html#ipc-support) (Unix sockets and Windows named pipes; endpoint lifecycle/path constraints)
- Kilo source: `packages/core/src/v1/config/mcp.ts` (local MCP config schema)
- Kilo source: `packages/opencode/src/mcp/index.ts` (stdio transport and local server launch)
- Kilo source: `packages/opencode/src/mcp/catalog.ts` (exposed tool naming)
- Kilo source: `packages/opencode/src/permission/index.ts` (MCP tool permission mapping)
- Kilo docs: `packages/kilo-vscode/docs/non-agent-features/mcp-and-mcp-hub.md` (MCP settings and tool allowlisting status)

## Resume Context

**Current state:** Agendo already has a client-neutral stdio MCP server/config command. Proposed v1 extends it with `get_problems`, with the diagnostics bridge on by default and an explicit opt-out setting; `node:net` supports Unix sockets (Linux) and named pipes (Windows). Linux socket path limits/crash recovery, Windows pipe access, local-only host support, one-based position conversion, and session-scoped config behavior are specified.

**Next step:** Implement the default-on bridge setting and config command, shared bounded IPC helper, diagnostics filtering service, and `get_problems` tool with platform-specific tests.

## Work Log

### 2026-11-23 - Todo Created

**By:** Kilo

**Actions:**

- Recorded the proposed extension-host diagnostics bridge, separate stdio MCP server, per-window socket design, tool contract, configuration example, and end-to-end validation scenario.

**Learnings:**

- The initial draft assumed Linux only; triage expanded the target to Linux and Windows and aligned the design with Agendo's existing MCP server.

### 2026-11-23 - Kilo MCP Integration Triage

**By:** Kilo

**Actions:**

- Inspected local Kilo MCP config schema, stdio client launch, exposed tool naming, permission mapping, and VS Code MCP settings documentation.
- Confirmed local config uses `type: "local"` plus a command array, and Kilo's naming function exposes this server/tool pair as `agendo_get_problems`.
- Refined the response contract for filtered totals, truncation, invalid inputs, and multi-root workspace selection; scoped `ambiguous_window` out of v1 because the socket is explicit per window.
- Added bridge enablement, user-private socket, bounded protocol, stale-socket cleanup, lifecycle, and permission acceptance criteria.
- Confirmed Agendo already ships a client-neutral stdio server and “Show MCP Configuration” command; changed the plan to extend these rather than ship a second MCP server.
- Expanded the target to Linux and Windows with Unix-domain sockets and named pipes respectively, while keeping Kilo as a compatibility target rather than the only client.
- Checked the official VS Code diagnostics/workspace API and Node 22 IPC documentation; specified file-URI workspace resolution, Linux socket path/stale-file constraints, Windows named-pipe lifecycle/default access flags, and local-only extension-host scope.
- Specified an explicit setting controlling bridge availability and a bounded newline-delimited JSON IPC protocol independent of MCP stdio; user confirmed the bridge should be enabled by default.
- Confirmed the API's positions are zero-based and specified conversion to the requested one-based output; normalized path separator and virtual/non-file URI behavior.
- Identified that dynamic per-window endpoints become stale after a VS Code restart, while stable workspace endpoints collide for duplicate windows; documented session-scoped configuration as the simplest v1 behavior requiring regeneration/reconnect after restart.

**Learnings:**

- The SDK is already a runtime dependency and the repo already bundles an MCP server, so `get_problems` should extend existing server/build/configuration flows rather than add a second server.
- Kilo's built-in read permission mapping covers MCP resource reads, not arbitrary tools; the generated configuration must not imply permission bypass for `agendo_get_problems`.
- The current Agendo server is separate from the extension host, so published VS Code diagnostics require a local IPC bridge even though the MCP server already exists.
- A generic MCP tool name/config supports multiple clients; Kilo-specific naming and permissions are validation details, not API behavior.
- Node's cross-platform `net` API avoids a new IPC dependency, but Linux crash-stale socket handling and path length require an owned short private directory; Windows pipes disappear when their final handle closes.
- Snapshot-on-request avoids cache staleness and does not require subscribing to diagnostic-change events for v1.
- `vscode.languages.getDiagnostics()` exposes API positions as zero-based values, so the public tool must increment both line and character values to meet the one-based contract.
- Per-window selection and persistent copied client configuration conflict unless endpoint identity is stable; v1 needs an explicit session-lifetime/reconnect statement or a separately designed workspace-ownership policy.
- Default-on behavior is user's chosen baseline; the setting is an opt-out rather than a consent prompt.
