---
status: in-progress
priority: p1
issue_id: "sq-023"
tags: [code-scanning, sonarqube]
dependencies: []
scan_identity: fc3fa453c8fd94ca04b4d19212df9d422a32c5e9b9017065404363d037018b2b
scan_source: sonarqube
scan_scope: "https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351"
scan_grouping: file
scan_target: "src/todos/rootRegistry.ts"
scan_refreshed_at: "2026-11-26T10:07:09.106Z"
scan_review_required: false
---

# src/todos/rootRegistry.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-11-26T10:07:09.106Z

**Branch:** Default branch

3 reported; 0 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/todos/rootRegistry.ts | Line: not reported

**Rule:** typescript:S3776

**Problem:** Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed.

**Severity:** CRITICAL

[View finding 40276c4d-8e8a-4eae-81c3-f0644511e022](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=40276c4d-8e8a-4eae-81c3-f0644511e022>)

#### File: src/todos/rootRegistry.ts | Line: not reported

**Rule:** typescript:S8786

**Problem:** Simplify this regular expression to reduce its runtime, as it has super-linear performance due to backtracking.

**Severity:** MAJOR

[View finding 5755bbfc-7cd3-4521-a0e6-5c5b615dd4ab](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=5755bbfc-7cd3-4521-a0e6-5c5b615dd4ab>)

#### File: src/todos/rootRegistry.ts | Line: not reported

**Rule:** typescript:S2933

**Problem:** Mark these members as \`readonly\`.

**Severity:** MAJOR

[View finding 9c1cfd29-532b-4bd2-bd83-3ce73d30e35e](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=9c1cfd29-532b-4bd2-bd83-3ce73d30e35e>)

### Rule: Fields that are only assigned in the constructor should be "readonly"

**Rule ID:** typescript:S2933

#### References

##### Documentation

*   [typescript-eslint](https://typescript-eslint.io/) - Rule [prefer-readonly](https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/docs/rules/prefer-readonly.mdx)
*   TypeScript Documentation - [readonly](https://www.typescriptlang.org/docs/handbook/2/classes.html#readonly)

#### How to fix it

Mark the given field with the `readonly` modifier.

For JavaScript and TypeScript, [S2933](/coding_rules#rule_key=javascript%3AS2933) reports one issue per class and uses secondary locations for each field that should be marked `readonly`.

##### Noncompliant code example

```
class Person { // Noncompliant: Mark this member as `readonly`.
  private birthYear: number;

  constructor(birthYear: number) {
    this.birthYear = birthYear;
  }
}
```

##### Compliant solution

```
class Person {
  private readonly birthYear: number;

  constructor(birthYear: number) {
    this.birthYear = birthYear;
  }
}
```

When more than one field in the same class should be marked `readonly`, the issue remains on the class and each affected field is listed as a secondary location.

```
class Person { // Noncompliant: Mark these members as `readonly`.
  private birthYear: number;
  private age: number;

  constructor(birthYear: number, age: number) {
    this.birthYear = birthYear;
    this.age = age;
  }
}
```

```
class Person {
  private readonly birthYear: number;
  private readonly age: number;

  constructor(birthYear: number, age: number) {
    this.birthYear = birthYear;
    this.age = age;
  }
}
```

#### Why is this an issue?

`readonly` fields can only be assigned in a class constructor. If a class has a field that’s not marked `readonly` but is only set in the constructor, it could cause confusion about the field’s intended use. To avoid confusion, such fields should be marked `readonly` to make their intended use explicit, and to prevent future maintainers from inadvertently changing their use.

### Rule: Cognitive Complexity of functions should not be too high

**Rule ID:** typescript:S3776

#### References

##### Documentation

*   Sonar - [Cognitive Complexity](https://www.sonarsource.com/docs/CognitiveComplexity.pdf)

##### Articles & blog posts

*   Sonar Blog - [5 Clean Code Tips for Reducing Cognitive Complexity](https://www.sonarsource.com/blog/5-clean-code-tips-for-reducing-cognitive-complexity/)

#### Overview

This rule raises an issue when the code cognitive complexity of a function is above a certain threshold.

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

### Rule: Regular expressions should not cause non-linear backtracking

**Rule ID:** typescript:S8786

#### Overview

Regular expression engines rely on backtracking to evaluate patterns against input. Certain regex patterns lead to non-linear backtracking, where the evaluation time grows polynomially with input size.

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

<!-- agendo:scan-snapshot
{"source":"sonarqube","scope":"https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351","grouping":"file","target":"src/todos/rootRegistry.ts","version":1,"retrievedAt":"2026-11-26T10:07:09.106Z","findings":[{"id":"40276c4d-8e8a-4eae-81c3-f0644511e022","rule":"typescript:S3776","severity":"CRITICAL","message":"Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed.","path":"src/todos/rootRegistry.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=40276c4d-8e8a-4eae-81c3-f0644511e022","resolved":false,"returned":true},{"id":"5755bbfc-7cd3-4521-a0e6-5c5b615dd4ab","rule":"typescript:S8786","severity":"MAJOR","message":"Simplify this regular expression to reduce its runtime, as it has super-linear performance due to backtracking.","path":"src/todos/rootRegistry.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=5755bbfc-7cd3-4521-a0e6-5c5b615dd4ab","resolved":false,"returned":true},{"id":"9c1cfd29-532b-4bd2-bd83-3ce73d30e35e","rule":"typescript:S2933","severity":"MAJOR","message":"Mark these members as `readonly`.","path":"src/todos/rootRegistry.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=9c1cfd29-532b-4bd2-bd83-3ce73d30e35e","resolved":false,"returned":true}],"rules":[{"id":"typescript:S2933","title":"Fields that are only assigned in the constructor should be \"readonly\"","description":"#### References\n\n##### Documentation\n\n*   [typescript-eslint](https://typescript-eslint.io/) - Rule [prefer-readonly](https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/docs/rules/prefer-readonly.mdx)\n*   TypeScript Documentation - [readonly](https://www.typescriptlang.org/docs/handbook/2/classes.html#readonly)\n\n#### How to fix it\n\nMark the given field with the `readonly` modifier.\n\nFor JavaScript and TypeScript, [S2933](/coding_rules#rule_key=javascript%3AS2933) reports one issue per class and uses secondary locations for each field that should be marked `readonly`.\n\n##### Noncompliant code example\n\n```\nclass Person { // Noncompliant: Mark this member as `readonly`.\n  private birthYear: number;\n\n  constructor(birthYear: number) {\n    this.birthYear = birthYear;\n  }\n}\n```\n\n##### Compliant solution\n\n```\nclass Person {\n  private readonly birthYear: number;\n\n  constructor(birthYear: number) {\n    this.birthYear = birthYear;\n  }\n}\n```\n\nWhen more than one field in the same class should be marked `readonly`, the issue remains on the class and each affected field is listed as a secondary location.\n\n```\nclass Person { // Noncompliant: Mark these members as `readonly`.\n  private birthYear: number;\n  private age: number;\n\n  constructor(birthYear: number, age: number) {\n    this.birthYear = birthYear;\n    this.age = age;\n  }\n}\n```\n\n```\nclass Person {\n  private readonly birthYear: number;\n  private readonly age: number;\n\n  constructor(birthYear: number, age: number) {\n    this.birthYear = birthYear;\n    this.age = age;\n  }\n}\n```\n\n#### Why is this an issue?\n\n`readonly` fields can only be assigned in a class constructor. If a class has a field that’s not marked `readonly` but is only set in the constructor, it could cause confusion about the field’s intended use. To avoid confusion, such fields should be marked `readonly` to make their intended use explicit, and to prevent future maintainers from inadvertently changing their use."},{"id":"typescript:S3776","title":"Cognitive Complexity of functions should not be too high","description":"#### References\n\n##### Documentation\n\n*   Sonar - [Cognitive Complexity](https://www.sonarsource.com/docs/CognitiveComplexity.pdf)\n\n##### Articles & blog posts\n\n*   Sonar Blog - [5 Clean Code Tips for Reducing Cognitive Complexity](https://www.sonarsource.com/blog/5-clean-code-tips-for-reducing-cognitive-complexity/)\n\n#### Overview\n\nThis rule raises an issue when the code cognitive complexity of a function is above a certain threshold.\n\n#### How to fix it\n\nReducing cognitive complexity can be challenging.  \nHere are a few suggestions:\n\n*   **Extract complex conditions in a new function.**  \n    Mixed operators in condition will increase complexity. Extracting the condition in a new function with an appropriate name will reduce cognitive load.\n*   **Break down large functions.**  \n    Large functions can be hard to understand and maintain. If a function is doing too many things, consider breaking it down into smaller, more manageable functions. Each function should have a single responsibility.\n*   **Avoid deep nesting by returning early.**  \n    To avoid the nesting of conditions, process exceptional cases first and return early.\n*   **Use null-safe operations (if available in the language).**  \n    When available the `.?` or `??` operator replaces multiple tests and simplifies the flow.\n\n**Extraction of a complex condition in a new function.**\n\n##### Noncompliant code example\n\nThe code is using a complex condition and has a cognitive cost of 3.\n\n```\nfunction calculateFinalPrice(user, cart) {\n  let total = calculateTotal(cart);\n  if (user.hasMembership                       // +1 (if)\n    && user.orders > 10                        // +1 (more than one condition)\n    && user.accountActive\n    && !user.hasDiscount\n    || user.orders === 1) {                    // +1 (change of operator in condition)\n      total = applyDiscount(user, total);\n  }\n  return total;\n}\n```\n\n##### Compliant solution\n\nEven if the cognitive complexity of the whole program did not change, it is easier for a reader to understand the code of the `calculateFinalPrice` function, which now only has a cognitive cost of 1.\n\n```\nfunction calculateFinalPrice(user, cart) {\n  let total = calculateTotal(cart);\n  if (isEligibleForDiscount(user)) {       // +1 (if)\n    total = applyDiscount(user, total);\n  }\n  return total;\n}\n\nfunction isEligibleForDiscount(user) {\n  return user.hasMembership\n    && user.orders > 10                     // +1 (more than one condition)\n    && user.accountActive\n    && !user.hasDiscount\n    || user.orders === 1                    // +1 (change of operator in condition)\n}\n```\n\n**Break down large functions.**\n\n##### Noncompliant code example\n\nFor example, consider a function that calculates the total price of a shopping cart, including sales tax and shipping.  \n_Note:_ The code is simplified here, to illustrate the purpose. Please imagine there is more happening in the `for` loops.\n\n```\nfunction calculateTotal(cart) {\n  let total = 0;\n  for (let i = 0; i \u003c cart.length; i++) {       // +1 (for)\n    total += cart[i].price;\n  }\n\n  // calculateSalesTax\n  for (let i = 0; i \u003c cart.length; i++) {       // +1 (for)\n    total += 0.2 * cart[i].price;\n  }\n\n  //calculateShipping\n  total += 5 * cart.length;\n\n  return total;\n}\n```\n\nThis function could be refactored into smaller functions: The complexity is spread over multiple functions and the complex `calculateTotal` has now a complexity score of zero.\n\n##### Compliant solution\n\n```\nfunction calculateTotal(cart) {\n  let total = calculateSubtotal(cart);\n  total += calculateSalesTax(cart);\n  total += calculateShipping(cart);\n  return total;\n}\n\nfunction calculateSubtotal(cart) {\n  let subTotal = 0;\n  for (const item of cart) {        // +1 (for)\n    subTotal += item.price;\n  }\n  return subTotal;\n}\n\nfunction calculateSalesTax(cart) {\n  let salesTax = 0;\n  for (const item of cart) {        // +1 (for)\n    salesTax += 0.2 * item.price;\n  }\n  return salesTax;\n}\n\nfunction calculateShipping(cart) {\n  return 5 * cart.length;\n}\n```\n\n**Avoid deep nesting by returning early.**\n\n##### Noncompliant code example\n\nThe below code has a cognitive complexity of 6.\n\n```\nfunction calculateDiscount(price, user) {\n  if (isEligibleForDiscount(user)) {  // +1 ( if )\n    if (user?.hasMembership) {        // +2 ( nested if )\n      return price * 0.9;\n  } else if (user?.orders === 1 ) {   // +1 ( else )\n          return price * 0.95;\n    } else {                          // +1 ( else )\n      return price;\n    }\n  } else {                            // +1 ( else )\n    return price;\n  }\n}\n```\n\n##### Compliant solution\n\nChecking for the edge case first flattens the `if` statements and reduces the cognitive complexity to 3.\n\n```\nfunction calculateDiscount(price, user) {\n    if (!isEligibleForDiscount(user)) {  // +1 ( if )\n      return price;\n    }\n    if (user?.hasMembership) {           // +1 ( if )\n      return price * 0.9;\n    }\n    if (user?.orders === 1) {            // +1 ( if )\n      return price * 0.95;\n    }\n    return price;\n}\n```\n\n**Use the optional chaining operator to access data.**\n\nIn the below code, the cognitive complexity is increased due to the multiple checks required to access the manufacturer’s name. This can be simplified using the optional chaining operator.\n\n##### Noncompliant code example\n\n```\nlet manufacturerName = null;\n\nif (product && product.details && product.details.manufacturer) { // +1 (if) +1 (multiple condition)\n    manufacturerName = product.details.manufacturer.name;\n}\nif (manufacturerName) { // +1 (if)\n  console.log(manufacturerName);\n} else {\n  console.log('Manufacturer name not found');\n}\n```\n\n##### Compliant solution\n\nThe optional chaining operator will return `undefined` if any reference in the chain is `undefined` or `null`, avoiding multiple checks:\n\n```\nlet manufacturerName = product?.details?.manufacturer?.name;\n\nif (manufacturerName) { // +1 (if)\n  console.log(manufacturerName);\n} else {\n  console.log('Manufacturer name not found');\n}\n```\n\n##### Pitfalls\n\nAs this code is complex, ensure that you have unit tests that cover the code before refactoring.\n\n#### Why is this an issue?\n\nCognitive Complexity is a measure of how hard it is to understand the control flow of a unit of code. Code with high cognitive complexity is hard to read, understand, test, and modify.\n\nAs a rule of thumb, high cognitive complexity is a sign that the code should be refactored into smaller, easier-to-manage pieces.\n\n##### Which syntax in code does impact cognitive complexity score?\n\nHere are the core concepts:\n\n*   **Cognitive complexity is incremented each time the code breaks the normal linear reading flow.**  \n    This concerns, for example, loop structures, conditionals, catches, switches, jumps to labels, and conditions mixing multiple operators.\n*   **Each nesting level increases complexity.**  \n    During code reading, the deeper you go through nested layers, the harder it becomes to keep the context in mind.\n*   **Method calls are free**  \n    A well-picked method name is a summary of multiple lines of code. A reader can first explore a high-level view of what the code is performing then go deeper and deeper by looking at called functions content.  \n    _Note:_ This does not apply to recursive calls, those will increment cognitive score.\n\nThe method of computation is fully detailed in the pdf linked in the resources.\n\nNote that the calculation of cognitive complexity at function level deviates from the documented process. Given the functional nature of JavaScript, nesting functions is a prevalent practice, especially within frameworks like React.js. Consequently, the cognitive complexity of functions remains independent from one another. This means that the complexity of a nesting function does not increase with the complexity of nested functions.\n\n##### What is the potential impact?\n\nDevelopers spend more time reading and understanding code than writing it. High cognitive complexity slows down changes and increases the cost of maintenance.\n\n##### Exceptions\n\nCognitive complexity calculations exclude logical expressions using the `||` and `??` operators.\n\n```\nfunction greet(name) {\n    name = name || 'Guest';\n    console.log('Hello, ' + name + '!');\n}\n```"},{"id":"typescript:S8786","title":"Regular expressions should not cause non-linear backtracking","description":"#### Overview\n\nRegular expression engines rely on backtracking to evaluate patterns against input. Certain regex patterns lead to non-linear backtracking, where the evaluation time grows polynomially with input size.\n\n#### Why is this an issue?\n\nRegular expression engines use backtracking to try all possible execution paths when evaluating a pattern against an input. In some cases, this leads to non-linear backtracking where the worst-case evaluation time grows polynomially (e.g., O(n²) or O(n³)) with the input size. While not as severe as catastrophic backtracking, such patterns can significantly degrade application performance when processing large or untrusted inputs.\n\nThis rule reports regular expressions that exhibit non-linear backtracking behavior.\n\n#### How to fix it\n\nTo fix a regular expression with non-linear backtracking, consider the following strategies:\n\n*   Replace `.` with negated character classes to exclude separators where applicable (e.g., `[^,]*` instead of `.*` before `,`).\n*   Use bounded quantifiers such as `{1,5}` to limit repetitions.\n*   Restructure alternations and quantifiers to eliminate ambiguity — avoid patterns where multiple alternatives can match the same character.\n*   JavaScript does not support possessive quantifiers, but atomic grouping can be emulated using lookahead assertions and backreferences.\n*   Use a non-backtracking implementation such as [node-re2](https://github.com/uhop/node-re2/).\n\nThe following examples illustrate two distinct causes of non-linear backtracking. The first shows a pattern that is polynomial when unanchored: without a start anchor, the engine retries the pattern at every position, leading to quadratic evaluation time when there is no match. The second shows ambiguous alternation, which causes quadratic backtracking regardless of anchoring because multiple alternatives can match the same input in different ways.\n\n##### Noncompliant code example\n\n```\n/a+b/.test(input); // Noncompliant - polynomial backtracking when the pattern does not match\n```\n\n```\n/(a|aa)+/.test(input); // Noncompliant - ambiguous alternation causes quadratic backtracking\n```\n\n##### Compliant solution\n\nAdding a start anchor prevents the engine from retrying at every position:\n\n```\n/^a+b/.test(input); // Compliant - anchor eliminates redundant backtracking positions\n```\n\nRestructuring the alternation to eliminate the overlap removes the quadratic behavior:\n\n```\n/a+/.test(input); // Compliant - unambiguous\n```\n\n#### References\n\n##### Articles & blog posts\n\n*   [owasp.org](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS) - Regular expression Denial of Service - ReDoS\n*   [regular-expressions.info](https://www.regular-expressions.info/catastrophic.html) - Runaway Regular Expressions: Catastrophic Backtracking\n\n##### Related rules\n\n*   [S5852](/coding_rules#rule_key=javascript%3AS5852) - Regular expressions should not cause catastrophic backtracking"}]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

- [ ] **Next:** Identify which function triggered S3776 and assess/refactor it if needed. Only after that review, request a fresh full scan to verify remaining findings.

### Findings

- [ ] [40276c4d-8e8a-4eae-81c3-f0644511e022] `typescript:S3776` — Unclear: imported finding has no line/function location and no function-level complexity analysis was performed. (src/todos/rootRegistry.ts)
- [ ] [5755bbfc-7cd3-4521-a0e6-5c5b615dd4ab] `typescript:S8786` — Simplified nested prefix alternation in todo ID regex to `(?:cql-|sq-)?`; behavior preserves valid ID forms. (src/todos/rootRegistry.ts)
- [ ] [9c1cfd29-532b-4bd2-bd83-3ce73d30e35e] `typescript:S2933` — Current constructor-only class references (`config`, `workspaceState`, `onDidChangeEmitter`) are readonly; intentional mutable fields are reassigned by methods. (src/todos/rootRegistry.ts)

### End Findings


- [ ] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Work Log

- 2026-11-26: Simplified the todo-ID matcher and reviewed readonly declarations. S3776 remains unclear because imported evidence omits the affected function; fresh scan needed to establish whether actionable. Historical results are not scan clearance.
- Validation: `npm test -- --grep "root registry"` passed (563 passing); `npm run compile` passed; `git diff --check` passed.

## Resume Context

**Current state:** S8786 regex simplification and readonly fields were locally reviewed. S3776 is not understood because imported evidence omits the affected function; this is unresolved code-review work.
**Next step:** Locate/identify the S3776 function and determine whether a refactor is needed. Keep in progress until understood; then run a fresh full scan before closure.
