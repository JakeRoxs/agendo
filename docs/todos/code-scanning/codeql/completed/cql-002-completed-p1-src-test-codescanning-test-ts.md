---
status: complete
priority: p1
issue_id: "cql-002"
tags: [code-scanning, codeql]
dependencies: []
scan_identity: 16a15d27151cd916776d094779e703d671b3efadfb295f202484b4df6a12db74
scan_source: codeql
scan_scope: "JakeRoxs/agendo"
scan_grouping: file
scan_target: "src/test/codeScanning.test.ts"
scan_refreshed_at: "2026-10-27T16:34:59.276Z"
scan_review_required: true
---

# CodeQL: src/test/codeScanning.test.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-10-27T16:34:59.276Z

**Branch:** Default branch

1 reported; 0 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/test/codeScanning.test.ts | Line: 1319

**Rule:** js/bad-tag-filter

**Problem:** This regular expression does not match upper case \<SCRIPT\> tags.

**Severity:** high

[View finding 6](<https://github.com/JakeRoxs/agendo/security/code-scanning/6>)

<!-- agendo:scan-snapshot
{"source":"codeql","scope":"JakeRoxs/agendo","grouping":"file","target":"src/test/codeScanning.test.ts","version":1,"retrievedAt":"2026-10-27T16:34:59.276Z","findings":[{"id":"6","rule":"js/bad-tag-filter","severity":"high","message":"This regular expression does not match upper case \u003cSCRIPT> tags.","path":"src/test/codeScanning.test.ts","line":1319,"url":"https://github.com/JakeRoxs/agendo/security/code-scanning/6","resolved":true,"returned":true}],"rules":[]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

### Findings

- [ ] [6] `js/bad-tag-filter` — This regular expression does not match upper case \<SCRIPT\> tags. (src/test/codeScanning.test.ts:1319)

### End Findings





- [ ] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Work Log
