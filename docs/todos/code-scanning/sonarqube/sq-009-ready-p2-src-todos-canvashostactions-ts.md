---
status: ready
priority: p2
issue_id: "sq-009"
tags: [code-scanning, sonarqube]
dependencies: []
scan_identity: 027efb077485824dc09362bd73d2498e8e611d03c657eefece9a16df37b9b01b
scan_source: sonarqube
scan_scope: "https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351"
scan_grouping: file
scan_target: "src/todos/canvasHostActions.ts"
scan_refreshed_at: "2026-10-27T05:16:51.141Z"
scan_review_required: true
---

# SonarQube: src/todos/canvasHostActions.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-10-27T05:16:51.141Z

**Branch:** Default branch

7 reported; 0 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/todos/canvasHostActions.ts | Line: not reported

**Rule:** typescript:S7721

**Problem:** Move function 'validateStatus' to the outer scope.

**Severity:** MAJOR

[View finding 2ecb38fe-1ed3-4dd9-9d65-9fa894c5bd87](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=2ecb38fe-1ed3-4dd9-9d65-9fa894c5bd87>)

#### File: src/todos/canvasHostActions.ts | Line: not reported

**Rule:** typescript:S7721

**Problem:** Move function 'validatePriority' to the outer scope.

**Severity:** MAJOR

[View finding 320142f3-66fd-4a95-8ddf-828ce1252608](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=320142f3-66fd-4a95-8ddf-828ce1252608>)

#### File: src/todos/canvasHostActions.ts | Line: not reported

**Rule:** typescript:S7721

**Problem:** Move function 'assertIdValid' to the outer scope.

**Severity:** MAJOR

[View finding 77df78ff-f2c0-4b02-a414-d9ca9b6880c6](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=77df78ff-f2c0-4b02-a414-d9ca9b6880c6>)

#### File: src/todos/canvasHostActions.ts | Line: not reported

**Rule:** typescript:S7721

**Problem:** Move function 'assertWritable' to the outer scope.

**Severity:** MAJOR

[View finding 8abf0ece-fa58-4d7a-bd6b-1d0a7f940d1a](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=8abf0ece-fa58-4d7a-bd6b-1d0a7f940d1a>)

#### File: src/todos/canvasHostActions.ts | Line: not reported

**Rule:** typescript:S7721

**Problem:** Move function 'assertTrusted' to the outer scope.

**Severity:** MAJOR

[View finding dc255985-c1fd-45a5-83cb-7b75a629d397](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=dc255985-c1fd-45a5-83cb-7b75a629d397>)

#### File: src/todos/canvasHostActions.ts | Line: not reported

**Rule:** typescript:S7721

**Problem:** Move function 'validateGroup' to the outer scope.

**Severity:** MAJOR

[View finding df71231c-dd63-4111-bab5-41d80783b76b](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=df71231c-dd63-4111-bab5-41d80783b76b>)

#### File: src/todos/canvasHostActions.ts | Line: not reported

**Rule:** typescript:S7786

**Problem:** \`new Error()\` is too unspecific for a type check. Use \`new TypeError()\` instead.

**Severity:** MINOR

[View finding f215f967-bb30-44e6-baa1-d332eded1587](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=f215f967-bb30-44e6-baa1-d332eded1587>)

### Rule: Functions should be moved to the highest possible scope

**Rule ID:** typescript:S7721

#### Why is this an issue?

When functions are defined in nested scopes unnecessarily, it creates several problems:

**Performance Impact**: Functions defined inside other functions are recreated every time the outer function runs. This wastes memory and processing time, especially in frequently called code.

**Engine Optimization**: JavaScript engines like V8 have optimization limits. Functions in nested scopes are harder to optimize, which can slow down your application.

**Code Readability**: Functions at higher scopes are easier to find and understand. When a function doesn’t depend on its surrounding context, placing it at the top level makes the code structure clearer.

**Memory Usage**: Each function instance takes up memory. Creating the same function repeatedly in nested scopes increases memory consumption unnecessarily.

The rule identifies functions that capture no variables from their enclosing scope, meaning they can be safely moved to a higher level without changing their behavior.

##### What is the potential impact?

Moving functions to appropriate scopes improves application performance by reducing function recreation overhead and enabling better JavaScript engine optimizations. It also enhances code maintainability by making function dependencies clearer and reducing memory usage in frequently executed code paths.

##### How to fix?

Move the function declaration to the module level when it doesn’t capture any variables from the enclosing scope.

##### Non-compliant code example

```
export function doFoo(foo) {
	// Does not capture anything from the scope
	function doBar(bar) { // Noncompliant
		return bar === 'bar';
	}

	return doBar;
}
```

##### Compliant code example

```
function doBar(bar) {
	return bar === 'bar';
}

export function doFoo(foo) {
	return doBar;
}
```

##### Documentation

*   [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn#readme) - Rule [consistent-function-scoping](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/HEAD/docs/rules/consistent-function-scoping.md)
*   JavaScript Function Hoisting - [MDN documentation on JavaScript hoisting behavior](https://developer.mozilla.org/en-US/docs/Glossary/Hoisting)

##### Standards

*   ESLint: prefer-const - [Related ESLint rule for variable declaration optimization](https://eslint.org/docs/latest/rules/prefer-const)

#### Overview

This is an issue when a function is defined in a nested scope but doesn’t use any variables from that scope, meaning it could be moved to a higher scope.

### Rule: Generic "Error" should be "TypeError" when thrown after type checking

**Rule ID:** typescript:S7786

#### Overview

This rule raises an issue when a generic `Error` is thrown immediately after an if-statement that performs type checking operations.

#### Why is this an issue?

JavaScript provides specific error types for different kinds of problems. When you’re checking types and throwing errors based on those checks, using a generic `Error` is less precise than using `TypeError`.

`TypeError` is the standard JavaScript error type specifically designed for situations where a value is not of the expected type. Using the correct error type makes your code more semantically accurate and helps other developers (and tools) understand what went wrong.

When you use `TypeError` instead of `Error` for type-related issues, you provide better context about the nature of the problem. This makes debugging easier and follows JavaScript best practices for error handling.

The rule recognizes common type checking patterns including:

*   `typeof` operator checks
*   `instanceof` operator checks
*   Built-in type checking methods like `Array.isArray()`, `Number.isNaN()`, `Number.isInteger()`
*   Type checking methods from popular libraries like Underscore, Lodash, and jQuery

##### What is the potential impact?

Using generic `Error` instead of `TypeError` for type-related issues reduces code clarity and makes debugging more difficult. It also goes against JavaScript conventions and best practices for error handling.

##### How to fix?

Replace `Error` with `TypeError` when throwing after type checking conditions. The error message can remain the same.

##### Non-compliant code example

```
if (Array.isArray(foo) === false) {
	throw new Error('Array expected'); // Noncompliant
}
```

##### Compliant code example

```
if (Array.isArray(foo) === false) {
	throw new TypeError('Array expected');
}
```

##### Documentation

*   [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn#readme) - Rule [prefer-type-error](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/HEAD/docs/rules/prefer-type-error.md)
*   MDN - TypeError - [Official documentation for JavaScript TypeError](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypeError)
*   MDN - Error Types - [Overview of different JavaScript error types and when to use them](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#error_types)
*   JavaScript Type Checking - [Documentation for the typeof operator and type checking in JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof)

##### Standards

*   ECMAScript 2017 - TypeError - [ECMAScript specification for TypeError usage](https://tc39.es/ecma262/#sec-native-error-types-used-in-this-standard-typeerror)

<!-- agendo:scan-snapshot
{"source":"sonarqube","scope":"https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351","grouping":"file","target":"src/todos/canvasHostActions.ts","version":1,"retrievedAt":"2026-10-27T05:16:51.141Z","findings":[{"id":"2ecb38fe-1ed3-4dd9-9d65-9fa894c5bd87","rule":"typescript:S7721","severity":"MAJOR","message":"Move function 'validateStatus' to the outer scope.","path":"src/todos/canvasHostActions.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=2ecb38fe-1ed3-4dd9-9d65-9fa894c5bd87","resolved":false,"returned":true},{"id":"320142f3-66fd-4a95-8ddf-828ce1252608","rule":"typescript:S7721","severity":"MAJOR","message":"Move function 'validatePriority' to the outer scope.","path":"src/todos/canvasHostActions.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=320142f3-66fd-4a95-8ddf-828ce1252608","resolved":false,"returned":true},{"id":"77df78ff-f2c0-4b02-a414-d9ca9b6880c6","rule":"typescript:S7721","severity":"MAJOR","message":"Move function 'assertIdValid' to the outer scope.","path":"src/todos/canvasHostActions.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=77df78ff-f2c0-4b02-a414-d9ca9b6880c6","resolved":false,"returned":true},{"id":"8abf0ece-fa58-4d7a-bd6b-1d0a7f940d1a","rule":"typescript:S7721","severity":"MAJOR","message":"Move function 'assertWritable' to the outer scope.","path":"src/todos/canvasHostActions.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=8abf0ece-fa58-4d7a-bd6b-1d0a7f940d1a","resolved":false,"returned":true},{"id":"dc255985-c1fd-45a5-83cb-7b75a629d397","rule":"typescript:S7721","severity":"MAJOR","message":"Move function 'assertTrusted' to the outer scope.","path":"src/todos/canvasHostActions.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=dc255985-c1fd-45a5-83cb-7b75a629d397","resolved":false,"returned":true},{"id":"df71231c-dd63-4111-bab5-41d80783b76b","rule":"typescript:S7721","severity":"MAJOR","message":"Move function 'validateGroup' to the outer scope.","path":"src/todos/canvasHostActions.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=df71231c-dd63-4111-bab5-41d80783b76b","resolved":false,"returned":true},{"id":"f215f967-bb30-44e6-baa1-d332eded1587","rule":"typescript:S7786","severity":"MINOR","message":"`new Error()` is too unspecific for a type check. Use `new TypeError()` instead.","path":"src/todos/canvasHostActions.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=f215f967-bb30-44e6-baa1-d332eded1587","resolved":false,"returned":true}],"rules":[{"id":"typescript:S7721","title":"Functions should be moved to the highest possible scope","description":"#### Why is this an issue?\n\nWhen functions are defined in nested scopes unnecessarily, it creates several problems:\n\n**Performance Impact**: Functions defined inside other functions are recreated every time the outer function runs. This wastes memory and processing time, especially in frequently called code.\n\n**Engine Optimization**: JavaScript engines like V8 have optimization limits. Functions in nested scopes are harder to optimize, which can slow down your application.\n\n**Code Readability**: Functions at higher scopes are easier to find and understand. When a function doesn’t depend on its surrounding context, placing it at the top level makes the code structure clearer.\n\n**Memory Usage**: Each function instance takes up memory. Creating the same function repeatedly in nested scopes increases memory consumption unnecessarily.\n\nThe rule identifies functions that capture no variables from their enclosing scope, meaning they can be safely moved to a higher level without changing their behavior.\n\n##### What is the potential impact?\n\nMoving functions to appropriate scopes improves application performance by reducing function recreation overhead and enabling better JavaScript engine optimizations. It also enhances code maintainability by making function dependencies clearer and reducing memory usage in frequently executed code paths.\n\n##### How to fix?\n\nMove the function declaration to the module level when it doesn’t capture any variables from the enclosing scope.\n\n##### Non-compliant code example\n\n```\nexport function doFoo(foo) {\n\t// Does not capture anything from the scope\n\tfunction doBar(bar) { // Noncompliant\n\t\treturn bar === 'bar';\n\t}\n\n\treturn doBar;\n}\n```\n\n##### Compliant code example\n\n```\nfunction doBar(bar) {\n\treturn bar === 'bar';\n}\n\nexport function doFoo(foo) {\n\treturn doBar;\n}\n```\n\n##### Documentation\n\n*   [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn#readme) - Rule [consistent-function-scoping](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/HEAD/docs/rules/consistent-function-scoping.md)\n*   JavaScript Function Hoisting - [MDN documentation on JavaScript hoisting behavior](https://developer.mozilla.org/en-US/docs/Glossary/Hoisting)\n\n##### Standards\n\n*   ESLint: prefer-const - [Related ESLint rule for variable declaration optimization](https://eslint.org/docs/latest/rules/prefer-const)\n\n#### Overview\n\nThis is an issue when a function is defined in a nested scope but doesn’t use any variables from that scope, meaning it could be moved to a higher scope."},{"id":"typescript:S7786","title":"Generic \"Error\" should be \"TypeError\" when thrown after type checking","description":"#### Overview\n\nThis rule raises an issue when a generic `Error` is thrown immediately after an if-statement that performs type checking operations.\n\n#### Why is this an issue?\n\nJavaScript provides specific error types for different kinds of problems. When you’re checking types and throwing errors based on those checks, using a generic `Error` is less precise than using `TypeError`.\n\n`TypeError` is the standard JavaScript error type specifically designed for situations where a value is not of the expected type. Using the correct error type makes your code more semantically accurate and helps other developers (and tools) understand what went wrong.\n\nWhen you use `TypeError` instead of `Error` for type-related issues, you provide better context about the nature of the problem. This makes debugging easier and follows JavaScript best practices for error handling.\n\nThe rule recognizes common type checking patterns including:\n\n*   `typeof` operator checks\n*   `instanceof` operator checks\n*   Built-in type checking methods like `Array.isArray()`, `Number.isNaN()`, `Number.isInteger()`\n*   Type checking methods from popular libraries like Underscore, Lodash, and jQuery\n\n##### What is the potential impact?\n\nUsing generic `Error` instead of `TypeError` for type-related issues reduces code clarity and makes debugging more difficult. It also goes against JavaScript conventions and best practices for error handling.\n\n##### How to fix?\n\nReplace `Error` with `TypeError` when throwing after type checking conditions. The error message can remain the same.\n\n##### Non-compliant code example\n\n```\nif (Array.isArray(foo) === false) {\n\tthrow new Error('Array expected'); // Noncompliant\n}\n```\n\n##### Compliant code example\n\n```\nif (Array.isArray(foo) === false) {\n\tthrow new TypeError('Array expected');\n}\n```\n\n##### Documentation\n\n*   [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn#readme) - Rule [prefer-type-error](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/HEAD/docs/rules/prefer-type-error.md)\n*   MDN - TypeError - [Official documentation for JavaScript TypeError](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypeError)\n*   MDN - Error Types - [Overview of different JavaScript error types and when to use them](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#error_types)\n*   JavaScript Type Checking - [Documentation for the typeof operator and type checking in JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof)\n\n##### Standards\n\n*   ECMAScript 2017 - TypeError - [ECMAScript specification for TypeError usage](https://tc39.es/ecma262/#sec-native-error-types-used-in-this-standard-typeerror)"}]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

### Findings

- [x] [2ecb38fe-1ed3-4dd9-9d65-9fa894c5bd87] `typescript:S7721` — Move function 'validateStatus' to the outer scope. (src/todos/canvasHostActions.ts)
- [x] [320142f3-66fd-4a95-8ddf-828ce1252608] `typescript:S7721` — Move function 'validatePriority' to the outer scope. (src/todos/canvasHostActions.ts)
- [x] [77df78ff-f2c0-4b02-a414-d9ca9b6880c6] `typescript:S7721` — Move function 'assertIdValid' to the outer scope. (src/todos/canvasHostActions.ts)
- [x] [8abf0ece-fa58-4d7a-bd6b-1d0a7f940d1a] `typescript:S7721` — Move function 'assertWritable' to the outer scope. (src/todos/canvasHostActions.ts)
- [x] [dc255985-c1fd-45a5-83cb-7b75a629d397] `typescript:S7721` — Move function 'assertTrusted' to the outer scope. (src/todos/canvasHostActions.ts)
- [x] [df71231c-dd63-4111-bab5-41d80783b76b] `typescript:S7721` — Move function 'validateGroup' to the outer scope. (src/todos/canvasHostActions.ts)
- [x] [f215f967-bb30-44e6-baa1-d332eded1587] `typescript:S7786` — \`new Error()\` is too unspecific for a type check. Use \`new TypeError()\` instead. (src/todos/canvasHostActions.ts)

### End Findings




- [x] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Work Log

### 2026-10-27 - Canvas helper scoping

- Moving six helpers that do not capture factory state to module scope while retaining repository-dependent closures
- Changing non-string group validation to `TypeError` without changing its message or write guards
- Fresh full-file analysis also identified two S6551 diagnostics for stringifying unknown status/priority inputs; split type checks to return explicit type-error messages while keeping invalid-string messages unchanged
- Extended related tests in `src/test/canvasHostActions.test.ts` for numeric, null, undefined, object, and array inputs; no status/priority/group writes may occur for invalid types
- Final SonarQube `analyze_code_snippet` on the complete updated production file (`ts`, `MAIN`, project key from `sonar-project.properties`) returned zero issues
- The existing independent scanner todo for `canvasHostActions.test.ts` is not being closed or otherwise reconciled by this related test edit
- Recovered source edits were reviewed after the user-reported unrelated VS Code crash; post-crash integration verification is pending
- Final post-crash `npm test`: compilation and lint pass, 342 tests pass, including all canvas guard/type-validation tests; the only failure is the unchanged user-owned scanner-title fixture/assertion mismatch
- `git diff --check` passes; no full-project SonarQube scan or remote clearance is claimed

## Resume Context

**Current state:** Six independent helpers are at module scope, invalid group types throw TypeError, and status/priority type diagnostics avoid default object stringification. Fresh full-file snippet analysis reports zero issues.

**Next step:** Confirm clearance in a full project SonarQube scan before completion.
