---
status: completed
priority: p2
issue_id: "080"
tags: [sonarqube, code-quality, mcp]
dependencies: []
---

# Refactor Sonar findings in MCP server

Address the current SonarQube/SonarLint diagnostics in `resources/mcp/server.mjs` while preserving per-call workspace/manual-root resolution and all MCP tool schemas.

## Problem Statement

The live VS Code Problems snapshot reports an incomplete TODO and an incorrect `await` in the MCP server, plus high cognitive complexity in the instance-server construction/route registration function. The diagnostics contain no stable scanner issue IDs, so this is a regular todo rather than an `sq-*` import.

## Findings

- Snapshot source: live VS Code SonarLint diagnostics (`source: sonarqube`), captured 2026-11-24T18:58:05Z; no stable issue identifiers were supplied.
- `S1135` TODO comment at line 48 needs completion or removal with its intended behavior implemented.
- `S4123` `await` on a non-Promise at line 69.
- `S3776` cognitive complexity 203 (threshold 15) in `createInstanceServer` at line 221.

## Recommended Action

Remove the stale TODO after confirming its intent, remove or correct the unnecessary `await`, and decompose `createInstanceServer` into cohesive route-registration and handler helpers while keeping the per-request root/mode resolver single-sourced.

## Resources

- Live Problems capture: SonarQube source, workspace `agendo`, captured 2026-11-24T18:58:05Z.
- No stable scanner issue IDs were returned; do not fabricate an `sq-*` identity.

## Acceptance Criteria

- [ ] Address `S1135`, `S4123`, and `S3776` without altering tool names, schemas, authorization, error handling, or workspace/manual root isolation.
- [ ] Focused MCP discovery, status, IPC, and server-bundle tests pass.
- [ ] Biome lint passes and a fresh scoped Problems check no longer reports the addressed diagnostics.

## Resume Context

**Current state:** Findings captured from the live SonarQube Problems snapshot; no code edits yet.

**Next step:** Identify the stale TODO's intended behavior, then extract server setup/registration helpers and verify tool handlers.

## Work Log

### 2026-11-24 - Track MCP server diagnostics

**By:** Kilo

**Actions:**

- Captured three SonarQube diagnostics in the changed MCP server via `agendo_get_problems`.
- Recorded them as a regular todo because the live diagnostics contain no stable issue IDs.

**Learnings:**

- The server's root-selection and schema behavior must remain unchanged while complexity is reduced.
