---
status: pending
priority: p3
issue_id: "sq-004"
tags: [code-scanning, sonarqube]
group: SonarQube
dependencies: []
scan_identity: a9e06df2b3d075ce6a5fc1134c08dc8f919c87947dd81faa41cb02eed023df8c
scan_source: sonarqube
---

# SonarQube: typescript:S7765

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

### Affected Locations

#### File: src/todos/filterService.ts | Line: 122

**Problem:** Use \`.includes()\` instead of \`.some()\` when checking value existence.

**Severity:** MINOR

[View finding f13a4353-a1f3-452d-b33e-664b81e13a32](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=f13a4353-a1f3-452d-b33e-664b81e13a32>)

### Rule: Existence checks should use ".includes()" instead of ".indexOf()" or ".lastIndexOf()"

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
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

- [ ] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Work Log
