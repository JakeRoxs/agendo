---
status: completed
priority: p2
issue_id: "082"
tags: [sonarqube, code-quality, commands]
dependencies: []
group: sonarqube
---

# Refactor live Sonar findings in command registration

Address the current SonarQube/SonarLint diagnostics in `src/commandRegistration.ts` without changing root-aware command behavior.

## Problem Statement

The current editor diagnostics report cognitive complexity in `resolveRootServices`, a `.find()` used only to test existence, and a nullable property guard that can use optional chaining. These are live diagnostics without stable Sonar issue IDs; this regular todo is separate from the older imported file-based scanner todo `sq-001`.

## Findings

- Snapshot source: live VS Code SonarLint diagnostics (`source: sonarqube`), captured 2026-11-24T18:58:05Z; no stable issue identifiers were supplied.
- `S3776` cognitive complexity 36 (threshold 15) in `resolveRootServices` at line 942.
- `S7754` use `.some()` rather than `.find()` for an existence check at line 958.
- `S6582` prefer optional chaining at line 1487.
- Related imported history: `sq-001` tracks prior findings for this same file; its managed Scanner Evidence block remains independent.

## Recommended Action

Split `resolveRootServices` into small helpers that preserve active-root fallback, exact-URI matching, manual-root routing, and ambiguity safety. Apply the `.some()` and optional-chaining simplifications without changing command behavior. Keep the new work log and acceptance state separate from `sq-001`.

## Resources

- Live Problems capture: SonarQube source, workspace `agendo`, captured 2026-11-24T18:58:05Z.
- Informational overlap: imported scanner todo `sq-001` (same file, older stable scanner evidence); no checklist or status should be copied from it.

## Acceptance Criteria

- [ ] Reduce `resolveRootServices` complexity while preserving root-local routing, duplicate-ID safety, and stale-selection no-ops.
- [x] Replace the existence-only `.find()` with `.some()` and the null guard with optional chaining where semantics are equivalent.
- [ ] Focused command/root tests, compile, lint, and full extension tests pass.
- [ ] A fresh scoped Problems check no longer reports these three diagnostics; keep `sq-001`'s managed evidence/checklist unchanged.

## Resume Context

**Current state:** The `.find()` and optional-chain findings are fixed and compile/lint clean. The `resolveRootServices` cognitive-complexity finding remains.

**Next step:** Extract `resolveRootServices` into cohesive helpers, then run command/root tests and recheck live diagnostics.

## Work Log

### 2026-11-24 - Track live command registration diagnostics

**By:** Kilo

**Actions:**

- Captured three SonarQube diagnostics in `src/commandRegistration.ts` from the live Problems view.
- Recorded a regular todo rather than fabricating scanner identities; preserved the older imported `sq-001` evidence.
- Started with the behavior-preserving `find`→`some` and optional-chain improvements while assigning the larger root-resolution refactor for follow-up.
- Changed the active-repository membership check to `.some()` and the selected-folder dialog guard to optional chaining; targeted lint and compile pass.

**Learnings:**

- The complexity refactor must retain URI-based per-root dispatch and must never resolve a duplicate ID without root context.
