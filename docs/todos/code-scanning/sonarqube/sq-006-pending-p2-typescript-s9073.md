---
status: pending
priority: p2
issue_id: "sq-006"
tags: [code-scanning, sonarqube]
group: SonarQube
dependencies: []
scan_identity: 715dc21c79ff2352c6a3688904b66aef7285c5520580bbdd929848f331e343fe
scan_source: sonarqube
---

# SonarQube: typescript:S9073

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

### Affected Locations

#### File: src/test/todoCollisions.test.ts | Line: 275

**Problem:** This composite assertion hides which condition failed; split it to make failures actionable.

**Severity:** MAJOR

[View finding 094d91e0-f9a3-49a3-a066-f14231a1de5e](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=094d91e0-f9a3-49a3-a066-f14231a1de5e>)

#### File: src/test/todoCollisions.test.ts | Line: 186

**Problem:** This composite assertion hides which condition failed; split it to make failures actionable.

**Severity:** MAJOR

[View finding 1846e930-13c1-4523-baf6-3deeacdecf7e](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=1846e930-13c1-4523-baf6-3deeacdecf7e>)

#### File: src/test/todoCollisions.test.ts | Line: 269

**Problem:** This composite assertion hides which condition failed; split it to make failures actionable.

**Severity:** MAJOR

[View finding fd04cd67-ed6b-4b3a-b4fc-d57c895a910e](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=fd04cd67-ed6b-4b3a-b4fc-d57c895a910e>)

### Rule: Composite assertions should be split

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
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

- [ ] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Work Log
