---
status: pending
priority: p2
issue_id: "sq-013"
tags: [code-scanning, sonarqube]
dependencies: []
scan_identity: e1c70a0bd3527cbbca90ce267f3a8c5437dcabebc0f50cd2ade24b26622a0f90
scan_source: sonarqube
scan_scope: "https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351"
scan_grouping: file
scan_target: "src/todos/scanningSnapshot.ts"
scan_refreshed_at: "2026-10-26T22:08:57.489Z"
scan_review_required: false
---

# SonarQube: src/todos/scanningSnapshot.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-10-26T22:08:57.489Z

**Branch:** Default branch

5 reported; 0 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/todos/scanningSnapshot.ts | Line: 68

**Rule:** typescript:S7780

**Problem:** \`String.raw\` should be used to avoid escaping \`\\\`.

**Severity:** MINOR

[View finding 0a17673f-50d3-4195-aa55-eecb4ba361c4](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=0a17673f-50d3-4195-aa55-eecb4ba361c4>)

#### File: src/todos/scanningSnapshot.ts | Line: 163

**Rule:** typescript:S7780

**Problem:** \`String.raw\` should be used to avoid escaping \`\\\`.

**Severity:** MINOR

[View finding 0f39c783-4bd2-4837-b345-9838932a828d](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=0f39c783-4bd2-4837-b345-9838932a828d>)

#### File: src/todos/scanningSnapshot.ts | Line: 209

**Rule:** typescript:S4043

**Problem:** Move this array "sort" operation to a separate statement or replace it with "toSorted".

**Severity:** MAJOR

[View finding 88b14c12-d87d-4d59-9645-9fd01fb7088a](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=88b14c12-d87d-4d59-9645-9fd01fb7088a>)

#### File: src/todos/scanningSnapshot.ts | Line: 38

**Rule:** typescript:S3358

**Problem:** Extract this nested ternary operation into an independent statement.

**Severity:** MAJOR

[View finding ab6ce604-bca3-4e66-95d3-a2f227dee3a5](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=ab6ce604-bca3-4e66-95d3-a2f227dee3a5>)

#### File: src/todos/scanningSnapshot.ts | Line: 35

**Rule:** typescript:S3358

**Problem:** Extract this nested ternary operation into an independent statement.

**Severity:** MAJOR

[View finding f24885ec-af19-426d-b3ca-4e51ff7deb8f](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=f24885ec-af19-426d-b3ca-4e51ff7deb8f>)

### Rule: Ternary operators should not be nested

**Rule ID:** typescript:S3358

#### References

##### Articles & blog posts

*   Sonar - [Stop nesting ternaries in JavaScript](https://www.sonarsource.com/blog/stop-nesting-ternaries-javascript/)

#### Why is this an issue?

Nested ternaries are hard to read and can make the order of operations complex to understand.

```
function getReadableStatus(job) {
  return job.isRunning() ? "Running" : job.hasErrors() ? "Failed" : "Succeeded ";  // Noncompliant
}
```

Instead, use another line to express the nested operation in a separate statement.

```
function getReadableStatus(job) {
  if (job.isRunning()) {
    return "Running";
  }
  return job.hasErrors() ? "Failed" : "Succeeded";
}
```

##### Exceptions

This rule does not apply in JSX expressions to support conditional rendering and conditional attributes as long as the nesting happens in separate JSX expression containers, i.e. JSX elements embedding JavaScript code, as shown below:

```
return (
<>
  {isLoading ? (
    <Loader active />
  ) : (
    <Panel label={isEditing ? 'Open' : 'Not open'}>
      <a>{isEditing ? 'Close now' : 'Start now'}</a>
      <Checkbox onClick={!saving ? setSaving(saving => !saving) : null} />
    </Panel>
  )}
</>
);
```

If you have nested ternaries in the same JSX expression container, refactor your logic into a separate function like that:

```
function myComponent(condition) {
  if (condition < 0) {
    return '<DownSign>it is negative</DownSign>';
  } else if (condition > 0) {
    return '<UpSign>it is positive</UpSign>';
  } else {
    return '<BarSign>it is zero</BarSign>';
  }
}

return (
  {myComponent(foo)}
);
```

### Rule: Array-mutating methods should not be used misleadingly

**Rule ID:** typescript:S4043

#### Why is this an issue?

In JavaScript, some `Array` methods do not mutate the existing array that the method was called on, but instead return a new array. Other methods mutate the array, and their return value differs depending on the method.

`reverse` and `sort` are mutating methods and, in addition, return the altered version. This rule raises an issue when the return values of these methods are assigned, which could lead maintainers to overlook the fact that the original array has been modified.

```
const reversed = a.reverse(); // Noncompliant: mutating method, no need to assign return value
const sorted = b.sort(); // Noncompliant: mutating method, no need to assign return value
```

Remove the assignment, so that the intent of mutating the original array is clear.

```
a.reverse();
b.sort();
```

Or use non-mutating alternatives `toReversed` and `toSorted`.

```
const reversed = a.toReversed();
const sorted = b.toSorted();
```

Alternatively, change a mutating method into a non-mutating alternative using the spread syntax (`…​`).

```
const reversed = [...a].reverse();
const sorted = [...b].sort();
```

Or `slice()` to create a copy first.

```
const reversed = a.slice().reverse();
const sorted = b.slice().sort();
```

#### References

##### Documentation

*   MDN web docs - [Array copying methods and mutating methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#copying_methods_and_mutating_methods)
*   MDN web docs - [Array.prototype.reverse()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reverse)
*   MDN web docs - [Array.prototype.sort()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)
*   MDN web docs - [Array.prototype.toReversed()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toReversed)
*   MDN web docs - [Array.prototype.toSorted()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted)
*   MDN web docs - [Spread syntax (`...`)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax)
*   MDN web docs - [Array.prototype.slice()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/slice)

### Rule: String literals with escaped backslashes should use \`String.raw\` template literals

**Rule ID:** typescript:S7780

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

<!-- agendo:scan-snapshot
{"source":"sonarqube","scope":"https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351","grouping":"file","target":"src/todos/scanningSnapshot.ts","version":1,"retrievedAt":"2026-10-26T22:08:57.489Z","findings":[{"id":"0a17673f-50d3-4195-aa55-eecb4ba361c4","rule":"typescript:S7780","severity":"MINOR","message":"`String.raw` should be used to avoid escaping `\\`.","path":"src/todos/scanningSnapshot.ts","line":68,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=0a17673f-50d3-4195-aa55-eecb4ba361c4","returned":true},{"id":"0f39c783-4bd2-4837-b345-9838932a828d","rule":"typescript:S7780","severity":"MINOR","message":"`String.raw` should be used to avoid escaping `\\`.","path":"src/todos/scanningSnapshot.ts","line":163,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=0f39c783-4bd2-4837-b345-9838932a828d","returned":true},{"id":"88b14c12-d87d-4d59-9645-9fd01fb7088a","rule":"typescript:S4043","severity":"MAJOR","message":"Move this array \"sort\" operation to a separate statement or replace it with \"toSorted\".","path":"src/todos/scanningSnapshot.ts","line":209,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=88b14c12-d87d-4d59-9645-9fd01fb7088a","returned":true},{"id":"ab6ce604-bca3-4e66-95d3-a2f227dee3a5","rule":"typescript:S3358","severity":"MAJOR","message":"Extract this nested ternary operation into an independent statement.","path":"src/todos/scanningSnapshot.ts","line":38,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=ab6ce604-bca3-4e66-95d3-a2f227dee3a5","returned":true},{"id":"f24885ec-af19-426d-b3ca-4e51ff7deb8f","rule":"typescript:S3358","severity":"MAJOR","message":"Extract this nested ternary operation into an independent statement.","path":"src/todos/scanningSnapshot.ts","line":35,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=f24885ec-af19-426d-b3ca-4e51ff7deb8f","returned":true}],"rules":[{"id":"typescript:S3358","title":"Ternary operators should not be nested","description":"#### References\n\n##### Articles & blog posts\n\n*   Sonar - [Stop nesting ternaries in JavaScript](https://www.sonarsource.com/blog/stop-nesting-ternaries-javascript/)\n\n#### Why is this an issue?\n\nNested ternaries are hard to read and can make the order of operations complex to understand.\n\n```\nfunction getReadableStatus(job) {\n  return job.isRunning() ? \"Running\" : job.hasErrors() ? \"Failed\" : \"Succeeded \";  // Noncompliant\n}\n```\n\nInstead, use another line to express the nested operation in a separate statement.\n\n```\nfunction getReadableStatus(job) {\n  if (job.isRunning()) {\n    return \"Running\";\n  }\n  return job.hasErrors() ? \"Failed\" : \"Succeeded\";\n}\n```\n\n##### Exceptions\n\nThis rule does not apply in JSX expressions to support conditional rendering and conditional attributes as long as the nesting happens in separate JSX expression containers, i.e. JSX elements embedding JavaScript code, as shown below:\n\n```\nreturn (\n\u003c>\n  {isLoading ? (\n    \u003cLoader active />\n  ) : (\n    \u003cPanel label={isEditing ? 'Open' : 'Not open'}>\n      \u003ca>{isEditing ? 'Close now' : 'Start now'}\u003c/a>\n      \u003cCheckbox onClick={!saving ? setSaving(saving => !saving) : null} />\n    \u003c/Panel>\n  )}\n\u003c/>\n);\n```\n\nIf you have nested ternaries in the same JSX expression container, refactor your logic into a separate function like that:\n\n```\nfunction myComponent(condition) {\n  if (condition \u003c 0) {\n    return '\u003cDownSign>it is negative\u003c/DownSign>';\n  } else if (condition > 0) {\n    return '\u003cUpSign>it is positive\u003c/UpSign>';\n  } else {\n    return '\u003cBarSign>it is zero\u003c/BarSign>';\n  }\n}\n\nreturn (\n  {myComponent(foo)}\n);\n```"},{"id":"typescript:S4043","title":"Array-mutating methods should not be used misleadingly","description":"#### Why is this an issue?\n\nIn JavaScript, some `Array` methods do not mutate the existing array that the method was called on, but instead return a new array. Other methods mutate the array, and their return value differs depending on the method.\n\n`reverse` and `sort` are mutating methods and, in addition, return the altered version. This rule raises an issue when the return values of these methods are assigned, which could lead maintainers to overlook the fact that the original array has been modified.\n\n```\nconst reversed = a.reverse(); // Noncompliant: mutating method, no need to assign return value\nconst sorted = b.sort(); // Noncompliant: mutating method, no need to assign return value\n```\n\nRemove the assignment, so that the intent of mutating the original array is clear.\n\n```\na.reverse();\nb.sort();\n```\n\nOr use non-mutating alternatives `toReversed` and `toSorted`.\n\n```\nconst reversed = a.toReversed();\nconst sorted = b.toSorted();\n```\n\nAlternatively, change a mutating method into a non-mutating alternative using the spread syntax (`…​`).\n\n```\nconst reversed = [...a].reverse();\nconst sorted = [...b].sort();\n```\n\nOr `slice()` to create a copy first.\n\n```\nconst reversed = a.slice().reverse();\nconst sorted = b.slice().sort();\n```\n\n#### References\n\n##### Documentation\n\n*   MDN web docs - [Array copying methods and mutating methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#copying_methods_and_mutating_methods)\n*   MDN web docs - [Array.prototype.reverse()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reverse)\n*   MDN web docs - [Array.prototype.sort()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)\n*   MDN web docs - [Array.prototype.toReversed()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toReversed)\n*   MDN web docs - [Array.prototype.toSorted()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted)\n*   MDN web docs - [Spread syntax (`...`)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax)\n*   MDN web docs - [Array.prototype.slice()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/slice)"},{"id":"typescript:S7780","title":"String literals with escaped backslashes should use `String.raw` template literals","description":"#### Overview\n\nAn issue is raised when a string literal contains escaped backslashes (`\\\\`) that could be simplified using `String.raw` template literals.\n\n#### Why is this an issue?\n\nString literals with escaped backslashes can be difficult to read and maintain. Each backslash character must be escaped with another backslash, creating sequences like `\\\\` that are hard to interpret at a glance.\n\nThis problem is particularly common when working with:\n\n*   File paths on Windows systems\n*   Regular expression patterns\n*   LaTeX or other markup that uses backslashes\n*   Any string content that naturally contains backslash characters\n\nThe `String.raw` template literal provides a cleaner alternative. It treats backslashes literally without requiring escaping, making the code more readable and less error-prone. The intent becomes clearer, and there’s less chance of accidentally missing or adding extra backslashes during maintenance.\n\n##### What is the potential impact?\n\nUsing escaped backslashes instead of `String.raw` reduces code readability and increases the likelihood of errors when maintaining string literals. While this doesn’t cause runtime issues, it makes the codebase harder to understand and modify correctly.\n\n##### How to fix?\n\nReplace string literals containing escaped backslashes with `String.raw` template literals. The backslashes inside the template literal don’t need to be escaped.\n\n##### Non-compliant code example\n\n```\nconst filePath = \"C:\\\\Users\\\\Documents\\\\file.txt\"; // Noncompliant\n```\n\n##### Compliant code example\n\n```\nconst filePath = String.raw`C:\\Users\\Documents\\file.txt`;\n```\n\n##### Documentation\n\n*   [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn#readme) - Rule [prefer-string-raw](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/HEAD/docs/rules/prefer-string-raw.md)\n*   String.raw - MDN Web Docs - [Official documentation for the String.raw template literal tag](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/raw)\n*   Template literals - MDN Web Docs - [Comprehensive guide to template literals in JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)"}]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

### Findings

- [ ] [0a17673f-50d3-4195-aa55-eecb4ba361c4] `typescript:S7780` — \`String.raw\` should be used to avoid escaping \`\\\`. (src/todos/scanningSnapshot.ts:68)
- [ ] [0f39c783-4bd2-4837-b345-9838932a828d] `typescript:S7780` — \`String.raw\` should be used to avoid escaping \`\\\`. (src/todos/scanningSnapshot.ts:163)
- [ ] [88b14c12-d87d-4d59-9645-9fd01fb7088a] `typescript:S4043` — Move this array "sort" operation to a separate statement or replace it with "toSorted". (src/todos/scanningSnapshot.ts:209)
- [ ] [ab6ce604-bca3-4e66-95d3-a2f227dee3a5] `typescript:S3358` — Extract this nested ternary operation into an independent statement. (src/todos/scanningSnapshot.ts:38)
- [ ] [f24885ec-af19-426d-b3ca-4e51ff7deb8f] `typescript:S3358` — Extract this nested ternary operation into an independent statement. (src/todos/scanningSnapshot.ts:35)

### End Findings


- [ ] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Work Log
