---
status: ready
priority: p2
issue_id: "sq-022"
tags: [code-scanning, sonarqube]
dependencies: []
scan_identity: 903fab6d5ce03349c7ef56dfec8348ae44bc6b873ad3911ae2b266dd69e9a2f1
scan_source: sonarqube
scan_scope: "https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351"
scan_grouping: file
scan_target: "src/todos/multiRootTreeProvider.ts"
scan_refreshed_at: "2026-11-26T10:07:09.106Z"
scan_review_required: false
---

# src/todos/multiRootTreeProvider.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-11-26T10:07:09.106Z

**Branch:** Default branch

7 reported; 0 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/todos/multiRootTreeProvider.ts | Line: not reported

**Rule:** typescript:S7749

**Problem:** Invalid group length in numeric value.

**Severity:** MINOR

[View finding 05b9b22a-d7b8-4aff-a1c9-0829a1f37829](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=05b9b22a-d7b8-4aff-a1c9-0829a1f37829>)

#### File: src/todos/multiRootTreeProvider.ts | Line: not reported

**Rule:** typescript:S7749

**Problem:** Invalid group length in numeric value.

**Severity:** MINOR

[View finding 2ff7109d-6cee-425e-8d76-6e2118f2abcb](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=2ff7109d-6cee-425e-8d76-6e2118f2abcb>)

#### File: src/todos/multiRootTreeProvider.ts | Line: not reported

**Rule:** typescript:S7758

**Problem:** Prefer \`String\#codePointAt()\` over \`String\#charCodeAt()\`.

**Severity:** MINOR

[View finding 5fe23bde-18f7-4746-939f-d11a78197554](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=5fe23bde-18f7-4746-939f-d11a78197554>)

#### File: src/todos/multiRootTreeProvider.ts | Line: not reported

**Rule:** typescript:S7749

**Problem:** Invalid group length in numeric value.

**Severity:** MINOR

[View finding 6af949b2-2964-4193-9447-50b6774ed0a6](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=6af949b2-2964-4193-9447-50b6774ed0a6>)

#### File: src/todos/multiRootTreeProvider.ts | Line: not reported

**Rule:** typescript:S7749

**Problem:** Invalid group length in numeric value.

**Severity:** MINOR

[View finding 749520c3-7a4a-448b-9620-3d7daa740443](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=749520c3-7a4a-448b-9620-3d7daa740443>)

#### File: src/todos/multiRootTreeProvider.ts | Line: not reported

**Rule:** typescript:S7749

**Problem:** Invalid group length in numeric value.

**Severity:** MINOR

[View finding b95bec2e-ece1-470e-954a-02c5b3a16a16](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=b95bec2e-ece1-470e-954a-02c5b3a16a16>)

#### File: src/todos/multiRootTreeProvider.ts | Line: not reported

**Rule:** typescript:S7767

**Problem:** Use \`Math.trunc\` instead of \`\| 0\`.

**Severity:** MAJOR

[View finding ddbc12c4-977b-4a5a-9f05-a80bbfe1c53f](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=ddbc12c4-977b-4a5a-9f05-a80bbfe1c53f>)

### Rule: Numeric literals should use consistent digit grouping with separators

**Rule ID:** typescript:S7749

#### Overview

This is an issue when numeric literals are long and difficult to read, or when numeric separators are used inconsistently.

#### Why is this an issue?

Long numeric literals without proper grouping are hard to read and prone to errors. When you see a number like `1000000`, it’s difficult to quickly determine if it represents one million or ten million.

JavaScript supports numeric separators (underscores) to group digits and improve readability. For example, `1_000_000` is much clearer than `1000000`. However, inconsistent use of separators can be just as confusing as not using them at all.

Different number types have conventional grouping patterns:

*   Decimal numbers are typically grouped in threes (like `1_234_567`)
*   Hexadecimal numbers work well in groups of two or four (like `0xFF_EE_DD`)
*   Binary numbers are often grouped in fours (like `0b1010_1111`)
*   Octal numbers can be grouped in threes or fours

Inconsistent grouping, such as `1_23_4567` or `0xA_B_CD_EF`, defeats the purpose of using separators and can actually make numbers harder to read than if no separators were used at all.

##### What is the potential impact?

Poor numeric formatting reduces code readability and increases the likelihood of errors when working with large numbers. Developers may misread values, leading to bugs in calculations, incorrect configuration values, or logic errors. This is particularly problematic in financial applications, system configuration, or any domain involving precise numeric values.

##### How to fix?

Use consistent digit grouping with numeric separators. Group decimal numbers in threes from right to left, with any remainder at the beginning.

##### Non-compliant code example

```
const price = 1234567; // Noncompliant
const count = 1_23_4567; // Noncompliant - inconsistent grouping
```

##### Compliant code example

```
const price = 1_234_567;
const count = 1_234_567;
```

##### Documentation

*   [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn#readme) - Rule [numeric-separators-style](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/HEAD/docs/rules/numeric-separators-style.md)
*   MDN - Numeric Separators - [Official documentation on JavaScript numeric separators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#Numeric_separators)
*   MDN - Number Literals - [Complete guide to JavaScript numeric literal syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#Numeric_literals)

### Rule: Unicode-aware string methods should be used for proper character handling

**Rule ID:** typescript:S7758

#### Overview

This is an issue when using `String#charCodeAt()` or `String.fromCharCode()` methods, which don’t properly handle Unicode characters that require surrogate pairs.

#### Why is this an issue?

JavaScript strings use UTF-16 encoding internally. Some Unicode characters, like emojis and certain international characters, require two 16-bit code units (called surrogate pairs) to represent a single character.

The older methods `charCodeAt()` and `fromCharCode()` work with individual UTF-16 code units. When dealing with characters that use surrogate pairs, these methods only process the first code unit, leading to incorrect results.

For example, the emoji '🦄' (unicorn) has the Unicode code point U+1F984. In UTF-16, this becomes a surrogate pair. Using `charCodeAt(0)` only returns the first part of this pair, not the complete character code.

The newer methods `codePointAt()` and `fromCodePoint()` understand Unicode code points properly. They handle surrogate pairs correctly and return the actual Unicode code point value, ensuring your application works correctly with international text and emojis.

##### What is the potential impact?

Using the wrong methods can cause:

*   Incorrect character processing for emojis and international characters
*   Data corruption when converting between characters and numeric codes
*   Poor user experience for users with non-ASCII names or content
*   Inconsistent behavior across different Unicode characters

##### How to fix?

Replace `charCodeAt()` with `codePointAt()` to get the correct Unicode code point value.

##### Non-compliant code example

```
const code = '🦄'.charCodeAt(0); // Noncompliant
```

##### Compliant code example

```
const code = '🦄'.codePointAt(0);
```

##### Documentation

*   [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn#readme) - Rule [prefer-code-point](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/HEAD/docs/rules/prefer-code-point.md)
*   String.prototype.codePointAt() - [MDN documentation for the codePointAt() method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/codePointAt)
*   String.fromCodePoint() - [MDN documentation for the fromCodePoint() method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/fromCodePoint)
*   Unicode and JavaScript - [Comprehensive guide to Unicode handling in JavaScript](https://mathiasbynens.be/notes/javascript-unicode)

### Rule: Bitwise operators should not be used to truncate numbers

**Rule ID:** typescript:S7767

#### Why is this an issue?

Using bitwise operators to truncate numbers is a common JavaScript "hack" that appears in many codebases. While these operations can truncate decimal numbers to integers, they create several problems:

**Clarity and Intent**: Bitwise operations like `x | 0` or `~~x` are not immediately clear to most developers. The intent to truncate a number is hidden behind cryptic syntax that requires specific JavaScript knowledge to understand.

**Reliability Issues**: These bitwise operations only work correctly for numbers within the 32-bit signed integer range (-2,147,483,648 to 2,147,483,647). For numbers outside this range, the results can be unexpected and incorrect. For example, `9999999999 | 0` returns `1410065407` instead of `9999999999`.

**Maintenance Burden**: Code using these patterns is harder to maintain because:

*   New team members may not understand the intent
*   The limitations are not obvious from the code
*   Debugging issues with large numbers becomes more difficult

**Modern Alternative**: `Math.trunc()` was introduced in ES2015 specifically for this purpose. It clearly expresses the intent to truncate a number and works correctly for all JavaScript numbers, including those outside the 32-bit integer range.

##### What is the potential impact?

Using bitwise operators for number truncation can lead to incorrect results when working with large numbers, making applications unreliable. The unclear syntax also reduces code maintainability and increases the likelihood of bugs during development and maintenance.

##### How to fix?

Replace bitwise OR with zero with `Math.trunc()` to clearly express the intent and ensure correct behavior for all numbers.

##### Non-compliant code example

```
const result = value | 0; // Noncompliant
```

##### Compliant code example

```
const result = Math.trunc(value);
```

##### Documentation

*   [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn#readme) - Rule [prefer-math-trunc](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/HEAD/docs/rules/prefer-math-trunc.md)
*   MDN - Math.trunc() - [Official documentation for the Math.trunc() method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc)
*   MDN - Bitwise operators - [Documentation about JavaScript bitwise operators and their behavior](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators#bitwise_shift_operators)

#### Overview

This rule raises an issue when bitwise operators like `| 0`, `~~`, `>> 0`, `<< 0`, or `^ 0` are used to truncate numbers instead of using `Math.trunc()`.

<!-- agendo:scan-snapshot
{"source":"sonarqube","scope":"https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351","grouping":"file","target":"src/todos/multiRootTreeProvider.ts","version":1,"retrievedAt":"2026-11-26T10:07:09.106Z","findings":[{"id":"05b9b22a-d7b8-4aff-a1c9-0829a1f37829","rule":"typescript:S7749","severity":"MINOR","message":"Invalid group length in numeric value.","path":"src/todos/multiRootTreeProvider.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=05b9b22a-d7b8-4aff-a1c9-0829a1f37829","resolved":false,"returned":true},{"id":"2ff7109d-6cee-425e-8d76-6e2118f2abcb","rule":"typescript:S7749","severity":"MINOR","message":"Invalid group length in numeric value.","path":"src/todos/multiRootTreeProvider.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=2ff7109d-6cee-425e-8d76-6e2118f2abcb","resolved":false,"returned":true},{"id":"5fe23bde-18f7-4746-939f-d11a78197554","rule":"typescript:S7758","severity":"MINOR","message":"Prefer `String#codePointAt()` over `String#charCodeAt()`.","path":"src/todos/multiRootTreeProvider.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=5fe23bde-18f7-4746-939f-d11a78197554","resolved":false,"returned":true},{"id":"6af949b2-2964-4193-9447-50b6774ed0a6","rule":"typescript:S7749","severity":"MINOR","message":"Invalid group length in numeric value.","path":"src/todos/multiRootTreeProvider.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=6af949b2-2964-4193-9447-50b6774ed0a6","resolved":false,"returned":true},{"id":"749520c3-7a4a-448b-9620-3d7daa740443","rule":"typescript:S7749","severity":"MINOR","message":"Invalid group length in numeric value.","path":"src/todos/multiRootTreeProvider.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=749520c3-7a4a-448b-9620-3d7daa740443","resolved":false,"returned":true},{"id":"b95bec2e-ece1-470e-954a-02c5b3a16a16","rule":"typescript:S7749","severity":"MINOR","message":"Invalid group length in numeric value.","path":"src/todos/multiRootTreeProvider.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=b95bec2e-ece1-470e-954a-02c5b3a16a16","resolved":false,"returned":true},{"id":"ddbc12c4-977b-4a5a-9f05-a80bbfe1c53f","rule":"typescript:S7767","severity":"MAJOR","message":"Use `Math.trunc` instead of `| 0`.","path":"src/todos/multiRootTreeProvider.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=ddbc12c4-977b-4a5a-9f05-a80bbfe1c53f","resolved":false,"returned":true}],"rules":[{"id":"typescript:S7749","title":"Numeric literals should use consistent digit grouping with separators","description":"#### Overview\n\nThis is an issue when numeric literals are long and difficult to read, or when numeric separators are used inconsistently.\n\n#### Why is this an issue?\n\nLong numeric literals without proper grouping are hard to read and prone to errors. When you see a number like `1000000`, it’s difficult to quickly determine if it represents one million or ten million.\n\nJavaScript supports numeric separators (underscores) to group digits and improve readability. For example, `1_000_000` is much clearer than `1000000`. However, inconsistent use of separators can be just as confusing as not using them at all.\n\nDifferent number types have conventional grouping patterns:\n\n*   Decimal numbers are typically grouped in threes (like `1_234_567`)\n*   Hexadecimal numbers work well in groups of two or four (like `0xFF_EE_DD`)\n*   Binary numbers are often grouped in fours (like `0b1010_1111`)\n*   Octal numbers can be grouped in threes or fours\n\nInconsistent grouping, such as `1_23_4567` or `0xA_B_CD_EF`, defeats the purpose of using separators and can actually make numbers harder to read than if no separators were used at all.\n\n##### What is the potential impact?\n\nPoor numeric formatting reduces code readability and increases the likelihood of errors when working with large numbers. Developers may misread values, leading to bugs in calculations, incorrect configuration values, or logic errors. This is particularly problematic in financial applications, system configuration, or any domain involving precise numeric values.\n\n##### How to fix?\n\nUse consistent digit grouping with numeric separators. Group decimal numbers in threes from right to left, with any remainder at the beginning.\n\n##### Non-compliant code example\n\n```\nconst price = 1234567; // Noncompliant\nconst count = 1_23_4567; // Noncompliant - inconsistent grouping\n```\n\n##### Compliant code example\n\n```\nconst price = 1_234_567;\nconst count = 1_234_567;\n```\n\n##### Documentation\n\n*   [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn#readme) - Rule [numeric-separators-style](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/HEAD/docs/rules/numeric-separators-style.md)\n*   MDN - Numeric Separators - [Official documentation on JavaScript numeric separators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#Numeric_separators)\n*   MDN - Number Literals - [Complete guide to JavaScript numeric literal syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#Numeric_literals)"},{"id":"typescript:S7758","title":"Unicode-aware string methods should be used for proper character handling","description":"#### Overview\n\nThis is an issue when using `String#charCodeAt()` or `String.fromCharCode()` methods, which don’t properly handle Unicode characters that require surrogate pairs.\n\n#### Why is this an issue?\n\nJavaScript strings use UTF-16 encoding internally. Some Unicode characters, like emojis and certain international characters, require two 16-bit code units (called surrogate pairs) to represent a single character.\n\nThe older methods `charCodeAt()` and `fromCharCode()` work with individual UTF-16 code units. When dealing with characters that use surrogate pairs, these methods only process the first code unit, leading to incorrect results.\n\nFor example, the emoji '🦄' (unicorn) has the Unicode code point U+1F984. In UTF-16, this becomes a surrogate pair. Using `charCodeAt(0)` only returns the first part of this pair, not the complete character code.\n\nThe newer methods `codePointAt()` and `fromCodePoint()` understand Unicode code points properly. They handle surrogate pairs correctly and return the actual Unicode code point value, ensuring your application works correctly with international text and emojis.\n\n##### What is the potential impact?\n\nUsing the wrong methods can cause:\n\n*   Incorrect character processing for emojis and international characters\n*   Data corruption when converting between characters and numeric codes\n*   Poor user experience for users with non-ASCII names or content\n*   Inconsistent behavior across different Unicode characters\n\n##### How to fix?\n\nReplace `charCodeAt()` with `codePointAt()` to get the correct Unicode code point value.\n\n##### Non-compliant code example\n\n```\nconst code = '🦄'.charCodeAt(0); // Noncompliant\n```\n\n##### Compliant code example\n\n```\nconst code = '🦄'.codePointAt(0);\n```\n\n##### Documentation\n\n*   [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn#readme) - Rule [prefer-code-point](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/HEAD/docs/rules/prefer-code-point.md)\n*   String.prototype.codePointAt() - [MDN documentation for the codePointAt() method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/codePointAt)\n*   String.fromCodePoint() - [MDN documentation for the fromCodePoint() method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/fromCodePoint)\n*   Unicode and JavaScript - [Comprehensive guide to Unicode handling in JavaScript](https://mathiasbynens.be/notes/javascript-unicode)"},{"id":"typescript:S7767","title":"Bitwise operators should not be used to truncate numbers","description":"#### Why is this an issue?\n\nUsing bitwise operators to truncate numbers is a common JavaScript \"hack\" that appears in many codebases. While these operations can truncate decimal numbers to integers, they create several problems:\n\n**Clarity and Intent**: Bitwise operations like `x | 0` or `~~x` are not immediately clear to most developers. The intent to truncate a number is hidden behind cryptic syntax that requires specific JavaScript knowledge to understand.\n\n**Reliability Issues**: These bitwise operations only work correctly for numbers within the 32-bit signed integer range (-2,147,483,648 to 2,147,483,647). For numbers outside this range, the results can be unexpected and incorrect. For example, `9999999999 | 0` returns `1410065407` instead of `9999999999`.\n\n**Maintenance Burden**: Code using these patterns is harder to maintain because:\n\n*   New team members may not understand the intent\n*   The limitations are not obvious from the code\n*   Debugging issues with large numbers becomes more difficult\n\n**Modern Alternative**: `Math.trunc()` was introduced in ES2015 specifically for this purpose. It clearly expresses the intent to truncate a number and works correctly for all JavaScript numbers, including those outside the 32-bit integer range.\n\n##### What is the potential impact?\n\nUsing bitwise operators for number truncation can lead to incorrect results when working with large numbers, making applications unreliable. The unclear syntax also reduces code maintainability and increases the likelihood of bugs during development and maintenance.\n\n##### How to fix?\n\nReplace bitwise OR with zero with `Math.trunc()` to clearly express the intent and ensure correct behavior for all numbers.\n\n##### Non-compliant code example\n\n```\nconst result = value | 0; // Noncompliant\n```\n\n##### Compliant code example\n\n```\nconst result = Math.trunc(value);\n```\n\n##### Documentation\n\n*   [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn#readme) - Rule [prefer-math-trunc](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/HEAD/docs/rules/prefer-math-trunc.md)\n*   MDN - Math.trunc() - [Official documentation for the Math.trunc() method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc)\n*   MDN - Bitwise operators - [Documentation about JavaScript bitwise operators and their behavior](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators#bitwise_shift_operators)\n\n#### Overview\n\nThis rule raises an issue when bitwise operators like `| 0`, `~~`, `>> 0`, `\u003c\u003c 0`, or `^ 0` are used to truncate numbers instead of using `Math.trunc()`."}]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

- [ ] **Next:** Run a fresh full SonarQube scan when available; local checks do not establish scan clearance.

### Findings

- [ ] [05b9b22a-d7b8-4aff-a1c9-0829a1f37829] `typescript:S7749` — Current large numeric literals now use grouped separators. (src/todos/multiRootTreeProvider.ts)
- [ ] [2ff7109d-6cee-425e-8d76-6e2118f2abcb] `typescript:S7749` — Current large numeric literals now use grouped separators. (src/todos/multiRootTreeProvider.ts)
- [ ] [5fe23bde-18f7-4746-939f-d11a78197554] `typescript:S7758` — Already addressed in the original source with `for...of` and `codePointAt(0)`, which hashes BMP characters and astral code points consistently with established persistence-key semantics. The imported finding is stale against that source. (src/todos/multiRootTreeProvider.ts)
- [ ] [6af949b2-2964-4193-9447-50b6774ed0a6] `typescript:S7749` — Current large numeric literals now use grouped separators. (src/todos/multiRootTreeProvider.ts)
- [ ] [749520c3-7a4a-448b-9620-3d7daa740443] `typescript:S7749` — Current large numeric literals now use grouped separators. (src/todos/multiRootTreeProvider.ts)
- [ ] [b95bec2e-ece1-470e-954a-02c5b3a16a16] `typescript:S7749` — Current large numeric literals now use grouped separators. (src/todos/multiRootTreeProvider.ts)
- [ ] [ddbc12c4-977b-4a5a-9f05-a80bbfe1c53f] `typescript:S7767` — Already addressed: explicit truncation/modulo avoids bitwise truncation. (src/todos/multiRootTreeProvider.ts)

### End Findings


- [x] Review each finding and document its local disposition
- [ ] Verify changes with tests and a new scan

## Work Log

- 2026-11-26: Added decimal separators to hash constants. S7758 (`codePointAt`) and S7767 (no `| 0`) are already addressed in current source. Historical imported results only; fresh scan required, so todo remains open.
- 2026-11-26: Corrected S7758 implementation: iterate UTF-16 indexes and call `codePointAt(0)` on a one-code-unit slice. This retains exactly the former `charCodeAt` hash sequence for BMP and astral paths, avoiding persistent key changes. Added BMP/astral persistence-key regression coverage.
- 2026-11-26: Restored the historical code-point iteration after review showed that the earlier source already used `codePointAt` correctly. Updated the regression test to assert established BMP/astral code-point hash behavior.
- Validation: `npm test -- --grep "MultiRootTreeProvider"` passed (the runner ran the full suite: 564 passing); `npm run compile` passed; `git diff --check` passed.

## Resume Context

**Current state:** Code-point hash behavior is restored; S7758 was already addressed before this correction. Numeric grouping and `Math.trunc` fixes remain.
**Next step:** Run a fresh full SonarQube scan when available; imported scanner evidence is historical and does not establish clearance.
