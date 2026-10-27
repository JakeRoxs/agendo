---
status: ready
priority: p2
issue_id: "sq-003"
tags: [code-scanning, sonarqube]
dependencies: []
scan_identity: 668fee4119348fe4cfc5ef36c4ea3fbb3382fd081054ac8ecded0890a3bf11db
scan_source: sonarqube
scan_scope: "https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351"
scan_grouping: file
scan_target: "src/test/canvasApproval.test.ts"
scan_refreshed_at: "2026-10-27T02:18:14.795Z"
scan_review_required: true
---

# SonarQube: src/test/canvasApproval.test.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-10-27T02:18:14.795Z

**Branch:** Default branch

0 reported; 1 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/test/canvasApproval.test.ts | Line: 109

**Rule:** typescript:S9073

**Problem:** This composite assertion hides which condition failed; split it to make failures actionable.

**Severity:** MAJOR

**Observation:** Not returned in the latest successful result; resolution is not verified.

[View finding 66981514-4860-4ada-aa6b-d73466305ed8](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=66981514-4860-4ada-aa6b-d73466305ed8>)

### Rule: Composite assertions should be split

**Rule ID:** typescript:S9073

#### Why is this an issue?

When an assertion combines independent conditions, its failure does not identify which condition was not satisfied. Splitting the conditions into separate assertions produces a more precise failure and makes the problem easier to diagnose.

However, `&&` is also commonly used to express one cohesive check on a single value. When one operand checks that a value exists, has a given type, or has a given shape, and every remaining operand only uses that same value, the conditions are not independent: the later operands rely on the earlier check. Such guard chains should remain a single assertion and are not reported:

```
import assert from 'node:assert/strict';

assert(primaryColumns[0] && primaryColumns[0].length > 0);
assert(typeof value === 'object' && value !== null);
assert(Array.isArray(value) && value.length > 0);
assert(isNonEmpty(list) && list[0].id);
assert(value instanceof Error && value.message);
assert('create' in rule && typeof rule.create === 'function');
assert(rule && typeof rule === 'object' && typeof rule.create === 'function');
```

Conditions that only happen to involve the same value are still independent and are reported. In particular, comparing a property is a check on that property rather than on the object that holds it:

```
import assert from 'node:assert/strict';

assert(index >= 0 && index < items.length); // Noncompliant: two independent bounds
assert(result.kind === 'success' && result.value); // Noncompliant: two independent properties
```

##### What is the potential impact?

When a composite assertion fails, developers spend extra time deciphering which condition broke. Opaque failure messages slow down debugging and make flaky or partial regressions harder to diagnose. Splitting assertions keeps each check independent and produces clearer failure reports.

#### References

##### Documentation

*   Node.js Documentation - [`assert`](https://nodejs.org/api/assert.html#assertvalue-message)
*   Jest Documentation - [`toBeTruthy` and `toBeFalsy`](https://jestjs.io/docs/expect#tobetruthy)
*   Vitest Documentation - [`toBeTruthy` and `toBeFalsy`](https://vitest.dev/api/expect#tobetruthy)
*   Bun Documentation - [Matchers](https://bun.com/docs/test/writing-tests#matchers)

#### How to fix it

Split composite assertions into separate assertion statements, one per independent condition. For `assert.ok(!(a || b))` or `expect(a || b).toBeFalsy()`, write separate assertions for each condition.

This applies to:

*   `assert.ok(a && b)` or `expect(a && b).toBeTruthy()` (and longer `&&` chains) that combine independent conditions
*   `assert.ok(!(a || b))`, `expect(a || b).toBeFalsy()`, or `expect(a || b).not.toBeTruthy()` (requiring every condition in an `||` expression to be falsy)
*   `expect(!(a && b)).toBeFalsy()` (equivalent to requiring every condition in `a && b` to be truthy)

Plain `a || b` truthiness assertions are not reported because replacing them with separate assertions would change the test to require both conditions. Comparisons such as `expect(a && b).toBe(true)` are also outside the scope of this rule.

##### Noncompliant code example

```
import assert from 'node:assert/strict';

assert.ok(user.isActive && user.isVerified); // Noncompliant: This composite assertion hides which condition failed; split it to make failures actionable
```

##### Compliant solution

```
import assert from 'node:assert/strict';

assert.ok(user.isActive);
assert.ok(user.isVerified);
```

##### Noncompliant code example

```
import assert from 'node:assert/strict';

assert(!(user.isBlocked || user.isSuspended)); // Noncompliant: This composite assertion hides which condition failed; split it to make failures actionable
```

##### Compliant solution

```
import assert from 'node:assert/strict';

assert(!user.isBlocked);
assert(!user.isSuspended);
```

##### Noncompliant code example

```
import { expect } from 'vitest';

expect(user.isActive && user.isVerified).toBeTruthy(); // Noncompliant: This composite assertion hides which condition failed; split it to make failures actionable
```

##### Compliant solution

```
import { expect } from 'vitest';

expect(user.isActive).toBeTruthy();
expect(user.isVerified).toBeTruthy();
```

##### Noncompliant code example

```
import { expect } from 'bun:test';

expect(user.isBlocked || user.isSuspended).toBeFalsy(); // Noncompliant: This composite assertion hides which condition failed; split it to make failures actionable
```

##### Compliant solution

```
import { expect } from 'bun:test';

expect(user.isBlocked).toBeFalsy();
expect(user.isSuspended).toBeFalsy();
```

##### Noncompliant code example

```
import { expect } from '@jest/globals';

expect(user.isBlocked || user.isSuspended).not.toBeTruthy(); // Noncompliant: This composite assertion hides which condition failed; split it to make failures actionable
```

##### Compliant solution

```
import { expect } from '@jest/globals';

expect(user.isBlocked).not.toBeTruthy();
expect(user.isSuspended).not.toBeTruthy();
```

##### Noncompliant code example

```
import { expect } from 'bun:test';

expect(!(user.isActive && user.isVerified)).toBeFalsy(); // Noncompliant: This composite assertion hides which condition failed; split it to make failures actionable
```

##### Compliant solution

```
import { expect } from 'bun:test';

expect(user.isActive).toBeTruthy();
expect(user.isVerified).toBeTruthy();
```

#### Overview

Composite assertions combine several conditions in one assertion. This rule raises an issue when a Node.js `assert` call or a Jest-like truthiness matcher combines independent conditions with `&&`, or asserts that every condition in an `||` expression is false.

The rule applies only to assertions in test code.

<!-- agendo:scan-snapshot
{"source":"sonarqube","scope":"https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351","grouping":"file","target":"src/test/canvasApproval.test.ts","version":1,"retrievedAt":"2026-10-27T02:18:14.795Z","findings":[{"id":"66981514-4860-4ada-aa6b-d73466305ed8","rule":"typescript:S9073","severity":"MAJOR","message":"This composite assertion hides which condition failed; split it to make failures actionable.","path":"src/test/canvasApproval.test.ts","line":109,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=66981514-4860-4ada-aa6b-d73466305ed8","returned":false}],"rules":[{"id":"typescript:S9073","title":"Composite assertions should be split","description":"#### Why is this an issue?\n\nWhen an assertion combines independent conditions, its failure does not identify which condition was not satisfied. Splitting the conditions into separate assertions produces a more precise failure and makes the problem easier to diagnose.\n\nHowever, `&&` is also commonly used to express one cohesive check on a single value. When one operand checks that a value exists, has a given type, or has a given shape, and every remaining operand only uses that same value, the conditions are not independent: the later operands rely on the earlier check. Such guard chains should remain a single assertion and are not reported:\n\n```\nimport assert from 'node:assert/strict';\n\nassert(primaryColumns[0] && primaryColumns[0].length > 0);\nassert(typeof value === 'object' && value !== null);\nassert(Array.isArray(value) && value.length > 0);\nassert(isNonEmpty(list) && list[0].id);\nassert(value instanceof Error && value.message);\nassert('create' in rule && typeof rule.create === 'function');\nassert(rule && typeof rule === 'object' && typeof rule.create === 'function');\n```\n\nConditions that only happen to involve the same value are still independent and are reported. In particular, comparing a property is a check on that property rather than on the object that holds it:\n\n```\nimport assert from 'node:assert/strict';\n\nassert(index >= 0 && index \u003c items.length); // Noncompliant: two independent bounds\nassert(result.kind === 'success' && result.value); // Noncompliant: two independent properties\n```\n\n##### What is the potential impact?\n\nWhen a composite assertion fails, developers spend extra time deciphering which condition broke. Opaque failure messages slow down debugging and make flaky or partial regressions harder to diagnose. Splitting assertions keeps each check independent and produces clearer failure reports.\n\n#### References\n\n##### Documentation\n\n*   Node.js Documentation - [`assert`](https://nodejs.org/api/assert.html#assertvalue-message)\n*   Jest Documentation - [`toBeTruthy` and `toBeFalsy`](https://jestjs.io/docs/expect#tobetruthy)\n*   Vitest Documentation - [`toBeTruthy` and `toBeFalsy`](https://vitest.dev/api/expect#tobetruthy)\n*   Bun Documentation - [Matchers](https://bun.com/docs/test/writing-tests#matchers)\n\n#### How to fix it\n\nSplit composite assertions into separate assertion statements, one per independent condition. For `assert.ok(!(a || b))` or `expect(a || b).toBeFalsy()`, write separate assertions for each condition.\n\nThis applies to:\n\n*   `assert.ok(a && b)` or `expect(a && b).toBeTruthy()` (and longer `&&` chains) that combine independent conditions\n*   `assert.ok(!(a || b))`, `expect(a || b).toBeFalsy()`, or `expect(a || b).not.toBeTruthy()` (requiring every condition in an `||` expression to be falsy)\n*   `expect(!(a && b)).toBeFalsy()` (equivalent to requiring every condition in `a && b` to be truthy)\n\nPlain `a || b` truthiness assertions are not reported because replacing them with separate assertions would change the test to require both conditions. Comparisons such as `expect(a && b).toBe(true)` are also outside the scope of this rule.\n\n##### Noncompliant code example\n\n```\nimport assert from 'node:assert/strict';\n\nassert.ok(user.isActive && user.isVerified); // Noncompliant: This composite assertion hides which condition failed; split it to make failures actionable\n```\n\n##### Compliant solution\n\n```\nimport assert from 'node:assert/strict';\n\nassert.ok(user.isActive);\nassert.ok(user.isVerified);\n```\n\n##### Noncompliant code example\n\n```\nimport assert from 'node:assert/strict';\n\nassert(!(user.isBlocked || user.isSuspended)); // Noncompliant: This composite assertion hides which condition failed; split it to make failures actionable\n```\n\n##### Compliant solution\n\n```\nimport assert from 'node:assert/strict';\n\nassert(!user.isBlocked);\nassert(!user.isSuspended);\n```\n\n##### Noncompliant code example\n\n```\nimport { expect } from 'vitest';\n\nexpect(user.isActive && user.isVerified).toBeTruthy(); // Noncompliant: This composite assertion hides which condition failed; split it to make failures actionable\n```\n\n##### Compliant solution\n\n```\nimport { expect } from 'vitest';\n\nexpect(user.isActive).toBeTruthy();\nexpect(user.isVerified).toBeTruthy();\n```\n\n##### Noncompliant code example\n\n```\nimport { expect } from 'bun:test';\n\nexpect(user.isBlocked || user.isSuspended).toBeFalsy(); // Noncompliant: This composite assertion hides which condition failed; split it to make failures actionable\n```\n\n##### Compliant solution\n\n```\nimport { expect } from 'bun:test';\n\nexpect(user.isBlocked).toBeFalsy();\nexpect(user.isSuspended).toBeFalsy();\n```\n\n##### Noncompliant code example\n\n```\nimport { expect } from '@jest/globals';\n\nexpect(user.isBlocked || user.isSuspended).not.toBeTruthy(); // Noncompliant: This composite assertion hides which condition failed; split it to make failures actionable\n```\n\n##### Compliant solution\n\n```\nimport { expect } from '@jest/globals';\n\nexpect(user.isBlocked).not.toBeTruthy();\nexpect(user.isSuspended).not.toBeTruthy();\n```\n\n##### Noncompliant code example\n\n```\nimport { expect } from 'bun:test';\n\nexpect(!(user.isActive && user.isVerified)).toBeFalsy(); // Noncompliant: This composite assertion hides which condition failed; split it to make failures actionable\n```\n\n##### Compliant solution\n\n```\nimport { expect } from 'bun:test';\n\nexpect(user.isActive).toBeTruthy();\nexpect(user.isVerified).toBeTruthy();\n```\n\n#### Overview\n\nComposite assertions combine several conditions in one assertion. This rule raises an issue when a Node.js `assert` call or a Jest-like truthiness matcher combines independent conditions with `&&`, or asserts that every condition in an `||` expression is false.\n\nThe rule applies only to assertions in test code."}]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

### Findings

- [x] [66981514-4860-4ada-aa6b-d73466305ed8] `typescript:S9073` — This composite assertion hides which condition failed; split it to make failures actionable. (src/test/canvasApproval.test.ts:109)
- [x] [66981514-4860-4ada-aa6b-d73466305ed8] `typescript:S9073` — This composite assertion hides which condition failed; split it to make failures actionable. (src/test/canvasApproval.test.ts:109) (not returned)

### End Findings



- [x] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Work Log

### 2026-10-27 - Actionable approval test assertions

- Splitting the independent entry/panel existence checks so a failed approval-lifetime setup identifies which object is missing
- Fresh SonarQube `analyze_code_snippet` on the complete updated test file (`ts`, `TEST`, project key from `sonar-project.properties`) reports zero issues
- `npm test`: compilation and lint pass, 342 tests pass including both canvas approval-lifetime tests; only the unchanged user-owned scanner-title fixture/assertion mismatch fails
- `git diff --check` passes; full-project scan clearance is not claimed

## Resume Context

**Current state:** Review-session and panel existence checks are separate with actionable messages; real extension-host tests and fresh full-file snippet analysis pass.

**Next step:** Confirm clearance in a full project SonarQube scan before completion.
