---
status: completed
priority: p2
issue_id: "077"
tags: [dependencies, security, dependabot]
dependencies: []
---

# Upgrade test toolchain for patched minimatch

Resolve the remaining transitive `minimatch` / `glob` advisories in the development test toolchain without leaving vulnerable nested copies.

## Problem Statement

GitHub Dependabot reports moderate vulnerabilities for `minimatch` globparts amplification (GHSA-g3hv-75wg-m249) and a related `glob` issue (GHSA-3g3m-2fjr-6pw4). Current affected copies are pulled in by the development toolchain, not production runtime code.

## Findings

- Lockfile tree (v3): safe copy `glob@14.0.6` → `minimatch@11.0.9` (nested under glob). Vulnerable copies: `minimatch@10.2.6` (root, hoisted to satisfy mocha/test-exclude) and `glob@13.0.7` (two nested copies: under `mocha` and under `test-exclude`).
- `mocha@12.0.3` (latest) depends on `glob@^13.0.0` and `minimatch@^10.2.2`; `test-exclude@8.0.0` (latest) depends on `glob@^13.0.6` and `minimatch@^10.2.2`; `c8@12.0.0` (latest) depends on `test-exclude@^8.0.0`. All three are latest releases; none resolves `glob@14` / `minimatch>=11`.
- The `glob` advisory GHSA-3g3m-2fjr-6pw4 covers glob 9.0.0–14.0.1, so `glob@13.0.7` is vulnerable **regardless of minimatch version**. A minimatch-only override cannot clear the `glob` advisory.
- `glob@13` is tagged `v13-legacy` and was deliberately kept on minimatch@10 while glob@14 pairs with minimatch@11; glob@13 tightly mutates the minimatch module object. glob@14 is a breaking rewrite.

### Migration: scoped `overrides` to `glob@14` / `minimatch@11`

- Added `"minimatch": "^11.0.5"` plus nested `"mocha": {"glob": "^14.0.6"}` and `"test-exclude": {"glob": "^14.0.6"}` to `package.json` overrides; clean `npm install`.
- Result: all `minimatch` copies resolved to `node_modules/minimatch@11.0.9`; all `glob` copies resolved to `node_modules/glob@14.0.6`. No vulnerable `minimatch@10.x` or `glob@13.x` copies remain.
- `npm audit`: **found 0 vulnerabilities** — both the minimatch (GHSA-g3hv-75wg-m249) and glob (GHSA-3g3m-2fjr-6pw4) advisories are cleared.
- `npm run compile` and `npm run lint`: pass after the shared lifecycle integration was corrected; lint has only pre-existing unrelated warnings.
- `npm test`: final run passes all 465 tests. Earlier failures during concurrent lifecycle refactoring were fixed; they were not a lasting dependency-migration blocker.

## Recommended Action

- Keep the scoped overrides: `"minimatch": "^11.0.5"`, `"mocha": {"glob": "^14.0.6"}`, `"test-exclude": {"glob": "^14.0.6"}`. This is runtime-safe (compile + lint pass), removes all vulnerable `minimatch@10.x` and `glob@13.x` copies, and clears both npm audit advisories.
- The glob@14 migration is a breaking rewrite of the glob package; mocha@12.0.3 / test-exclude@8.0.0 (latest) still require `glob@^13`, so the nested overrides are required to redirect their transitive `glob` copies to `@14`. No newer upstream release of mocha/test-exclude uses `glob@14` natively.

## Technical Details

- `package.json` — development toolchain dependency versions (mocha ^12.0.3, c8 ^12.0.0, glob ^14.0.6; test-exclude is transitive via mocha/c8); overrides include `minimatch ^11.0.5`, `mocha.glob ^14.0.6`, `test-exclude.glob ^14.0.6` (plus pre-existing hono/@hono/node-server overrides).
- `package-lock.json` — resolved Mocha, c8, test-exclude, glob, and minimatch versions: `glob@14.0.6` (top-level), `minimatch@11.0.9` (root). No vulnerable nested copies remain. Targeted changes only (minimatch/glob-related entries).

## Resources

- [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)
- [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)

## Acceptance Criteria

- [x] Remove vulnerable `minimatch@10.x` copies safely (via scoped `overrides.minimatch` to 11.x); verified no vulnerable minimatch copies remain.
- [x] Remove vulnerable `glob@13.x` copies safely (via scoped nested overrides to `glob@14.0.6`); verified no vulnerable glob copies remain.
- [x] Confirm `npm audit` no longer reports the minimatch and glob advisories — **found 0 vulnerabilities**.
- [x] Run compile and lint successfully — compile pass, lint pass.
- [x] Full test suite run — `npm test`: 465 passing, 0 failing.
- [x] Verify production dependencies and supported Node versions remain compatible — overrides affect dev-only Mocha/glob/test-exclude dependencies; CI uses Node 24 and the local runtime was Node 22.23.1.

## Resume Context

**Current state:** Scoped overrides are applied and validated: all glob copies are `14.0.6`, all minimatch copies are `11.0.9`, `npm audit` reports zero vulnerabilities, and all 465 tests pass.

**Next step:** None; both advisories are cleared and the full validation suite passes.

## Work Log

### 2026-11-23 - Test toolchain migration to patched minimatch/glob

**By:** Kilo

**Actions:**

- Verified via `npm view` that mocha@12.0.3, c8@12.0.0, and test-exclude@8.0.0 are the latest releases and all still depend on `glob@^13` / `minimatch@^10.2.2`; no compatible upstream release resolves `glob@14` / `minimatch>=11` natively.
- Ran a bounded compatibility experiment: `"minimatch": "^11.0.5"` override cleared the minimatch advisory (5 → 4 vulnerabilities) but the glob advisory remained (glob@13.0.7 itself vulnerable). Tests passed (463 passing).
- Performed clean reinstall with scoped overrides: `"minimatch": "^11.0.5"`, `"mocha": {"glob": "^14.0.6"}`, `"test-exclude": {"glob": "^14.0.6"}`.
- Confirmed all `minimatch` copies resolved to `11.0.9` and all `glob` copies to `14.0.6`; no vulnerable nested copies remain.
- `npm audit`: **found 0 vulnerabilities** — both advisories cleared.
- `npm run compile`: pass. `npm run lint`: pass (warnings only).
- At this point, `npm test` was temporarily failing due to lifecycle integration changes in the same working tree; the broad `allowJs` setting and installed-canvas fixture were corrected afterward.

**Learnings:**

- A minimatch-only override clears the minimatch advisory but not the glob advisory, because glob@13.0.7 is itself vulnerable (GHSA-3g3m-2fjr-6pw4 covers glob 9.0.0–14.0.1).
- The glob@14 migration requires nested overrides because mocha/test-exclude (latest) still pin `glob@^13`; no newer upstream release uses `glob@14` natively.
- Full remediation required scoped nested overrides to redirect transitive `glob` copies to `@14`, combined with the `minimatch@11` override.

### 2026-11-24 - Verify dependency migration and complete todo

**By:** Kilo

**Actions:**

- Re-ran `npm test`: 465 passing, zero failing; compile and lint stages succeeded.
- Re-ran `npm audit`: found 0 vulnerabilities.
- Verified with `npm ls glob minimatch mocha test-exclude` that Mocha and test-exclude resolve to `glob@14.0.6` and `minimatch@11.0.9`, with no vulnerable 10.x/13.x copies.
- Verified compatibility context: local Node `v22.23.1`, CI workflow Node 24; the overrides apply to development/test dependencies only.

**Learnings:**

- A clean audit alone did not establish the upgrade was compatible; running the full suite against the overridden glob 14 graph verified the test toolchain behavior.
