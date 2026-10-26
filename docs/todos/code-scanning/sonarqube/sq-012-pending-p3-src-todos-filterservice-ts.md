---
status: pending
priority: p3
issue_id: "sq-012"
tags: [code-scanning, sonarqube]
dependencies: []
scan_identity: 77034d43b887e2d440012cd47bd6369d685aa5cdff60ef1137a3b27465449211
scan_source: sonarqube
scan_scope: "https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351"
scan_grouping: file
scan_target: "src/todos/filterService.ts"
scan_refreshed_at: "2026-10-26T22:08:57.489Z"
scan_review_required: false
---

# SonarQube: src/todos/filterService.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-10-26T22:08:57.489Z

**Branch:** Default branch

1 reported; 0 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/todos/filterService.ts | Line: 121

**Rule:** typescript:S7765

**Problem:** Use \`.includes()\` instead of \`.some()\` when checking value existence.

**Severity:** MINOR

[View finding f13a4353-a1f3-452d-b33e-664b81e13a32](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=f13a4353-a1f3-452d-b33e-664b81e13a32>)

### Rule: Existence checks should use ".includes()" instead of ".indexOf()" or ".lastIndexOf()"

**Rule ID:** typescript:S7765

#### Overview

This rule raises an issue when `.indexOf()` or `.lastIndexOf()` are used with comparison operators to check element existence, or when `Array#some()` is used for simple equality checks that could be replaced with `.includes()`.

#### Why is this an issue?

Using `.indexOf()` or `.lastIndexOf()` with comparison operators like `!== -1` or `>= 0` to check if an element exists is less readable and semantic than using `.includes()`. The intent is not immediately clear - you need to understand that `-1` means "not found" and remember the comparison logic.

The `.includes()` method was specifically designed for existence checks. It clearly expresses the intent: "does this array/string include this element?" This makes code more readable and self-documenting.

Similarly, using `Array#some()` for simple equality checks is overkill. The `some()` method is designed for complex conditions and predicates. When you only need to check if an element exists, `.includes()` is more appropriate and can be more performant since it doesn’t need to execute a callback function.

Using the right method for the right purpose makes code more maintainable and easier to understand for other developers.

##### What is the potential impact?

This issue affects code readability and maintainability. While it doesn’t cause runtime errors, it makes code harder to understand and review. Using inappropriate methods can also have minor performance implications, as `.indexOf()` returns an index that gets discarded, and `Array#some()` executes callback functions unnecessarily.

##### How to fix?

Replace `.indexOf()` comparisons with `.includes()`. Instead of checking if the index is not -1 or greater than -1, directly use `.includes()` to check existence.

##### Non-compliant code example

```
if (array.indexOf('foo') !== -1) { // Noncompliant
  // element found
}

if (string.lastIndexOf('bar') >= 0) { // Noncompliant
  // element found
}
```

##### Compliant code example

```
if (array.includes('foo')) {
  // element found
}

if (string.includes('bar')) {
  // element found
}
```

##### Documentation

*   [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn#readme) - Rule [prefer-includes](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/HEAD/docs/rules/prefer-includes.md)
*   MDN - Array.prototype.includes() - [Official documentation for the Array includes() method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes)
*   MDN - String.prototype.includes() - [Official documentation for the String includes() method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes)
*   MDN - Array.prototype.some() - [Official documentation for the Array some() method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some)

<!-- agendo:scan-snapshot
{"source":"sonarqube","scope":"https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351","grouping":"file","target":"src/todos/filterService.ts","version":1,"retrievedAt":"2026-10-26T22:08:57.489Z","findings":[{"id":"f13a4353-a1f3-452d-b33e-664b81e13a32","rule":"typescript:S7765","severity":"MINOR","message":"Use `.includes()` instead of `.some()` when checking value existence.","path":"src/todos/filterService.ts","line":121,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=f13a4353-a1f3-452d-b33e-664b81e13a32","returned":true}],"rules":[{"id":"typescript:S7765","title":"Existence checks should use \".includes()\" instead of \".indexOf()\" or \".lastIndexOf()\"","description":"#### Overview\n\nThis rule raises an issue when `.indexOf()` or `.lastIndexOf()` are used with comparison operators to check element existence, or when `Array#some()` is used for simple equality checks that could be replaced with `.includes()`.\n\n#### Why is this an issue?\n\nUsing `.indexOf()` or `.lastIndexOf()` with comparison operators like `!== -1` or `>= 0` to check if an element exists is less readable and semantic than using `.includes()`. The intent is not immediately clear - you need to understand that `-1` means \"not found\" and remember the comparison logic.\n\nThe `.includes()` method was specifically designed for existence checks. It clearly expresses the intent: \"does this array/string include this element?\" This makes code more readable and self-documenting.\n\nSimilarly, using `Array#some()` for simple equality checks is overkill. The `some()` method is designed for complex conditions and predicates. When you only need to check if an element exists, `.includes()` is more appropriate and can be more performant since it doesn’t need to execute a callback function.\n\nUsing the right method for the right purpose makes code more maintainable and easier to understand for other developers.\n\n##### What is the potential impact?\n\nThis issue affects code readability and maintainability. While it doesn’t cause runtime errors, it makes code harder to understand and review. Using inappropriate methods can also have minor performance implications, as `.indexOf()` returns an index that gets discarded, and `Array#some()` executes callback functions unnecessarily.\n\n##### How to fix?\n\nReplace `.indexOf()` comparisons with `.includes()`. Instead of checking if the index is not -1 or greater than -1, directly use `.includes()` to check existence.\n\n##### Non-compliant code example\n\n```\nif (array.indexOf('foo') !== -1) { // Noncompliant\n  // element found\n}\n\nif (string.lastIndexOf('bar') >= 0) { // Noncompliant\n  // element found\n}\n```\n\n##### Compliant code example\n\n```\nif (array.includes('foo')) {\n  // element found\n}\n\nif (string.includes('bar')) {\n  // element found\n}\n```\n\n##### Documentation\n\n*   [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn#readme) - Rule [prefer-includes](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/HEAD/docs/rules/prefer-includes.md)\n*   MDN - Array.prototype.includes() - [Official documentation for the Array includes() method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes)\n*   MDN - String.prototype.includes() - [Official documentation for the String includes() method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes)\n*   MDN - Array.prototype.some() - [Official documentation for the Array some() method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some)"}]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

### Findings

- [ ] [f13a4353-a1f3-452d-b33e-664b81e13a32] `typescript:S7765` — Use \`.includes()\` instead of \`.some()\` when checking value existence. (src/todos/filterService.ts:121)

### End Findings


- [ ] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Work Log
