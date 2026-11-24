---
status: completed
priority: p2
issue_id: "081"
tags: [sonarqube, code-quality, mcp]
dependencies: []
---

# Refactor Sonar finding in MCP discovery

Reduce the cognitive complexity of `resolveTodoRoot` in `resources/mcp/discovery.mjs` while preserving strict root-selection safety.

## Problem Statement

The live SonarQube/SonarLint snapshot reports `javascript:S3776` in the multi-root workspace/manual-root resolver. The diagnostic has no stable scanner issue ID, so it is tracked as a regular todo rather than a fabricated `sq-*` issue.

## Findings

- Snapshot source: live VS Code SonarLint diagnostics (`source: sonarqube`), captured 2026-11-24T18:58:05Z; no stable issue identifier was supplied.
- `S3776` cognitive complexity 29 (threshold 15) in `resolveTodoRoot` at line 192.

## Recommended Action

Extract root candidate filtering, explicit name/path matching, CWD/sole-root fallback, and ambiguity/error construction into named helpers. Keep the resolver refusing ambiguous roots and preserving manual-root modes.

## Resources

- Live Problems capture: SonarQube source, workspace `agendo`, captured 2026-11-24T18:58:05Z.
- No stable scanner issue ID was returned.

## Acceptance Criteria

- [ ] Reduce `resolveTodoRoot` complexity without changing exact-path, label, basename, CWD, single-root, or ambiguous-root behavior.
- [ ] Multi-root tests pass for workspace/manual roots, duplicate names, aliases, and fallback.
- [ ] Biome lint passes and a fresh scoped Problems check no longer reports `S3776` here.

## Resume Context

**Current state:** One live SonarQube diagnostic is recorded; implementation has not started.

**Next step:** Refactor the resolver by extracting independent candidate-selection helpers and retain existing isolation tests.

## Work Log

### 2026-11-24 - Track MCP discovery diagnostic

**By:** Kilo

**Actions:**

- Captured the `resolveTodoRoot` complexity diagnostic from live VS Code Problems.
- Recorded it as a regular todo because no stable issue ID was returned.

**Learnings:**

- Root selection must continue to reject ambiguous names and never silently fall back to another root.
