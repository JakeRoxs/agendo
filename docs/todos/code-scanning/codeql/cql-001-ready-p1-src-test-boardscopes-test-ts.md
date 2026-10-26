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
scan_refreshed_at: "2026-10-26T08:44:06.815Z"
scan_review_required: false
---

# CodeQL: src/test/boardScopes.test.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-10-26T08:44:06.815Z

1 reported; 0 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/test/boardScopes.test.ts | Line: 364

**Rule:** js/bad-tag-filter

**Problem:** This regular expression does not match upper case \<SCRIPT\> tags.

**Severity:** high

[View finding 3](<https://github.com/JakeRoxs/agendo/security/code-scanning/3>)

<!-- agendo:scan-snapshot
{"source":"codeql","scope":"JakeRoxs/agendo","grouping":"file","target":"src/test/boardScopes.test.ts","version":1,"retrievedAt":"2026-10-26T08:44:06.815Z","findings":[{"id":"3","rule":"js/bad-tag-filter","severity":"high","message":"This regular expression does not match upper case \u003cSCRIPT> tags.","path":"src/test/boardScopes.test.ts","line":364,"url":"https://github.com/JakeRoxs/agendo/security/code-scanning/3","returned":true}],"rules":[]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

### Findings

- [x] [3] `js/bad-tag-filter` — This regular expression does not match upper case \<SCRIPT\> tags. (src/test/boardScopes.test.ts:364)

### End Findings


- [x] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Work Log

### 2026-10-26 - Fix case-sensitive script extraction

**By:** Kilo

**Actions:**

- Made the board test helper's script-tag extraction case-insensitive and added an uppercase `<SCRIPT>` regression test.
- Ran `npm run test:coverage`; compile and lint passed, and all 315 tests passed.
- No new CodeQL scan was run; leave the scan verification criterion open.

**Learnings:**

- The reported regex is test-only HTML extraction, not a production sanitizer.
