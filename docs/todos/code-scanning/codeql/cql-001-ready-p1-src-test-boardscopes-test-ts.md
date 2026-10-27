---
status: ready
priority: p1
issue_id: "cql-001"
tags: [code-scanning, codeql]
dependencies: []
scan_identity: 73f69630a0168ff8dc9d17e05de5a11a78108b137d0cc63083f4a062ec74ee6e
scan_source: codeql
scan_scope: "JakeRoxs/agendo"
scan_grouping: file
scan_target: "src/test/boardScopes.test.ts"
scan_refreshed_at: "2026-10-27T16:34:59.276Z"
scan_review_required: true
---

# CodeQL: src/test/boardScopes.test.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-10-27T16:34:59.276Z

**Branch:** Default branch

3 reported; 0 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/test/boardScopes.test.ts | Line: 364

**Rule:** js/bad-tag-filter

**Problem:** This regular expression does not match upper case \<SCRIPT\> tags.

**Severity:** high

[View finding 3](<https://github.com/JakeRoxs/agendo/security/code-scanning/3>)

#### File: src/test/boardScopes.test.ts | Line: 38

**Rule:** js/bad-tag-filter

**Problem:** This regular expression does not match script end tags like \</script \>.

**Severity:** high

[View finding 4](<https://github.com/JakeRoxs/agendo/security/code-scanning/4>)

#### File: src/test/boardScopes.test.ts | Line: 38

**Rule:** js/bad-tag-filter

**Problem:** This regular expression does not match script end tags like \</script\\t\\n bar\>.

**Severity:** high

[View finding 8](<https://github.com/JakeRoxs/agendo/security/code-scanning/8>)

<!-- agendo:scan-snapshot
{"source":"codeql","scope":"JakeRoxs/agendo","grouping":"file","target":"src/test/boardScopes.test.ts","version":1,"retrievedAt":"2026-10-27T16:34:59.276Z","findings":[{"id":"3","rule":"js/bad-tag-filter","severity":"high","message":"This regular expression does not match upper case \u003cSCRIPT> tags.","path":"src/test/boardScopes.test.ts","line":364,"url":"https://github.com/JakeRoxs/agendo/security/code-scanning/3","resolved":true,"returned":true},{"id":"4","rule":"js/bad-tag-filter","severity":"high","message":"This regular expression does not match script end tags like \u003c/script >.","path":"src/test/boardScopes.test.ts","line":38,"url":"https://github.com/JakeRoxs/agendo/security/code-scanning/4","resolved":true,"returned":true},{"id":"8","rule":"js/bad-tag-filter","severity":"high","message":"This regular expression does not match script end tags like \u003c/script\\t\\n bar>.","path":"src/test/boardScopes.test.ts","line":38,"url":"https://github.com/JakeRoxs/agendo/security/code-scanning/8","resolved":false,"returned":true}],"rules":[]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

### Findings

- [x] [3] `js/bad-tag-filter` — This regular expression does not match upper case \<SCRIPT\> tags. (src/test/boardScopes.test.ts:364)
- [x] [4] `js/bad-tag-filter` — This regular expression does not match script end tags like \</script \>. (src/test/boardScopes.test.ts:38)
- [x] [8] `js/bad-tag-filter` — This regular expression does not match script end tags like \</script\\t\\n bar\>. (src/test/boardScopes.test.ts:38)

### End Findings





- [x] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Related File Work

- `src/test/extractScript.ts` — Shared extraction helper for generated test HTML; not a production sanitizer or general-purpose HTML parser

## Resume Context

**Current state:** Replaced the flagged tag-extraction regex with a shared tag scanner and verified all 414 extension tests. Finding 8 is locally addressed, not remotely confirmed resolved.

**Next step:** Run a fresh CodeQL analysis of this revision and refresh finding 8 before completing.

## Work Log

### 2026-10-26 - Fix case-sensitive script extraction

**By:** Kilo

**Actions:**

- Made the board test helper's script-tag extraction case-insensitive and added an uppercase `<SCRIPT>` regression test.
- Ran `npm run test:coverage`; compile and lint passed, and all 315 tests passed.
- No new CodeQL scan was run; leave the scan verification criterion open.

**Learnings:**

- The reported regex is test-only HTML extraction, not a production sanitizer.

### 2026-10-26 - Fix script end tag matching

**By:** Copilot

**Actions:**

- Updated `extractScript` regex at src/test/boardScopes.test.ts:38 to match `<\/script\s*>` instead of `<\/script>` to handle trailing whitespace in script end tags.
- Ran `npm run test`; all 323 tests pass.
- CodeQL alert 4 will close on next scan run.

**Learnings:**

- The regex fix for uppercase tags (alert 3) and end-tag whitespace (alert 4) are both in the same `extractScript` helper.

### 2026-10-27 - Replace regex extraction with robust parser

**By:** Kilo

**Actions:**

- Replaced the regex-based `extractScript` helper in src/test/boardScopes.test.ts with a robust, regex-free parser that matches script tags case-insensitively, allows attributes on the opening tag, and tolerates whitespace and any content between `</script` and the closing `>` (e.g. `</script\t\n bar>`).
- Added regression tests covering uppercase tags, `</script >`, `</script\t\n bar>`, script tags with attributes, and the no-script-tag case.
- Ran `npm run compile` and `npm run lint`; both pass.
- Finding 8 is locally addressed by the extraction change; leave the scan verification criterion open until a fresh CodeQL scan confirms

**Learnings:**

- The reported regex is test-only HTML extraction, not a production sanitizer.
- A DOM-free parser is sufficient for these trusted test templates and avoids the bypassable-regex pattern entirely.

### 2026-10-27 - Integration review

- Hardened the shared helper to skip repeated lookalike tag names, recognize HTML tag-name delimiters, and ignore quoted attribute `>` characters
- Limited case folding to ASCII letters to preserve source offsets after Unicode characters such as U+0130; the helper no longer uses a regex to extract tags
- Added regressions for lookalike opening/closing tags, missing closing delimiters, Unicode offsets, quoted attributes, and first-script selection
- Preserved the project's ES2020 library compatibility
- `npm test` passed compile, Biome lint, and all 414 real extension-host tests; focused SonarQube TEST analysis of the shared helper returned zero issues (not CodeQL clearance)
- `npm run test:canvas` also passed all 287 tests; no local `codeql` executable was found, so fresh CodeQL confirmation remains a CI/project-scan gate
