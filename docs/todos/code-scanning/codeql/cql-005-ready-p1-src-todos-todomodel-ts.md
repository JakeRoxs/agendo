---
status: ready
priority: p1
issue_id: "cql-005"
tags: [code-scanning, codeql]
dependencies: []
scan_identity: 2318c364df7011dd2a175da426c509579f4ce91b019c24369ca062ccc7a7b561
scan_source: codeql
scan_scope: "JakeRoxs/agendo"
scan_grouping: file
scan_target: "src/todos/todoModel.ts"
scan_refreshed_at: "2026-10-27T15:42:39.648Z"
scan_review_required: false
---

# src/todos/todoModel.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-10-27T15:42:39.648Z

**Branch:** Default branch

2 reported; 0 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/todos/todoModel.ts | Line: 122

**Rule:** js/incomplete-sanitization

**Problem:** This replaces only the first occurrence of "\\r".

**Severity:** high

[View finding 1](<https://github.com/JakeRoxs/agendo/security/code-scanning/1>)

#### File: src/todos/todoModel.ts | Line: 180

**Rule:** js/incomplete-sanitization

**Problem:** This replaces only the first occurrence of "\\r".

**Severity:** high

[View finding 2](<https://github.com/JakeRoxs/agendo/security/code-scanning/2>)

<!-- agendo:scan-snapshot
{"source":"codeql","scope":"JakeRoxs/agendo","grouping":"file","target":"src/todos/todoModel.ts","version":1,"retrievedAt":"2026-10-27T15:42:39.648Z","findings":[{"id":"1","rule":"js/incomplete-sanitization","severity":"high","message":"This replaces only the first occurrence of \"\\r\".","path":"src/todos/todoModel.ts","line":122,"url":"https://github.com/JakeRoxs/agendo/security/code-scanning/1","resolved":true,"returned":true},{"id":"2","rule":"js/incomplete-sanitization","severity":"high","message":"This replaces only the first occurrence of \"\\r\".","path":"src/todos/todoModel.ts","line":180,"url":"https://github.com/JakeRoxs/agendo/security/code-scanning/2","resolved":true,"returned":true}],"rules":[]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

### Findings

- [x] [1] `js/incomplete-sanitization` — Existing global replacement in `splitFrontmatter()` verified with a multi-line CRLF regression test; imported finding explicitly resolved
- [x] [2] `js/incomplete-sanitization` — Existing global replacement in `parseFrontmatter()` verified with repeated carriage returns per line; imported finding explicitly resolved

### End Findings


- [x] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan
- [x] Add regression tests for both global carriage-return replacements in `src/test/todoModel.test.ts`

## Findings

- Both imported findings are explicitly marked `resolved: true`; this is existing scanner evidence, not a new analysis of this session
- `splitFrontmatter()` and `parseFrontmatter()` already use global `/\r/g` replacements in `src/todos/todoModel.ts`; no production change is needed
- Dedicated regression coverage for repeated carriage returns was missing

### Related File Work

- `src/test/todoModel.test.ts` — Cover CRLF document normalization and repeated carriage returns within individual frontmatter lines

## Resume Context

**Current state:** Both existing fixes are covered by passing regression tests; final integrated compile, lint, and 404 extension tests pass. Imported findings are explicitly resolved, but no new scan of this test revision has run.

**Next step:** Confirm a fresh CodeQL analysis of the tested revision before completing the todo.

## Work Log

### 2026-10-27 - Verify existing fix and add regression coverage

- Preserved the existing production implementation and imported scanner evidence
- Added tests designed to fail if either global replacement regresses to first-occurrence-only removal
- Validation: `npm test` — TypeScript compile and Biome lint passed; all 401 extension tests passed
- Final integrated validation after settings-service changes: `npm test` — compile, lint, and all 404 extension tests passed
- Moved to ready without claiming a new scanner analysis or changing the imported evidence
