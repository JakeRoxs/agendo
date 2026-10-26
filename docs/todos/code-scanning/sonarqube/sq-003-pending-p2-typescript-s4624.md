---
status: pending
priority: p2
issue_id: "sq-003"
tags: [code-scanning, sonarqube]
group: SonarQube
dependencies: []
scan_identity: 1db0ea1286117727ef4cdd014f82152c17364120599503baee9c30f3db5a46e1
scan_source: sonarqube
---

# SonarQube: typescript:S4624

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

### Affected Locations

#### File: src/extension.ts | Line: 103

**Problem:** Refactor this code to not use nested template literals.

**Severity:** MAJOR

[View finding 517131c4-82cd-4ab9-beb5-fe92d9738fe1](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=517131c4-82cd-4ab9-beb5-fe92d9738fe1>)

#### File: src/todos/codeScanningService.ts | Line: 150

**Problem:** Refactor this code to not use nested template literals.

**Severity:** MAJOR

[View finding 8b677ad1-98e7-42fe-afc3-7b9dad5ec9cd](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=8b677ad1-98e7-42fe-afc3-7b9dad5ec9cd>)

#### File: src/todos/codeScanningService.ts | Line: 52

**Problem:** Refactor this code to not use nested template literals.

**Severity:** MAJOR

[View finding 8c0a6f5e-8f09-4c2e-af8a-b95d439d82d7](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=8c0a6f5e-8f09-4c2e-af8a-b95d439d82d7>)

#### File: src/todos/todoCollisions.ts | Line: 26

**Problem:** Refactor this code to not use nested template literals.

**Severity:** MAJOR

[View finding ce416410-1afa-4069-ba48-634b6ba5c97e](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=ce416410-1afa-4069-ba48-634b6ba5c97e>)

### Rule: Template literals should not be nested

#### Why is this an issue?

Template literals, also known as template strings, allow for string interpolation and multiline strings in JavaScript. They provide a more convenient and flexible way to work with strings compared to traditional string concatenation or manipulation.

Template literals are delimited with the backtick ``(`)`` character. They are a convenient way to include variables or expressions within a string using placeholders `` `${expression}` `` in the string and evaluate them dynamically.

However, nesting template literals can make the code less readable. With each nested template literal, the code becomes more complex and harder to understand. It can be challenging to keep track of the opening and closing backticks and properly escape characters if needed.

```
const color = "red";
const count = 3;
const message = `I have ${color ? `${count} ${color}` : count} apples`; // Noncompliant: nested template strings not easy to read
```

In such situations, moving the nested template into a separate statement is preferable.

```
const color = "red";
const count = 3;
const apples = color ? `${count} ${color}` : count;
const message = `I have ${apples} apples`;
```

The rule makes an exception for nested template literals spanning multiple lines. It allows you to visually separate different sections and gives you more freedom in formatting your text, including line breaks, indentation, and other formatting elements, enhancing readability.

```
const name = 'John';
const age = 42;

const message = `Hello ${name}!
You are ${age} years old.
${`This is a nested template literal.`}
It can span multiple lines.`;
```

#### References

##### Documentation

*   MDN web docs - [Template literals (Template strings)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

- [ ] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Work Log
