---
status: ready
priority: p1
issue_id: "sq-011"
tags: [code-scanning, sonarqube]
dependencies: []
scan_identity: 621d4d58bd030f7064028580c0e55703bfe4898635c1879f92e7d1c70dafeed3
scan_source: sonarqube
scan_scope: "https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351"
scan_grouping: file
scan_target: "src/todos/componentVersions.ts"
scan_refreshed_at: "2026-10-27T05:16:51.141Z"
scan_review_required: true
---

# SonarQube: src/todos/componentVersions.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-10-27T05:16:51.141Z

**Branch:** Default branch

2 reported; 0 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/todos/componentVersions.ts | Line: not reported

**Rule:** typescript:S3776

**Problem:** Refactor this function to reduce its Cognitive Complexity from 27 to the 15 allowed.

**Severity:** CRITICAL

[View finding 3578f4b9-d3e8-484e-925d-dcd30dcd3b65](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=3578f4b9-d3e8-484e-925d-dcd30dcd3b65>)

#### File: src/todos/componentVersions.ts | Line: not reported

**Rule:** typescript:S8786

**Problem:** Simplify this regular expression to reduce its runtime, as it has super-linear performance due to backtracking.

**Severity:** MAJOR

[View finding a77a1c99-935a-41b0-b4f6-7ba4a7ad6f6f](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=a77a1c99-935a-41b0-b4f6-7ba4a7ad6f6f>)

### Rule: Cognitive Complexity of functions should not be too high

**Rule ID:** typescript:S3776

#### How to fix it

Reducing cognitive complexity can be challenging.  
Here are a few suggestions:

*   **Extract complex conditions in a new function.**  
    Mixed operators in condition will increase complexity. Extracting the condition in a new function with an appropriate name will reduce cognitive load.
*   **Break down large functions.**  
    Large functions can be hard to understand and maintain. If a function is doing too many things, consider breaking it down into smaller, more manageable functions. Each function should have a single responsibility.
*   **Avoid deep nesting by returning early.**  
    To avoid the nesting of conditions, process exceptional cases first and return early.
*   **Use null-safe operations (if available in the language).**  
    When available the `.?` or `??` operator replaces multiple tests and simplifies the flow.

**Extraction of a complex condition in a new function.**

##### Noncompliant code example

The code is using a complex condition and has a cognitive cost of 3.

```
function calculateFinalPrice(user, cart) {
  let total = calculateTotal(cart);
  if (user.hasMembership                       // +1 (if)
    && user.orders > 10                        // +1 (more than one condition)
    && user.accountActive
    && !user.hasDiscount
    || user.orders === 1) {                    // +1 (change of operator in condition)
      total = applyDiscount(user, total);
  }
  return total;
}
```

##### Compliant solution

Even if the cognitive complexity of the whole program did not change, it is easier for a reader to understand the code of the `calculateFinalPrice` function, which now only has a cognitive cost of 1.

```
function calculateFinalPrice(user, cart) {
  let total = calculateTotal(cart);
  if (isEligibleForDiscount(user)) {       // +1 (if)
    total = applyDiscount(user, total);
  }
  return total;
}

function isEligibleForDiscount(user) {
  return user.hasMembership
    && user.orders > 10                     // +1 (more than one condition)
    && user.accountActive
    && !user.hasDiscount
    || user.orders === 1                    // +1 (change of operator in condition)
}
```

**Break down large functions.**

##### Noncompliant code example

For example, consider a function that calculates the total price of a shopping cart, including sales tax and shipping.  
_Note:_ The code is simplified here, to illustrate the purpose. Please imagine there is more happening in the `for` loops.

```
function calculateTotal(cart) {
  let total = 0;
  for (let i = 0; i < cart.length; i++) {       // +1 (for)
    total += cart[i].price;
  }

  // calculateSalesTax
  for (let i = 0; i < cart.length; i++) {       // +1 (for)
    total += 0.2 * cart[i].price;
  }

  //calculateShipping
  total += 5 * cart.length;

  return total;
}
```

This function could be refactored into smaller functions: The complexity is spread over multiple functions and the complex `calculateTotal` has now a complexity score of zero.

##### Compliant solution

```
function calculateTotal(cart) {
  let total = calculateSubtotal(cart);
  total += calculateSalesTax(cart);
  total += calculateShipping(cart);
  return total;
}

function calculateSubtotal(cart) {
  let subTotal = 0;
  for (const item of cart) {        // +1 (for)
    subTotal += item.price;
  }
  return subTotal;
}

function calculateSalesTax(cart) {
  let salesTax = 0;
  for (const item of cart) {        // +1 (for)
    salesTax += 0.2 * item.price;
  }
  return salesTax;
}

function calculateShipping(cart) {
  return 5 * cart.length;
}
```

**Avoid deep nesting by returning early.**

##### Noncompliant code example

The below code has a cognitive complexity of 6.

```
function calculateDiscount(price, user) {
  if (isEligibleForDiscount(user)) {  // +1 ( if )
    if (user?.hasMembership) {        // +2 ( nested if )
      return price * 0.9;
  } else if (user?.orders === 1 ) {   // +1 ( else )
          return price * 0.95;
    } else {                          // +1 ( else )
      return price;
    }
  } else {                            // +1 ( else )
    return price;
  }
}
```

##### Compliant solution

Checking for the edge case first flattens the `if` statements and reduces the cognitive complexity to 3.

```
function calculateDiscount(price, user) {
    if (!isEligibleForDiscount(user)) {  // +1 ( if )
      return price;
    }
    if (user?.hasMembership) {           // +1 ( if )
      return price * 0.9;
    }
    if (user?.orders === 1) {            // +1 ( if )
      return price * 0.95;
    }
    return price;
}
```

**Use the optional chaining operator to access data.**

In the below code, the cognitive complexity is increased due to the multiple checks required to access the manufacturer’s name. This can be simplified using the optional chaining operator.

##### Noncompliant code example

```
let manufacturerName = null;

if (product && product.details && product.details.manufacturer) { // +1 (if) +1 (multiple condition)
    manufacturerName = product.details.manufacturer.name;
}
if (manufacturerName) { // +1 (if)
  console.log(manufacturerName);
} else {
  console.log('Manufacturer name not found');
}
```

##### Compliant solution

The optional chaining operator will return `undefined` if any reference in the chain is `undefined` or `null`, avoiding multiple checks:

```
let manufacturerName = product?.details?.manufacturer?.name;

if (manufacturerName) { // +1 (if)
  console.log(manufacturerName);
} else {
  console.log('Manufacturer name not found');
}
```

##### Pitfalls

As this code is complex, ensure that you have unit tests that cover the code before refactoring.

#### Why is this an issue?

Cognitive Complexity is a measure of how hard it is to understand the control flow of a unit of code. Code with high cognitive complexity is hard to read, understand, test, and modify.

As a rule of thumb, high cognitive complexity is a sign that the code should be refactored into smaller, easier-to-manage pieces.

##### Which syntax in code does impact cognitive complexity score?

Here are the core concepts:

*   **Cognitive complexity is incremented each time the code breaks the normal linear reading flow.**  
    This concerns, for example, loop structures, conditionals, catches, switches, jumps to labels, and conditions mixing multiple operators.
*   **Each nesting level increases complexity.**  
    During code reading, the deeper you go through nested layers, the harder it becomes to keep the context in mind.
*   **Method calls are free**  
    A well-picked method name is a summary of multiple lines of code. A reader can first explore a high-level view of what the code is performing then go deeper and deeper by looking at called functions content.  
    _Note:_ This does not apply to recursive calls, those will increment cognitive score.

The method of computation is fully detailed in the pdf linked in the resources.

Note that the calculation of cognitive complexity at function level deviates from the documented process. Given the functional nature of JavaScript, nesting functions is a prevalent practice, especially within frameworks like React.js. Consequently, the cognitive complexity of functions remains independent from one another. This means that the complexity of a nesting function does not increase with the complexity of nested functions.

##### What is the potential impact?

Developers spend more time reading and understanding code than writing it. High cognitive complexity slows down changes and increases the cost of maintenance.

##### Exceptions

Cognitive complexity calculations exclude logical expressions using the `||` and `??` operators.

```
function greet(name) {
    name = name || 'Guest';
    console.log('Hello, ' + name + '!');
}
```

#### References

##### Documentation

*   Sonar - [Cognitive Complexity](https://www.sonarsource.com/docs/CognitiveComplexity.pdf)

##### Articles & blog posts

*   Sonar Blog - [5 Clean Code Tips for Reducing Cognitive Complexity](https://www.sonarsource.com/blog/5-clean-code-tips-for-reducing-cognitive-complexity/)

#### Overview

This rule raises an issue when the code cognitive complexity of a function is above a certain threshold.

### Rule: Regular expressions should not cause non-linear backtracking

**Rule ID:** typescript:S8786

#### Why is this an issue?

Regular expression engines use backtracking to try all possible execution paths when evaluating a pattern against an input. In some cases, this leads to non-linear backtracking where the worst-case evaluation time grows polynomially (e.g., O(n²) or O(n³)) with the input size. While not as severe as catastrophic backtracking, such patterns can significantly degrade application performance when processing large or untrusted inputs.

This rule reports regular expressions that exhibit non-linear backtracking behavior.

#### How to fix it

To fix a regular expression with non-linear backtracking, consider the following strategies:

*   Replace `.` with negated character classes to exclude separators where applicable (e.g., `[^,]*` instead of `.*` before `,`).
*   Use bounded quantifiers such as `{1,5}` to limit repetitions.
*   Restructure alternations and quantifiers to eliminate ambiguity — avoid patterns where multiple alternatives can match the same character.
*   JavaScript does not support possessive quantifiers, but atomic grouping can be emulated using lookahead assertions and backreferences.
*   Use a non-backtracking implementation such as [node-re2](https://github.com/uhop/node-re2/).

The following examples illustrate two distinct causes of non-linear backtracking. The first shows a pattern that is polynomial when unanchored: without a start anchor, the engine retries the pattern at every position, leading to quadratic evaluation time when there is no match. The second shows ambiguous alternation, which causes quadratic backtracking regardless of anchoring because multiple alternatives can match the same input in different ways.

##### Noncompliant code example

```
/a+b/.test(input); // Noncompliant - polynomial backtracking when the pattern does not match
```

```
/(a|aa)+/.test(input); // Noncompliant - ambiguous alternation causes quadratic backtracking
```

##### Compliant solution

Adding a start anchor prevents the engine from retrying at every position:

```
/^a+b/.test(input); // Compliant - anchor eliminates redundant backtracking positions
```

Restructuring the alternation to eliminate the overlap removes the quadratic behavior:

```
/a+/.test(input); // Compliant - unambiguous
```

#### References

##### Articles & blog posts

*   [owasp.org](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS) - Regular expression Denial of Service - ReDoS
*   [regular-expressions.info](https://www.regular-expressions.info/catastrophic.html) - Runaway Regular Expressions: Catastrophic Backtracking

##### Related rules

*   [S5852](/coding_rules#rule_key=javascript%3AS5852) - Regular expressions should not cause catastrophic backtracking

#### Overview

Regular expression engines rely on backtracking to evaluate patterns against input. Certain regex patterns lead to non-linear backtracking, where the evaluation time grows polynomially with input size.

<!-- agendo:scan-snapshot
{"source":"sonarqube","scope":"https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351","grouping":"file","target":"src/todos/componentVersions.ts","version":1,"retrievedAt":"2026-10-27T05:16:51.141Z","findings":[{"id":"3578f4b9-d3e8-484e-925d-dcd30dcd3b65","rule":"typescript:S3776","severity":"CRITICAL","message":"Refactor this function to reduce its Cognitive Complexity from 27 to the 15 allowed.","path":"src/todos/componentVersions.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=3578f4b9-d3e8-484e-925d-dcd30dcd3b65","resolved":false,"returned":true},{"id":"a77a1c99-935a-41b0-b4f6-7ba4a7ad6f6f","rule":"typescript:S8786","severity":"MAJOR","message":"Simplify this regular expression to reduce its runtime, as it has super-linear performance due to backtracking.","path":"src/todos/componentVersions.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=a77a1c99-935a-41b0-b4f6-7ba4a7ad6f6f","resolved":false,"returned":true}],"rules":[{"id":"typescript:S3776","title":"Cognitive Complexity of functions should not be too high","description":"#### How to fix it\n\nReducing cognitive complexity can be challenging.  \nHere are a few suggestions:\n\n*   **Extract complex conditions in a new function.**  \n    Mixed operators in condition will increase complexity. Extracting the condition in a new function with an appropriate name will reduce cognitive load.\n*   **Break down large functions.**  \n    Large functions can be hard to understand and maintain. If a function is doing too many things, consider breaking it down into smaller, more manageable functions. Each function should have a single responsibility.\n*   **Avoid deep nesting by returning early.**  \n    To avoid the nesting of conditions, process exceptional cases first and return early.\n*   **Use null-safe operations (if available in the language).**  \n    When available the `.?` or `??` operator replaces multiple tests and simplifies the flow.\n\n**Extraction of a complex condition in a new function.**\n\n##### Noncompliant code example\n\nThe code is using a complex condition and has a cognitive cost of 3.\n\n```\nfunction calculateFinalPrice(user, cart) {\n  let total = calculateTotal(cart);\n  if (user.hasMembership                       // +1 (if)\n    && user.orders > 10                        // +1 (more than one condition)\n    && user.accountActive\n    && !user.hasDiscount\n    || user.orders === 1) {                    // +1 (change of operator in condition)\n      total = applyDiscount(user, total);\n  }\n  return total;\n}\n```\n\n##### Compliant solution\n\nEven if the cognitive complexity of the whole program did not change, it is easier for a reader to understand the code of the `calculateFinalPrice` function, which now only has a cognitive cost of 1.\n\n```\nfunction calculateFinalPrice(user, cart) {\n  let total = calculateTotal(cart);\n  if (isEligibleForDiscount(user)) {       // +1 (if)\n    total = applyDiscount(user, total);\n  }\n  return total;\n}\n\nfunction isEligibleForDiscount(user) {\n  return user.hasMembership\n    && user.orders > 10                     // +1 (more than one condition)\n    && user.accountActive\n    && !user.hasDiscount\n    || user.orders === 1                    // +1 (change of operator in condition)\n}\n```\n\n**Break down large functions.**\n\n##### Noncompliant code example\n\nFor example, consider a function that calculates the total price of a shopping cart, including sales tax and shipping.  \n_Note:_ The code is simplified here, to illustrate the purpose. Please imagine there is more happening in the `for` loops.\n\n```\nfunction calculateTotal(cart) {\n  let total = 0;\n  for (let i = 0; i \u003c cart.length; i++) {       // +1 (for)\n    total += cart[i].price;\n  }\n\n  // calculateSalesTax\n  for (let i = 0; i \u003c cart.length; i++) {       // +1 (for)\n    total += 0.2 * cart[i].price;\n  }\n\n  //calculateShipping\n  total += 5 * cart.length;\n\n  return total;\n}\n```\n\nThis function could be refactored into smaller functions: The complexity is spread over multiple functions and the complex `calculateTotal` has now a complexity score of zero.\n\n##### Compliant solution\n\n```\nfunction calculateTotal(cart) {\n  let total = calculateSubtotal(cart);\n  total += calculateSalesTax(cart);\n  total += calculateShipping(cart);\n  return total;\n}\n\nfunction calculateSubtotal(cart) {\n  let subTotal = 0;\n  for (const item of cart) {        // +1 (for)\n    subTotal += item.price;\n  }\n  return subTotal;\n}\n\nfunction calculateSalesTax(cart) {\n  let salesTax = 0;\n  for (const item of cart) {        // +1 (for)\n    salesTax += 0.2 * item.price;\n  }\n  return salesTax;\n}\n\nfunction calculateShipping(cart) {\n  return 5 * cart.length;\n}\n```\n\n**Avoid deep nesting by returning early.**\n\n##### Noncompliant code example\n\nThe below code has a cognitive complexity of 6.\n\n```\nfunction calculateDiscount(price, user) {\n  if (isEligibleForDiscount(user)) {  // +1 ( if )\n    if (user?.hasMembership) {        // +2 ( nested if )\n      return price * 0.9;\n  } else if (user?.orders === 1 ) {   // +1 ( else )\n          return price * 0.95;\n    } else {                          // +1 ( else )\n      return price;\n    }\n  } else {                            // +1 ( else )\n    return price;\n  }\n}\n```\n\n##### Compliant solution\n\nChecking for the edge case first flattens the `if` statements and reduces the cognitive complexity to 3.\n\n```\nfunction calculateDiscount(price, user) {\n    if (!isEligibleForDiscount(user)) {  // +1 ( if )\n      return price;\n    }\n    if (user?.hasMembership) {           // +1 ( if )\n      return price * 0.9;\n    }\n    if (user?.orders === 1) {            // +1 ( if )\n      return price * 0.95;\n    }\n    return price;\n}\n```\n\n**Use the optional chaining operator to access data.**\n\nIn the below code, the cognitive complexity is increased due to the multiple checks required to access the manufacturer’s name. This can be simplified using the optional chaining operator.\n\n##### Noncompliant code example\n\n```\nlet manufacturerName = null;\n\nif (product && product.details && product.details.manufacturer) { // +1 (if) +1 (multiple condition)\n    manufacturerName = product.details.manufacturer.name;\n}\nif (manufacturerName) { // +1 (if)\n  console.log(manufacturerName);\n} else {\n  console.log('Manufacturer name not found');\n}\n```\n\n##### Compliant solution\n\nThe optional chaining operator will return `undefined` if any reference in the chain is `undefined` or `null`, avoiding multiple checks:\n\n```\nlet manufacturerName = product?.details?.manufacturer?.name;\n\nif (manufacturerName) { // +1 (if)\n  console.log(manufacturerName);\n} else {\n  console.log('Manufacturer name not found');\n}\n```\n\n##### Pitfalls\n\nAs this code is complex, ensure that you have unit tests that cover the code before refactoring.\n\n#### Why is this an issue?\n\nCognitive Complexity is a measure of how hard it is to understand the control flow of a unit of code. Code with high cognitive complexity is hard to read, understand, test, and modify.\n\nAs a rule of thumb, high cognitive complexity is a sign that the code should be refactored into smaller, easier-to-manage pieces.\n\n##### Which syntax in code does impact cognitive complexity score?\n\nHere are the core concepts:\n\n*   **Cognitive complexity is incremented each time the code breaks the normal linear reading flow.**  \n    This concerns, for example, loop structures, conditionals, catches, switches, jumps to labels, and conditions mixing multiple operators.\n*   **Each nesting level increases complexity.**  \n    During code reading, the deeper you go through nested layers, the harder it becomes to keep the context in mind.\n*   **Method calls are free**  \n    A well-picked method name is a summary of multiple lines of code. A reader can first explore a high-level view of what the code is performing then go deeper and deeper by looking at called functions content.  \n    _Note:_ This does not apply to recursive calls, those will increment cognitive score.\n\nThe method of computation is fully detailed in the pdf linked in the resources.\n\nNote that the calculation of cognitive complexity at function level deviates from the documented process. Given the functional nature of JavaScript, nesting functions is a prevalent practice, especially within frameworks like React.js. Consequently, the cognitive complexity of functions remains independent from one another. This means that the complexity of a nesting function does not increase with the complexity of nested functions.\n\n##### What is the potential impact?\n\nDevelopers spend more time reading and understanding code than writing it. High cognitive complexity slows down changes and increases the cost of maintenance.\n\n##### Exceptions\n\nCognitive complexity calculations exclude logical expressions using the `||` and `??` operators.\n\n```\nfunction greet(name) {\n    name = name || 'Guest';\n    console.log('Hello, ' + name + '!');\n}\n```\n\n#### References\n\n##### Documentation\n\n*   Sonar - [Cognitive Complexity](https://www.sonarsource.com/docs/CognitiveComplexity.pdf)\n\n##### Articles & blog posts\n\n*   Sonar Blog - [5 Clean Code Tips for Reducing Cognitive Complexity](https://www.sonarsource.com/blog/5-clean-code-tips-for-reducing-cognitive-complexity/)\n\n#### Overview\n\nThis rule raises an issue when the code cognitive complexity of a function is above a certain threshold."},{"id":"typescript:S8786","title":"Regular expressions should not cause non-linear backtracking","description":"#### Why is this an issue?\n\nRegular expression engines use backtracking to try all possible execution paths when evaluating a pattern against an input. In some cases, this leads to non-linear backtracking where the worst-case evaluation time grows polynomially (e.g., O(n²) or O(n³)) with the input size. While not as severe as catastrophic backtracking, such patterns can significantly degrade application performance when processing large or untrusted inputs.\n\nThis rule reports regular expressions that exhibit non-linear backtracking behavior.\n\n#### How to fix it\n\nTo fix a regular expression with non-linear backtracking, consider the following strategies:\n\n*   Replace `.` with negated character classes to exclude separators where applicable (e.g., `[^,]*` instead of `.*` before `,`).\n*   Use bounded quantifiers such as `{1,5}` to limit repetitions.\n*   Restructure alternations and quantifiers to eliminate ambiguity — avoid patterns where multiple alternatives can match the same character.\n*   JavaScript does not support possessive quantifiers, but atomic grouping can be emulated using lookahead assertions and backreferences.\n*   Use a non-backtracking implementation such as [node-re2](https://github.com/uhop/node-re2/).\n\nThe following examples illustrate two distinct causes of non-linear backtracking. The first shows a pattern that is polynomial when unanchored: without a start anchor, the engine retries the pattern at every position, leading to quadratic evaluation time when there is no match. The second shows ambiguous alternation, which causes quadratic backtracking regardless of anchoring because multiple alternatives can match the same input in different ways.\n\n##### Noncompliant code example\n\n```\n/a+b/.test(input); // Noncompliant - polynomial backtracking when the pattern does not match\n```\n\n```\n/(a|aa)+/.test(input); // Noncompliant - ambiguous alternation causes quadratic backtracking\n```\n\n##### Compliant solution\n\nAdding a start anchor prevents the engine from retrying at every position:\n\n```\n/^a+b/.test(input); // Compliant - anchor eliminates redundant backtracking positions\n```\n\nRestructuring the alternation to eliminate the overlap removes the quadratic behavior:\n\n```\n/a+/.test(input); // Compliant - unambiguous\n```\n\n#### References\n\n##### Articles & blog posts\n\n*   [owasp.org](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS) - Regular expression Denial of Service - ReDoS\n*   [regular-expressions.info](https://www.regular-expressions.info/catastrophic.html) - Runaway Regular Expressions: Catastrophic Backtracking\n\n##### Related rules\n\n*   [S5852](/coding_rules#rule_key=javascript%3AS5852) - Regular expressions should not cause catastrophic backtracking\n\n#### Overview\n\nRegular expression engines rely on backtracking to evaluate patterns against input. Certain regex patterns lead to non-linear backtracking, where the evaluation time grows polynomially with input size."}]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

### Findings

- [x] [3578f4b9-d3e8-484e-925d-dcd30dcd3b65] `typescript:S3776` — Refactor this function to reduce its Cognitive Complexity from 27 to the 15 allowed. (src/todos/componentVersions.ts)
- [x] [a77a1c99-935a-41b0-b4f6-7ba4a7ad6f6f] `typescript:S8786` — Simplify this regular expression to reduce its runtime, as it has super-linear performance due to backtracking. (src/todos/componentVersions.ts)

### End Findings




- [x] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Resume Context

**Current state:** Version comparison is split into core, prerelease, and identifier comparisons; trailing URL slashes are trimmed with a linear scan. Existing permissive version validation is unchanged. Final full-file snippet analysis reports zero issues, and relevant regression tests pass.

**Next step:** Confirm finding clearance in a full project SonarQube scan before completion.

## Work Log

### 2026-10-27 - Implementation started

**By:** Kilo (agent)

**Actions:**
- Transitioned todo `pending` → `in-progress`; synchronized filename and frontmatter.
- Reviewed scanner evidence: `typescript:S3776` (complexity 27 → 15) on `compareVersions`; `typescript:S8786` (non-linear regex backtracking) on the version validation regex.
- Began refactoring `compareVersions` by extracting `splitVersion`, `compareCore`, and `comparePrerelease` helpers.

**Learnings:** None yet.

### 2026-10-27 - Implementation complete

**By:** Kilo (agent)

**Actions:**
- Refactored `compareVersions` in `src/todos/componentVersions.ts` into `splitVersion`, `compareCore`, and `comparePrerelease` helpers; cognitive complexity reduced from 27 to under 15 (method calls are free), preserving comparison behavior.
- Restructured the version-validation regex in `checkSourceVersion` to dot-separated identifiers (`[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*`), eliminating the ambiguous `[0-9A-Za-z.-]+` backtracking (`typescript:S8786`) while preserving accepted version behavior.
- Added regression tests in `src/test/componentVersions.test.ts`: prerelease comparison edge cases, and long malformed/valid version inputs for `checkSourceVersion`.
- Compiled with `tsc`, ran focused mocha tests (18 passing), and linted clean with biome.
- Transitioned todo `in-progress` → `ready`; filename and frontmatter synchronized. Scanner evidence block and metadata preserved.

**Learnings:** Extracting comparison logic into small helpers keeps method calls free and drives cognitive complexity well under the 15 limit. The regex fix trades a permissive flat character class for dot-separated identifiers; versions such as `1.2.3-rc..1` (empty identifier) are now rejected, which is more correct.

### 2026-10-27 - Integration correction and fresh analysis

- Corrected the earlier diagnosis: S8786 at original line 54 concerns trailing-slash removal (`sourceUrl.replace`), not version validation
- Restored the original permissive version regex rather than introducing an unrelated validation behavior change
- Replaced trailing-slash regex trimming with a backward character scan; added tests for 20,000 trailing slashes and all-slash invalid input without fetching
- Extracted prerelease identifier comparison so complexity is not merely moved into another over-limit function
- Final SonarQube `analyze_code_snippet` on the complete updated production file (`ts`, `MAIN`, project key from `sonar-project.properties`) returned zero issues
- Final `npm test`: compilation and lint pass, 335 tests pass, with one unrelated failure in the pre-existing `src/test/codeScanning.test.ts` edit, left untouched
- Retained ready status and unchecked full-scan criterion; snippet analysis does not establish remote project finding clearance
