---
status: pending
priority: p3
issue_id: "sq-005"
tags: [code-scanning, sonarqube]
group: SonarQube
dependencies: []
scan_identity: 0957344164ee376a360a785e4fbf9a9d103bf7de8ad223de8712ab0589d3939a
scan_source: sonarqube
---

# SonarQube: typescript:S7780

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

### Affected Locations

#### File: src/todos/codeScanningService.ts | Line: 44

**Problem:** \`String.raw\` should be used to avoid escaping \`\\\`.

**Severity:** MINOR

[View finding 5aac3cae-db09-4887-84e9-f168d1817738](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=5aac3cae-db09-4887-84e9-f168d1817738>)

### Rule: String literals with escaped backslashes should use \`String.raw\` template literals

#### Overview

An issue is raised when a string literal contains escaped backslashes (`\\`) that could be simplified using `String.raw` template literals.

#### Why is this an issue?

String literals with escaped backslashes can be difficult to read and maintain. Each backslash character must be escaped with another backslash, creating sequences like `\\` that are hard to interpret at a glance.

This problem is particularly common when working with:

*   File paths on Windows systems
*   Regular expression patterns
*   LaTeX or other markup that uses backslashes
*   Any string content that naturally contains backslash characters

The `String.raw` template literal provides a cleaner alternative. It treats backslashes literally without requiring escaping, making the code more readable and less error-prone. The intent becomes clearer, and there’s less chance of accidentally missing or adding extra backslashes during maintenance.

##### What is the potential impact?

Using escaped backslashes instead of `String.raw` reduces code readability and increases the likelihood of errors when maintaining string literals. While this doesn’t cause runtime issues, it makes the codebase harder to understand and modify correctly.

##### How to fix?

Replace string literals containing escaped backslashes with `String.raw` template literals. The backslashes inside the template literal don’t need to be escaped.

##### Non-compliant code example

```
const filePath = "C:\\Users\\Documents\\file.txt"; // Noncompliant
```

##### Compliant code example

```
const filePath = String.raw`C:\Users\Documents\file.txt`;
```

##### Documentation

*   [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn#readme) - Rule [prefer-string-raw](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/HEAD/docs/rules/prefer-string-raw.md)
*   String.raw - MDN Web Docs - [Official documentation for the String.raw template literal tag](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/raw)
*   Template literals - MDN Web Docs - [Comprehensive guide to template literals in JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

- [ ] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Work Log
