---
status: ready
priority: p2
issue_id: "sq-014"
tags: [code-scanning, sonarqube]
dependencies: []
scan_identity: e71a078d7111e7d8aeb3eda05a187eaed60a804f1f23fa29d49685b9ea422365
scan_source: sonarqube
scan_scope: "https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351"
scan_grouping: file
scan_target: "src/todos/todoCollisions.ts"
scan_refreshed_at: "2026-10-27T02:18:14.795Z"
scan_review_required: true
---

# SonarQube: src/todos/todoCollisions.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-10-27T02:18:14.795Z

**Branch:** Default branch

0 reported; 1 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/todos/todoCollisions.ts | Line: 26

**Rule:** typescript:S4624

**Problem:** Refactor this code to not use nested template literals.

**Severity:** MAJOR

**Observation:** Not returned in the latest successful result; resolution is not verified.

[View finding ce416410-1afa-4069-ba48-634b6ba5c97e](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=ce416410-1afa-4069-ba48-634b6ba5c97e>)

### Rule: Template literals should not be nested

**Rule ID:** typescript:S4624

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

<!-- agendo:scan-snapshot
{"source":"sonarqube","scope":"https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351","grouping":"file","target":"src/todos/todoCollisions.ts","version":1,"retrievedAt":"2026-10-27T02:18:14.795Z","findings":[{"id":"ce416410-1afa-4069-ba48-634b6ba5c97e","rule":"typescript:S4624","severity":"MAJOR","message":"Refactor this code to not use nested template literals.","path":"src/todos/todoCollisions.ts","line":26,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=ce416410-1afa-4069-ba48-634b6ba5c97e","returned":false}],"rules":[{"id":"typescript:S4624","title":"Template literals should not be nested","description":"#### Why is this an issue?\n\nTemplate literals, also known as template strings, allow for string interpolation and multiline strings in JavaScript. They provide a more convenient and flexible way to work with strings compared to traditional string concatenation or manipulation.\n\nTemplate literals are delimited with the backtick ``(`)`` character. They are a convenient way to include variables or expressions within a string using placeholders `` `${expression}` `` in the string and evaluate them dynamically.\n\nHowever, nesting template literals can make the code less readable. With each nested template literal, the code becomes more complex and harder to understand. It can be challenging to keep track of the opening and closing backticks and properly escape characters if needed.\n\n```\nconst color = \"red\";\nconst count = 3;\nconst message = `I have ${color ? `${count} ${color}` : count} apples`; // Noncompliant: nested template strings not easy to read\n```\n\nIn such situations, moving the nested template into a separate statement is preferable.\n\n```\nconst color = \"red\";\nconst count = 3;\nconst apples = color ? `${count} ${color}` : count;\nconst message = `I have ${apples} apples`;\n```\n\nThe rule makes an exception for nested template literals spanning multiple lines. It allows you to visually separate different sections and gives you more freedom in formatting your text, including line breaks, indentation, and other formatting elements, enhancing readability.\n\n```\nconst name = 'John';\nconst age = 42;\n\nconst message = `Hello ${name}!\nYou are ${age} years old.\n${`This is a nested template literal.`}\nIt can span multiple lines.`;\n```\n\n#### References\n\n##### Documentation\n\n*   MDN web docs - [Template literals (Template strings)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)"}]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

### Findings

- [x] [ce416410-1afa-4069-ba48-634b6ba5c97e] `typescript:S4624` — Refactor this code to not use nested template literals. (src/todos/todoCollisions.ts:26)
- [x] [ce416410-1afa-4069-ba48-634b6ba5c97e] `typescript:S4624` — Refactor this code to not use nested template literals. (src/todos/todoCollisions.ts:26) (not returned)

### End Findings



- [x] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Work Log

### 2026-10-27 - Collision detail formatting

- Separating per-file collision descriptions from the surrounding message template
- Adding an exact-output regression for active-root and lifecycle-folder paths in `src/test/todoCollisions.test.ts`
- Fresh SonarQube `analyze_code_snippet` on the complete updated production file (`ts`, `MAIN`, project key from `sonar-project.properties`) returned zero issues
- This related regression test does not complete or reconcile independent findings in the existing scanner todo for `todoCollisions.test.ts`
- Final `npm test`: compilation and lint pass, 342 tests pass, including the exact collision-message regression; one unrelated failure remains in the unchanged user-owned scanner-title fixture/assertion mismatch
- `git diff --check` passes; retained ready pending full-project scan confirmation

## Resume Context

**Current state:** Collision descriptions are formatted separately without nested templates; fresh full-file snippet analysis reports zero issues and an exact-output regression is added.

**Next step:** Confirm clearance in a full project SonarQube scan before completion.
