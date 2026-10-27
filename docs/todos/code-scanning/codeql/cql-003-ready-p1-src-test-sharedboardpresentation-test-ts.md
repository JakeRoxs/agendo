---
status: ready
priority: p1
issue_id: "cql-003"
tags: [code-scanning, codeql]
dependencies: []
scan_identity: 02e670a3c83ed0cf8e7fb2f01cab88d1910d547584c4eedd6fa93452bc8de470
scan_source: codeql
scan_scope: "JakeRoxs/agendo"
scan_grouping: file
scan_target: "src/test/sharedBoardPresentation.test.ts"
scan_refreshed_at: "2026-10-27T16:34:59.276Z"
scan_review_required: true
---

# CodeQL: src/test/sharedBoardPresentation.test.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-10-27T16:34:59.276Z

**Branch:** Default branch

3 reported; 0 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/test/sharedBoardPresentation.test.ts | Line: 41

**Rule:** js/bad-tag-filter

**Problem:** This regular expression does not match upper case \<SCRIPT\> tags.

**Severity:** high

[View finding 5](<https://github.com/JakeRoxs/agendo/security/code-scanning/5>)

#### File: src/test/sharedBoardPresentation.test.ts | Line: 41

**Rule:** js/bad-tag-filter

**Problem:** This regular expression does not match script end tags like \</script \>.

**Severity:** high

[View finding 7](<https://github.com/JakeRoxs/agendo/security/code-scanning/7>)

#### File: src/test/sharedBoardPresentation.test.ts | Line: 41

**Rule:** js/bad-tag-filter

**Problem:** This regular expression does not match script end tags like \</script\\t\\n bar\>.

**Severity:** high

[View finding 9](<https://github.com/JakeRoxs/agendo/security/code-scanning/9>)

<!-- agendo:scan-snapshot
{"source":"codeql","scope":"JakeRoxs/agendo","grouping":"file","target":"src/test/sharedBoardPresentation.test.ts","version":1,"retrievedAt":"2026-10-27T16:34:59.276Z","findings":[{"id":"5","rule":"js/bad-tag-filter","severity":"high","message":"This regular expression does not match upper case \u003cSCRIPT> tags.","path":"src/test/sharedBoardPresentation.test.ts","line":41,"url":"https://github.com/JakeRoxs/agendo/security/code-scanning/5","resolved":true,"returned":true},{"id":"7","rule":"js/bad-tag-filter","severity":"high","message":"This regular expression does not match script end tags like \u003c/script >.","path":"src/test/sharedBoardPresentation.test.ts","line":41,"url":"https://github.com/JakeRoxs/agendo/security/code-scanning/7","resolved":true,"returned":true},{"id":"9","rule":"js/bad-tag-filter","severity":"high","message":"This regular expression does not match script end tags like \u003c/script\\t\\n bar>.","path":"src/test/sharedBoardPresentation.test.ts","line":41,"url":"https://github.com/JakeRoxs/agendo/security/code-scanning/9","resolved":false,"returned":true}],"rules":[]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

### Findings

- [x] [5] `js/bad-tag-filter` — This regular expression does not match upper case \<SCRIPT\> tags. (src/test/sharedBoardPresentation.test.ts:41)
- [x] [7] `js/bad-tag-filter` — This regular expression does not match script end tags like \</script \>. (src/test/sharedBoardPresentation.test.ts:41)
- [x] [9] `js/bad-tag-filter` — This regular expression does not match script end tags like \</script\\t\\n bar\>. (src/test/sharedBoardPresentation.test.ts:41)

### End Findings





- [x] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Related File Work

- `src/test/extractScript.ts` — Shared extraction helper for generated test HTML; not a production sanitizer or general-purpose HTML parser

## Resume Context

**Current state:** Replaced the flagged tag-extraction regex with the shared tag scanner. All 414 extension tests pass, including empty scripts and the reported malformed end-tag case. Finding 9 is locally addressed, not remotely confirmed resolved.

**Next step:** Run a fresh CodeQL analysis of this revision and refresh finding 9 before completing.

## Work Log

- 2026-10-26: Added `/i` flag to `extractScript` regex at src/test/sharedBoardPresentation.test.ts:41 to match uppercase script tags. Tests pass.
- 2026-10-26: Updated `extractScript` regex to match `<\/script\s*>` instead of `<\/script>` to handle trailing whitespace in script end tags (alert 7). All 323 tests pass. CodeQL alert 7 will close on next scan run.

### 2026-10-27 - Replace regex extraction with robust parser

**By:** Kilo

**Actions:**

- Replaced the regex-based `extractScript` helper in src/test/sharedBoardPresentation.test.ts with a robust, regex-free parser (shared with boardScopes.test.ts via src/test/extractScript.ts) that matches script tags case-insensitively, allows attributes on the opening tag, and tolerates whitespace and any content between `</script` and the closing `>` (e.g. `</script\t\n bar>`).
- Added regression tests covering uppercase tags, `</script >`, `</script\t\n bar>`, and script tags with attributes.
- Ran `npm run compile` and `npm run lint`; both pass.
- Finding 9 is locally addressed by the extraction change; leave the scan verification criterion open until a fresh CodeQL scan confirms

**Learnings:**

- The reported regex is test-only HTML extraction, not a production sanitizer.
- A DOM-free parser is sufficient for these trusted test templates and avoids the bypassable-regex pattern entirely.

### 2026-10-27 - Integration review

- Reviewed the shared helper's tag boundaries, quoted attributes, and Unicode-safe offsets
- Kept empty script blocks valid in this file's assertion wrapper, matching the original helper behavior
- `npm test` passed compile, Biome lint, and all 414 real extension-host tests, including the shared board and CodeQL end-tag regressions
- No new CodeQL analysis has run; scanner-managed evidence and the full-scan gate remain unchanged
- `npm run test:canvas` also passed all 287 tests; no local `codeql` executable was found, so fresh CodeQL confirmation remains a CI/project-scan gate
