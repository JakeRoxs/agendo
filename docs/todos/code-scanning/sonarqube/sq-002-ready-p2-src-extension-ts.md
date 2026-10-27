---
status: ready
priority: p2
issue_id: "sq-002"
tags: [code-scanning, sonarqube]
dependencies: []
scan_identity: edb008407a843dd7c516f3c66dedae5d61d764787bb58917429e5a5e0426f2b7
scan_source: sonarqube
scan_scope: "https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351"
scan_grouping: file
scan_target: "src/extension.ts"
scan_refreshed_at: "2026-10-27T16:35:51.526Z"
scan_review_required: true
---

# SonarQube: src/extension.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-10-27T16:35:51.526Z

**Branch:** Default branch

2 reported; 0 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/extension.ts | Line: not reported

**Rule:** typescript:S4624

**Problem:** Refactor this code to not use nested template literals.

**Severity:** MAJOR

[View finding 517131c4-82cd-4ab9-beb5-fe92d9738fe1](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=517131c4-82cd-4ab9-beb5-fe92d9738fe1>)

#### File: src/extension.ts | Line: not reported

**Rule:** typescript:S1871

**Problem:** This case's code block is the same as the block for the case on line 107.

**Severity:** MAJOR

[View finding c2a22096-7325-42b2-880d-232d28240756](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=c2a22096-7325-42b2-880d-232d28240756>)

### Rule: Two branches in a conditional structure should not have exactly the same implementation

**Rule ID:** typescript:S1871

#### Why is this an issue?

When the same code is duplicated in two or more separate branches of a conditional, it can make the code harder to understand, maintain, and can potentially introduce bugs if one instance of the code is changed but others are not.

Having two `cases` in a `switch` statement or two branches in an `if` chain with the same implementation is at best duplicate code, and at worst a coding error.

```
if (a >= 0 && a < 10) {
  doFirstThing();
  doTheThing();
}
else if (a >= 10 && a < 20) {
  doTheOtherThing();
}
else if (a >= 20 && a < 50) {
  doFirstThing();
  doTheThing();  // Noncompliant; duplicates first condition
}
else {
  doTheRest();
}
```

```
switch (i) {
  case 1:
    doFirstThing();
    doSomething();
    break;
  case 2:
    doSomethingDifferent();
    break;
  case 3:  // Noncompliant; duplicates case 1's implementation
    doFirstThing();
    doSomething();
    break;
  default:
    doTheRest();
}
```

If the same logic is truly needed for both instances, then:

*   in an `if` chain they should be combined

```
if ((a >= 0 && a < 10) || (a >= 20 && a < 50)) { // Compliant
  doFirstThing();
  doTheThing();
}
else if (a >= 10 && a < 20) {
  doTheOtherThing();
}
else {
  doTheRest();
}
```

*   for a `switch`, one should fall through to the other

```
switch (i) {
  case 1:
  case 3: // Compliant
    doFirstThing();
    doSomething();
    break;
  case 2:
    doSomethingDifferent();
    break;
  default:
    doTheRest();
}
```

When all blocks are identical, either this rule will trigger if there is no default clause or rule [S3923](/coding_rules#rule_key=javascript%3AS3923) will raise if there is a default clause.

##### Exceptions

Unless all blocks are identical, blocks in an `if` chain that contain a single line of code are ignored. The same applies to blocks in a `switch` statement that contains a single line of code with or without a following `break`.

```
if (a == 1) {
  doSomething();  // Compliant, usually this is done on purpose to increase the readability
} else if (a == 2) {
  doSomethingElse();
} else {
  doSomething();
}
```

#### References

##### Related rules

*   [S3923](/coding_rules#rule_key=javascript%3AS3923) - All branches in a conditional structure should not have exactly the same implementation

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
{"source":"sonarqube","scope":"https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351","grouping":"file","target":"src/extension.ts","version":1,"retrievedAt":"2026-10-27T16:35:51.526Z","findings":[{"id":"517131c4-82cd-4ab9-beb5-fe92d9738fe1","rule":"typescript:S4624","severity":"MAJOR","message":"Refactor this code to not use nested template literals.","path":"src/extension.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=517131c4-82cd-4ab9-beb5-fe92d9738fe1","resolved":false,"returned":true},{"id":"c2a22096-7325-42b2-880d-232d28240756","rule":"typescript:S1871","severity":"MAJOR","message":"This case's code block is the same as the block for the case on line 107.","path":"src/extension.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=c2a22096-7325-42b2-880d-232d28240756","resolved":false,"returned":true}],"rules":[{"id":"typescript:S1871","title":"Two branches in a conditional structure should not have exactly the same implementation","description":"#### Why is this an issue?\n\nWhen the same code is duplicated in two or more separate branches of a conditional, it can make the code harder to understand, maintain, and can potentially introduce bugs if one instance of the code is changed but others are not.\n\nHaving two `cases` in a `switch` statement or two branches in an `if` chain with the same implementation is at best duplicate code, and at worst a coding error.\n\n```\nif (a >= 0 && a \u003c 10) {\n  doFirstThing();\n  doTheThing();\n}\nelse if (a >= 10 && a \u003c 20) {\n  doTheOtherThing();\n}\nelse if (a >= 20 && a \u003c 50) {\n  doFirstThing();\n  doTheThing();  // Noncompliant; duplicates first condition\n}\nelse {\n  doTheRest();\n}\n```\n\n```\nswitch (i) {\n  case 1:\n    doFirstThing();\n    doSomething();\n    break;\n  case 2:\n    doSomethingDifferent();\n    break;\n  case 3:  // Noncompliant; duplicates case 1's implementation\n    doFirstThing();\n    doSomething();\n    break;\n  default:\n    doTheRest();\n}\n```\n\nIf the same logic is truly needed for both instances, then:\n\n*   in an `if` chain they should be combined\n\n```\nif ((a >= 0 && a \u003c 10) || (a >= 20 && a \u003c 50)) { // Compliant\n  doFirstThing();\n  doTheThing();\n}\nelse if (a >= 10 && a \u003c 20) {\n  doTheOtherThing();\n}\nelse {\n  doTheRest();\n}\n```\n\n*   for a `switch`, one should fall through to the other\n\n```\nswitch (i) {\n  case 1:\n  case 3: // Compliant\n    doFirstThing();\n    doSomething();\n    break;\n  case 2:\n    doSomethingDifferent();\n    break;\n  default:\n    doTheRest();\n}\n```\n\nWhen all blocks are identical, either this rule will trigger if there is no default clause or rule [S3923](/coding_rules#rule_key=javascript%3AS3923) will raise if there is a default clause.\n\n##### Exceptions\n\nUnless all blocks are identical, blocks in an `if` chain that contain a single line of code are ignored. The same applies to blocks in a `switch` statement that contains a single line of code with or without a following `break`.\n\n```\nif (a == 1) {\n  doSomething();  // Compliant, usually this is done on purpose to increase the readability\n} else if (a == 2) {\n  doSomethingElse();\n} else {\n  doSomething();\n}\n```\n\n#### References\n\n##### Related rules\n\n*   [S3923](/coding_rules#rule_key=javascript%3AS3923) - All branches in a conditional structure should not have exactly the same implementation"},{"id":"typescript:S4624","title":"Template literals should not be nested","description":"#### Why is this an issue?\n\nTemplate literals, also known as template strings, allow for string interpolation and multiline strings in JavaScript. They provide a more convenient and flexible way to work with strings compared to traditional string concatenation or manipulation.\n\nTemplate literals are delimited with the backtick ``(`)`` character. They are a convenient way to include variables or expressions within a string using placeholders `` `${expression}` `` in the string and evaluate them dynamically.\n\nHowever, nesting template literals can make the code less readable. With each nested template literal, the code becomes more complex and harder to understand. It can be challenging to keep track of the opening and closing backticks and properly escape characters if needed.\n\n```\nconst color = \"red\";\nconst count = 3;\nconst message = `I have ${color ? `${count} ${color}` : count} apples`; // Noncompliant: nested template strings not easy to read\n```\n\nIn such situations, moving the nested template into a separate statement is preferable.\n\n```\nconst color = \"red\";\nconst count = 3;\nconst apples = color ? `${count} ${color}` : count;\nconst message = `I have ${apples} apples`;\n```\n\nThe rule makes an exception for nested template literals spanning multiple lines. It allows you to visually separate different sections and gives you more freedom in formatting your text, including line breaks, indentation, and other formatting elements, enhancing readability.\n\n```\nconst name = 'John';\nconst age = 42;\n\nconst message = `Hello ${name}!\nYou are ${age} years old.\n${`This is a nested template literal.`}\nIt can span multiple lines.`;\n```\n\n#### References\n\n##### Documentation\n\n*   MDN web docs - [Template literals (Template strings)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)"}]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

### Findings

- [x] [517131c4-82cd-4ab9-beb5-fe92d9738fe1] `typescript:S4624` — Refactor this code to not use nested template literals. (src/extension.ts)
- [x] [c2a22096-7325-42b2-880d-232d28240756] `typescript:S1871` — This case's code block is the same as the block for the case on line 107. (src/extension.ts)

### End Findings






- [x] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Work Log

### 2026-10-27 - Activation readability cleanup

- Combining identical check-source/install switch branches and separating collision descriptions from the tooltip template
- Preserving command routing, result objects, and collision badge text
- Added settings action-routing assertions in the existing activation regression in `src/test/todoModel.test.ts`; both actions must invoke exactly one matching skill/canvas command and retain their result object
- Fresh SonarQube `analyze_code_snippet` on the complete final production file (`ts`, `MAIN`, project key from `sonar-project.properties`) returned zero issues
- Pre-crash test run compiled and linted successfully; unrelated repository timeout cascaded into activation mock failure, so verification is being repeated after recovery
- Recovered source edits were reviewed after the user-reported unrelated VS Code crash
- Final post-crash `npm test`: compilation and lint pass, 342 tests pass, including activation action routing; the only failure is the unchanged user-owned scanner-title fixture/assertion mismatch in `src/test/codeScanning.test.ts`
- `npm run test:canvas`: 247 pass and one unrelated existing error-message assertion failure; `git diff --check` passes

## Resume Context

**Current state:** Both activation findings are addressed and fresh full-file snippet analysis reports zero issues; settings routing regression assertions are added.

**Next step:** Confirm clearance in a full project SonarQube scan before completion.
