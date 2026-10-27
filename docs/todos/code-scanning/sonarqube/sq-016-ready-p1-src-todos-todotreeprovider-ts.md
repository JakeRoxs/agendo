---
status: ready
priority: p1
issue_id: "sq-016"
tags: [code-scanning, sonarqube]
dependencies: []
scan_identity: 0dbaffc7ad1f5de360f5b29079146aef368b5c9dd383da9671fe9cbbd8ab35e0
scan_source: sonarqube
scan_scope: "https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351"
scan_grouping: file
scan_target: "src/todos/todoTreeProvider.ts"
scan_refreshed_at: "2026-10-27T16:35:51.526Z"
scan_review_required: true
---

# SonarQube: src/todos/todoTreeProvider.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-10-27T16:35:51.526Z

**Branch:** Default branch

2 reported; 0 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/todos/todoTreeProvider.ts | Line: not reported

**Rule:** typescript:S3776

**Problem:** Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed.

**Severity:** CRITICAL

[View finding be034eba-0f3c-46dc-8666-4e139d5b3449](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=be034eba-0f3c-46dc-8666-4e139d5b3449>)

#### File: src/todos/todoTreeProvider.ts | Line: not reported

**Rule:** typescript:S3776

**Problem:** Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed.

**Severity:** CRITICAL

[View finding e9ac77b4-3aba-4df4-94ea-cdbd9d169b7b](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=e9ac77b4-3aba-4df4-94ea-cdbd9d169b7b>)

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

<!-- agendo:scan-snapshot
{"source":"sonarqube","scope":"https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351","grouping":"file","target":"src/todos/todoTreeProvider.ts","version":1,"retrievedAt":"2026-10-27T16:35:51.526Z","findings":[{"id":"be034eba-0f3c-46dc-8666-4e139d5b3449","rule":"typescript:S3776","severity":"CRITICAL","message":"Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed.","path":"src/todos/todoTreeProvider.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=be034eba-0f3c-46dc-8666-4e139d5b3449","resolved":false,"returned":true},{"id":"e9ac77b4-3aba-4df4-94ea-cdbd9d169b7b","rule":"typescript:S3776","severity":"CRITICAL","message":"Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed.","path":"src/todos/todoTreeProvider.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=e9ac77b4-3aba-4df4-94ea-cdbd9d169b7b","resolved":false,"returned":true}],"rules":[{"id":"typescript:S3776","title":"Cognitive Complexity of functions should not be too high","description":"#### How to fix it\n\nReducing cognitive complexity can be challenging.  \nHere are a few suggestions:\n\n*   **Extract complex conditions in a new function.**  \n    Mixed operators in condition will increase complexity. Extracting the condition in a new function with an appropriate name will reduce cognitive load.\n*   **Break down large functions.**  \n    Large functions can be hard to understand and maintain. If a function is doing too many things, consider breaking it down into smaller, more manageable functions. Each function should have a single responsibility.\n*   **Avoid deep nesting by returning early.**  \n    To avoid the nesting of conditions, process exceptional cases first and return early.\n*   **Use null-safe operations (if available in the language).**  \n    When available the `.?` or `??` operator replaces multiple tests and simplifies the flow.\n\n**Extraction of a complex condition in a new function.**\n\n##### Noncompliant code example\n\nThe code is using a complex condition and has a cognitive cost of 3.\n\n```\nfunction calculateFinalPrice(user, cart) {\n  let total = calculateTotal(cart);\n  if (user.hasMembership                       // +1 (if)\n    && user.orders > 10                        // +1 (more than one condition)\n    && user.accountActive\n    && !user.hasDiscount\n    || user.orders === 1) {                    // +1 (change of operator in condition)\n      total = applyDiscount(user, total);\n  }\n  return total;\n}\n```\n\n##### Compliant solution\n\nEven if the cognitive complexity of the whole program did not change, it is easier for a reader to understand the code of the `calculateFinalPrice` function, which now only has a cognitive cost of 1.\n\n```\nfunction calculateFinalPrice(user, cart) {\n  let total = calculateTotal(cart);\n  if (isEligibleForDiscount(user)) {       // +1 (if)\n    total = applyDiscount(user, total);\n  }\n  return total;\n}\n\nfunction isEligibleForDiscount(user) {\n  return user.hasMembership\n    && user.orders > 10                     // +1 (more than one condition)\n    && user.accountActive\n    && !user.hasDiscount\n    || user.orders === 1                    // +1 (change of operator in condition)\n}\n```\n\n**Break down large functions.**\n\n##### Noncompliant code example\n\nFor example, consider a function that calculates the total price of a shopping cart, including sales tax and shipping.  \n_Note:_ The code is simplified here, to illustrate the purpose. Please imagine there is more happening in the `for` loops.\n\n```\nfunction calculateTotal(cart) {\n  let total = 0;\n  for (let i = 0; i \u003c cart.length; i++) {       // +1 (for)\n    total += cart[i].price;\n  }\n\n  // calculateSalesTax\n  for (let i = 0; i \u003c cart.length; i++) {       // +1 (for)\n    total += 0.2 * cart[i].price;\n  }\n\n  //calculateShipping\n  total += 5 * cart.length;\n\n  return total;\n}\n```\n\nThis function could be refactored into smaller functions: The complexity is spread over multiple functions and the complex `calculateTotal` has now a complexity score of zero.\n\n##### Compliant solution\n\n```\nfunction calculateTotal(cart) {\n  let total = calculateSubtotal(cart);\n  total += calculateSalesTax(cart);\n  total += calculateShipping(cart);\n  return total;\n}\n\nfunction calculateSubtotal(cart) {\n  let subTotal = 0;\n  for (const item of cart) {        // +1 (for)\n    subTotal += item.price;\n  }\n  return subTotal;\n}\n\nfunction calculateSalesTax(cart) {\n  let salesTax = 0;\n  for (const item of cart) {        // +1 (for)\n    salesTax += 0.2 * item.price;\n  }\n  return salesTax;\n}\n\nfunction calculateShipping(cart) {\n  return 5 * cart.length;\n}\n```\n\n**Avoid deep nesting by returning early.**\n\n##### Noncompliant code example\n\nThe below code has a cognitive complexity of 6.\n\n```\nfunction calculateDiscount(price, user) {\n  if (isEligibleForDiscount(user)) {  // +1 ( if )\n    if (user?.hasMembership) {        // +2 ( nested if )\n      return price * 0.9;\n  } else if (user?.orders === 1 ) {   // +1 ( else )\n          return price * 0.95;\n    } else {                          // +1 ( else )\n      return price;\n    }\n  } else {                            // +1 ( else )\n    return price;\n  }\n}\n```\n\n##### Compliant solution\n\nChecking for the edge case first flattens the `if` statements and reduces the cognitive complexity to 3.\n\n```\nfunction calculateDiscount(price, user) {\n    if (!isEligibleForDiscount(user)) {  // +1 ( if )\n      return price;\n    }\n    if (user?.hasMembership) {           // +1 ( if )\n      return price * 0.9;\n    }\n    if (user?.orders === 1) {            // +1 ( if )\n      return price * 0.95;\n    }\n    return price;\n}\n```\n\n**Use the optional chaining operator to access data.**\n\nIn the below code, the cognitive complexity is increased due to the multiple checks required to access the manufacturer’s name. This can be simplified using the optional chaining operator.\n\n##### Noncompliant code example\n\n```\nlet manufacturerName = null;\n\nif (product && product.details && product.details.manufacturer) { // +1 (if) +1 (multiple condition)\n    manufacturerName = product.details.manufacturer.name;\n}\nif (manufacturerName) { // +1 (if)\n  console.log(manufacturerName);\n} else {\n  console.log('Manufacturer name not found');\n}\n```\n\n##### Compliant solution\n\nThe optional chaining operator will return `undefined` if any reference in the chain is `undefined` or `null`, avoiding multiple checks:\n\n```\nlet manufacturerName = product?.details?.manufacturer?.name;\n\nif (manufacturerName) { // +1 (if)\n  console.log(manufacturerName);\n} else {\n  console.log('Manufacturer name not found');\n}\n```\n\n##### Pitfalls\n\nAs this code is complex, ensure that you have unit tests that cover the code before refactoring.\n\n#### Why is this an issue?\n\nCognitive Complexity is a measure of how hard it is to understand the control flow of a unit of code. Code with high cognitive complexity is hard to read, understand, test, and modify.\n\nAs a rule of thumb, high cognitive complexity is a sign that the code should be refactored into smaller, easier-to-manage pieces.\n\n##### Which syntax in code does impact cognitive complexity score?\n\nHere are the core concepts:\n\n*   **Cognitive complexity is incremented each time the code breaks the normal linear reading flow.**  \n    This concerns, for example, loop structures, conditionals, catches, switches, jumps to labels, and conditions mixing multiple operators.\n*   **Each nesting level increases complexity.**  \n    During code reading, the deeper you go through nested layers, the harder it becomes to keep the context in mind.\n*   **Method calls are free**  \n    A well-picked method name is a summary of multiple lines of code. A reader can first explore a high-level view of what the code is performing then go deeper and deeper by looking at called functions content.  \n    _Note:_ This does not apply to recursive calls, those will increment cognitive score.\n\nThe method of computation is fully detailed in the pdf linked in the resources.\n\nNote that the calculation of cognitive complexity at function level deviates from the documented process. Given the functional nature of JavaScript, nesting functions is a prevalent practice, especially within frameworks like React.js. Consequently, the cognitive complexity of functions remains independent from one another. This means that the complexity of a nesting function does not increase with the complexity of nested functions.\n\n##### What is the potential impact?\n\nDevelopers spend more time reading and understanding code than writing it. High cognitive complexity slows down changes and increases the cost of maintenance.\n\n##### Exceptions\n\nCognitive complexity calculations exclude logical expressions using the `||` and `??` operators.\n\n```\nfunction greet(name) {\n    name = name || 'Guest';\n    console.log('Hello, ' + name + '!');\n}\n```\n\n#### References\n\n##### Documentation\n\n*   Sonar - [Cognitive Complexity](https://www.sonarsource.com/docs/CognitiveComplexity.pdf)\n\n##### Articles & blog posts\n\n*   Sonar Blog - [5 Clean Code Tips for Reducing Cognitive Complexity](https://www.sonarsource.com/blog/5-clean-code-tips-for-reducing-cognitive-complexity/)\n\n#### Overview\n\nThis rule raises an issue when the code cognitive complexity of a function is above a certain threshold."}]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

### Findings

- [x] [be034eba-0f3c-46dc-8666-4e139d5b3449] `typescript:S3776` — Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed. (src/todos/todoTreeProvider.ts)
- [x] [e9ac77b4-3aba-4df4-94ea-cdbd9d169b7b] `typescript:S3776` — Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed. (src/todos/todoTreeProvider.ts)

### End Findings






- [x] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Resume Context

**Current state:** Both complexity findings are addressed; fresh full-file snippet analysis reports zero issues. The real extension-host suite passes all scoped-view and dependency tests, including the corrected dependency-group regression.

**Next step:** Await full-project SonarQube scan to confirm the two findings no longer fire; no clearance claimed until the project scan verifies.

## Work Log

### 2026-10-27 - Implementation started

**By:** Kilo (agent)

**Actions:**
- Transitioned todo `pending` → `in-progress`; synchronized filename and frontmatter.
- Reviewed scanner evidence: `typescript:S3776` on `getChildren` and `dependencyNodes`, both complexity 17 → 15.

**Learnings:** None yet.

### 2026-10-27 - Implementation complete

**By:** Kilo (agent)

**Actions:**
- Refactored `getChildren` in `src/todos/todoTreeProvider.ts` into a flat dispatcher (`getRootChildren`, `getSourceChildren`, `getStatusChildren`, `getPriorityChildren`) and `dependencyNodes` into `buildDependencyGroups` + `addDependencyNode`. Cognitive complexity reduced from 17 to under 15 in both functions, preserving tree grouping/order/collision/dependency behavior exactly.
- Verified with a fresh full-file SonarQube snippet analysis (0 issues), `tsc` compile (clean), `biome lint` (clean), and focused mocha tests on `scopedViews.test.ts` (6 passing; 4 pre-existing failures unrelated to this change).
- Transitioned todo `in-progress` → `ready`; filename and frontmatter synchronized. Scanner evidence block and metadata preserved.

**Learnings:** Extracting the tree-building logic into small, single-purpose helpers keeps method calls free and drives each function's cognitive complexity under the 15 limit without altering the rendered tree structure.

### 2026-10-27 - Real extension-host integration verification

- The earlier mock-harness results are not the final verification baseline; real VS Code execution caught the new regression skipping the scanner-source tree level
- Corrected test navigation to source -> status -> priority -> dependency; no production behavior change was needed
- Final `npm test`: compilation and lint pass, 342 tests pass, including every scoped-view and dependency regression; one unrelated failure remains in the unchanged user-owned scanner-title fixture/assertion mismatch
- The earlier repository timeout and cascading activation mock failure did not recur in the final run
- Removed temporary root-level mock/hook test artifacts; `git diff --check` passes
- Retained ready and unchecked full-project scan criterion; no remote clearance claimed
