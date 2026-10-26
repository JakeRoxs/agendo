---
status: pending
priority: p1
issue_id: "sq-008"
tags: [code-scanning, sonarqube]
dependencies: []
scan_identity: d8e47ed6efaed4bd0e32b787b78385638afe2bc6ced15f3e8f87a6835fee7b14
scan_source: sonarqube
scan_scope: "https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351"
scan_grouping: file
scan_target: "src/todos/accomplishmentsService.ts"
scan_refreshed_at: "2026-10-26T22:08:57.489Z"
scan_review_required: false
---

# SonarQube: src/todos/accomplishmentsService.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-10-26T22:08:57.489Z

**Branch:** Default branch

9 reported; 0 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/todos/accomplishmentsService.ts | Line: 128

**Rule:** typescript:S7778

**Problem:** Do not call \`Array\#push()\` multiple times.

**Severity:** MINOR

[View finding 10463588-2eae-4c4d-96d5-aa15e32ec8dc](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=10463588-2eae-4c4d-96d5-aa15e32ec8dc>)

#### File: src/todos/accomplishmentsService.ts | Line: 84

**Rule:** typescript:S7778

**Problem:** Do not call \`Array\#push()\` multiple times.

**Severity:** MINOR

[View finding 324758fc-0623-4cbf-a360-41ba3e48a043](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=324758fc-0623-4cbf-a360-41ba3e48a043>)

#### File: src/todos/accomplishmentsService.ts | Line: 129

**Rule:** typescript:S7778

**Problem:** Do not call \`Array\#push()\` multiple times.

**Severity:** MINOR

[View finding 3a18a529-6421-4c73-bd1a-bbcc57a6b4b5](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=3a18a529-6421-4c73-bd1a-bbcc57a6b4b5>)

#### File: src/todos/accomplishmentsService.ts | Line: 43

**Rule:** typescript:S3776

**Problem:** Refactor this function to reduce its Cognitive Complexity from 23 to the 15 allowed.

**Severity:** CRITICAL

[View finding 4e53bffa-8c94-4ecb-ab05-d2da3764fad6](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=4e53bffa-8c94-4ecb-ab05-d2da3764fad6>)

#### File: src/todos/accomplishmentsService.ts | Line: 89

**Rule:** typescript:S3776

**Problem:** Refactor this function to reduce its Cognitive Complexity from 20 to the 15 allowed.

**Severity:** CRITICAL

[View finding 7eb74d76-ac44-439a-8099-dafc513dbbd3](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=7eb74d76-ac44-439a-8099-dafc513dbbd3>)

#### File: src/todos/accomplishmentsService.ts | Line: 132

**Rule:** typescript:S7778

**Problem:** Do not call \`Array\#push()\` multiple times.

**Severity:** MINOR

[View finding 94415a74-19bd-4218-bb03-dd767895d051](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=94415a74-19bd-4218-bb03-dd767895d051>)

#### File: src/todos/accomplishmentsService.ts | Line: 133

**Rule:** typescript:S7778

**Problem:** Do not call \`Array\#push()\` multiple times.

**Severity:** MINOR

[View finding a1fc7ceb-440c-42c2-a61a-0afcea82cdf5](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=a1fc7ceb-440c-42c2-a61a-0afcea82cdf5>)

#### File: src/todos/accomplishmentsService.ts | Line: 134

**Rule:** typescript:S7778

**Problem:** Do not call \`Array\#push()\` multiple times.

**Severity:** MINOR

[View finding cc189b25-4ca4-4d92-aa2a-4250cf7472cc](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=cc189b25-4ca4-4d92-aa2a-4250cf7472cc>)

#### File: src/todos/accomplishmentsService.ts | Line: 69

**Rule:** typescript:S7778

**Problem:** Do not call \`Array\#push()\` multiple times.

**Severity:** MINOR

[View finding f051d49b-3743-41da-84d9-7698e04bbbda](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=f051d49b-3743-41da-84d9-7698e04bbbda>)

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

### Rule: Multiple consecutive calls to methods that accept multiple arguments should be combined

**Rule ID:** typescript:S7778

#### Overview

This rule raises an issue when multiple consecutive calls are made to `Array#push()`, `Element#classList.add()`, `Element#classList.remove()`, or `importScripts()` on the same object.

#### Why is this an issue?

Making multiple consecutive calls to methods that accept multiple arguments creates unnecessary overhead and reduces code readability.

Methods like `Array#push()`, `Element#classList.add()`, `Element#classList.remove()`, and `importScripts()` are designed to accept multiple arguments in a single call. When you make multiple separate calls instead of one combined call, you create several issues:

*   **Performance overhead**: Each method call has a small performance cost. Multiple calls mean multiple function invocations, parameter processing, and potential DOM updates (for classList methods).
*   **Reduced readability**: Multiple lines doing similar operations make the code longer and harder to scan quickly.
*   **Inconsistent patterns**: Using single calls when multiple arguments are supported goes against the intended API design.

For example, calling `array.push(1); array.push(2);` requires two separate function calls, while `array.push(1, 2)` accomplishes the same result with one call. Similarly, `element.classList.add('foo'); element.classList.add('bar');` triggers two DOM updates, while `element.classList.add('foo', 'bar')` can be optimized by the browser into a single update.

##### What is the potential impact?

The impact is primarily on code maintainability and minor performance improvements. While the performance gain from combining calls is usually small, it can be noticeable in performance-critical code or when dealing with many DOM manipulations. The main benefit is improved code readability and consistency with JavaScript API best practices.

##### How to fix?

Combine multiple consecutive `Array#push()` calls into a single call with multiple arguments.

##### Non-compliant code example

```
const items = [];
items.push(1); // Noncompliant
items.push(2, 3); // Noncompliant
```

##### Compliant code example

```
const items = [];
items.push(1, 2, 3);
```

##### How to fix in Web Workers?

Combine multiple consecutive `importScripts()` calls into a single call.

##### Non-compliant code example

```
importScripts('https://example.com/lib1.js'); // Noncompliant
importScripts('https://example.com/lib2.js'); // Noncompliant
```

##### Compliant code example

```
importScripts(
  'https://example.com/lib1.js',
  'https://example.com/lib2.js'
);
```

##### Documentation

*   [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn#readme) - Rule [prefer-single-call](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/HEAD/docs/rules/prefer-single-call.md)
*   Array.prototype.push() - MDN - [Documentation for the Array push method that accepts multiple arguments](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push)
*   Element.classList - MDN - [Documentation for the classList API including add() and remove() methods](https://developer.mozilla.org/en-US/docs/Web/API/Element/classList)
*   WorkerGlobalScope.importScripts() - MDN - [Documentation for the importScripts method in Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/importScripts)

<!-- agendo:scan-snapshot
{"source":"sonarqube","scope":"https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351","grouping":"file","target":"src/todos/accomplishmentsService.ts","version":1,"retrievedAt":"2026-10-26T22:08:57.489Z","findings":[{"id":"10463588-2eae-4c4d-96d5-aa15e32ec8dc","rule":"typescript:S7778","severity":"MINOR","message":"Do not call `Array#push()` multiple times.","path":"src/todos/accomplishmentsService.ts","line":128,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=10463588-2eae-4c4d-96d5-aa15e32ec8dc","returned":true},{"id":"324758fc-0623-4cbf-a360-41ba3e48a043","rule":"typescript:S7778","severity":"MINOR","message":"Do not call `Array#push()` multiple times.","path":"src/todos/accomplishmentsService.ts","line":84,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=324758fc-0623-4cbf-a360-41ba3e48a043","returned":true},{"id":"3a18a529-6421-4c73-bd1a-bbcc57a6b4b5","rule":"typescript:S7778","severity":"MINOR","message":"Do not call `Array#push()` multiple times.","path":"src/todos/accomplishmentsService.ts","line":129,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=3a18a529-6421-4c73-bd1a-bbcc57a6b4b5","returned":true},{"id":"4e53bffa-8c94-4ecb-ab05-d2da3764fad6","rule":"typescript:S3776","severity":"CRITICAL","message":"Refactor this function to reduce its Cognitive Complexity from 23 to the 15 allowed.","path":"src/todos/accomplishmentsService.ts","line":43,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=4e53bffa-8c94-4ecb-ab05-d2da3764fad6","returned":true},{"id":"7eb74d76-ac44-439a-8099-dafc513dbbd3","rule":"typescript:S3776","severity":"CRITICAL","message":"Refactor this function to reduce its Cognitive Complexity from 20 to the 15 allowed.","path":"src/todos/accomplishmentsService.ts","line":89,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=7eb74d76-ac44-439a-8099-dafc513dbbd3","returned":true},{"id":"94415a74-19bd-4218-bb03-dd767895d051","rule":"typescript:S7778","severity":"MINOR","message":"Do not call `Array#push()` multiple times.","path":"src/todos/accomplishmentsService.ts","line":132,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=94415a74-19bd-4218-bb03-dd767895d051","returned":true},{"id":"a1fc7ceb-440c-42c2-a61a-0afcea82cdf5","rule":"typescript:S7778","severity":"MINOR","message":"Do not call `Array#push()` multiple times.","path":"src/todos/accomplishmentsService.ts","line":133,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=a1fc7ceb-440c-42c2-a61a-0afcea82cdf5","returned":true},{"id":"cc189b25-4ca4-4d92-aa2a-4250cf7472cc","rule":"typescript:S7778","severity":"MINOR","message":"Do not call `Array#push()` multiple times.","path":"src/todos/accomplishmentsService.ts","line":134,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=cc189b25-4ca4-4d92-aa2a-4250cf7472cc","returned":true},{"id":"f051d49b-3743-41da-84d9-7698e04bbbda","rule":"typescript:S7778","severity":"MINOR","message":"Do not call `Array#push()` multiple times.","path":"src/todos/accomplishmentsService.ts","line":69,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=f051d49b-3743-41da-84d9-7698e04bbbda","returned":true}],"rules":[{"id":"typescript:S3776","title":"Cognitive Complexity of functions should not be too high","description":"#### How to fix it\n\nReducing cognitive complexity can be challenging.  \nHere are a few suggestions:\n\n*   **Extract complex conditions in a new function.**  \n    Mixed operators in condition will increase complexity. Extracting the condition in a new function with an appropriate name will reduce cognitive load.\n*   **Break down large functions.**  \n    Large functions can be hard to understand and maintain. If a function is doing too many things, consider breaking it down into smaller, more manageable functions. Each function should have a single responsibility.\n*   **Avoid deep nesting by returning early.**  \n    To avoid the nesting of conditions, process exceptional cases first and return early.\n*   **Use null-safe operations (if available in the language).**  \n    When available the `.?` or `??` operator replaces multiple tests and simplifies the flow.\n\n**Extraction of a complex condition in a new function.**\n\n##### Noncompliant code example\n\nThe code is using a complex condition and has a cognitive cost of 3.\n\n```\nfunction calculateFinalPrice(user, cart) {\n  let total = calculateTotal(cart);\n  if (user.hasMembership                       // +1 (if)\n    && user.orders > 10                        // +1 (more than one condition)\n    && user.accountActive\n    && !user.hasDiscount\n    || user.orders === 1) {                    // +1 (change of operator in condition)\n      total = applyDiscount(user, total);\n  }\n  return total;\n}\n```\n\n##### Compliant solution\n\nEven if the cognitive complexity of the whole program did not change, it is easier for a reader to understand the code of the `calculateFinalPrice` function, which now only has a cognitive cost of 1.\n\n```\nfunction calculateFinalPrice(user, cart) {\n  let total = calculateTotal(cart);\n  if (isEligibleForDiscount(user)) {       // +1 (if)\n    total = applyDiscount(user, total);\n  }\n  return total;\n}\n\nfunction isEligibleForDiscount(user) {\n  return user.hasMembership\n    && user.orders > 10                     // +1 (more than one condition)\n    && user.accountActive\n    && !user.hasDiscount\n    || user.orders === 1                    // +1 (change of operator in condition)\n}\n```\n\n**Break down large functions.**\n\n##### Noncompliant code example\n\nFor example, consider a function that calculates the total price of a shopping cart, including sales tax and shipping.  \n_Note:_ The code is simplified here, to illustrate the purpose. Please imagine there is more happening in the `for` loops.\n\n```\nfunction calculateTotal(cart) {\n  let total = 0;\n  for (let i = 0; i \u003c cart.length; i++) {       // +1 (for)\n    total += cart[i].price;\n  }\n\n  // calculateSalesTax\n  for (let i = 0; i \u003c cart.length; i++) {       // +1 (for)\n    total += 0.2 * cart[i].price;\n  }\n\n  //calculateShipping\n  total += 5 * cart.length;\n\n  return total;\n}\n```\n\nThis function could be refactored into smaller functions: The complexity is spread over multiple functions and the complex `calculateTotal` has now a complexity score of zero.\n\n##### Compliant solution\n\n```\nfunction calculateTotal(cart) {\n  let total = calculateSubtotal(cart);\n  total += calculateSalesTax(cart);\n  total += calculateShipping(cart);\n  return total;\n}\n\nfunction calculateSubtotal(cart) {\n  let subTotal = 0;\n  for (const item of cart) {        // +1 (for)\n    subTotal += item.price;\n  }\n  return subTotal;\n}\n\nfunction calculateSalesTax(cart) {\n  let salesTax = 0;\n  for (const item of cart) {        // +1 (for)\n    salesTax += 0.2 * item.price;\n  }\n  return salesTax;\n}\n\nfunction calculateShipping(cart) {\n  return 5 * cart.length;\n}\n```\n\n**Avoid deep nesting by returning early.**\n\n##### Noncompliant code example\n\nThe below code has a cognitive complexity of 6.\n\n```\nfunction calculateDiscount(price, user) {\n  if (isEligibleForDiscount(user)) {  // +1 ( if )\n    if (user?.hasMembership) {        // +2 ( nested if )\n      return price * 0.9;\n  } else if (user?.orders === 1 ) {   // +1 ( else )\n          return price * 0.95;\n    } else {                          // +1 ( else )\n      return price;\n    }\n  } else {                            // +1 ( else )\n    return price;\n  }\n}\n```\n\n##### Compliant solution\n\nChecking for the edge case first flattens the `if` statements and reduces the cognitive complexity to 3.\n\n```\nfunction calculateDiscount(price, user) {\n    if (!isEligibleForDiscount(user)) {  // +1 ( if )\n      return price;\n    }\n    if (user?.hasMembership) {           // +1 ( if )\n      return price * 0.9;\n    }\n    if (user?.orders === 1) {            // +1 ( if )\n      return price * 0.95;\n    }\n    return price;\n}\n```\n\n**Use the optional chaining operator to access data.**\n\nIn the below code, the cognitive complexity is increased due to the multiple checks required to access the manufacturer’s name. This can be simplified using the optional chaining operator.\n\n##### Noncompliant code example\n\n```\nlet manufacturerName = null;\n\nif (product && product.details && product.details.manufacturer) { // +1 (if) +1 (multiple condition)\n    manufacturerName = product.details.manufacturer.name;\n}\nif (manufacturerName) { // +1 (if)\n  console.log(manufacturerName);\n} else {\n  console.log('Manufacturer name not found');\n}\n```\n\n##### Compliant solution\n\nThe optional chaining operator will return `undefined` if any reference in the chain is `undefined` or `null`, avoiding multiple checks:\n\n```\nlet manufacturerName = product?.details?.manufacturer?.name;\n\nif (manufacturerName) { // +1 (if)\n  console.log(manufacturerName);\n} else {\n  console.log('Manufacturer name not found');\n}\n```\n\n##### Pitfalls\n\nAs this code is complex, ensure that you have unit tests that cover the code before refactoring.\n\n#### Why is this an issue?\n\nCognitive Complexity is a measure of how hard it is to understand the control flow of a unit of code. Code with high cognitive complexity is hard to read, understand, test, and modify.\n\nAs a rule of thumb, high cognitive complexity is a sign that the code should be refactored into smaller, easier-to-manage pieces.\n\n##### Which syntax in code does impact cognitive complexity score?\n\nHere are the core concepts:\n\n*   **Cognitive complexity is incremented each time the code breaks the normal linear reading flow.**  \n    This concerns, for example, loop structures, conditionals, catches, switches, jumps to labels, and conditions mixing multiple operators.\n*   **Each nesting level increases complexity.**  \n    During code reading, the deeper you go through nested layers, the harder it becomes to keep the context in mind.\n*   **Method calls are free**  \n    A well-picked method name is a summary of multiple lines of code. A reader can first explore a high-level view of what the code is performing then go deeper and deeper by looking at called functions content.  \n    _Note:_ This does not apply to recursive calls, those will increment cognitive score.\n\nThe method of computation is fully detailed in the pdf linked in the resources.\n\nNote that the calculation of cognitive complexity at function level deviates from the documented process. Given the functional nature of JavaScript, nesting functions is a prevalent practice, especially within frameworks like React.js. Consequently, the cognitive complexity of functions remains independent from one another. This means that the complexity of a nesting function does not increase with the complexity of nested functions.\n\n##### What is the potential impact?\n\nDevelopers spend more time reading and understanding code than writing it. High cognitive complexity slows down changes and increases the cost of maintenance.\n\n##### Exceptions\n\nCognitive complexity calculations exclude logical expressions using the `||` and `??` operators.\n\n```\nfunction greet(name) {\n    name = name || 'Guest';\n    console.log('Hello, ' + name + '!');\n}\n```\n\n#### References\n\n##### Documentation\n\n*   Sonar - [Cognitive Complexity](https://www.sonarsource.com/docs/CognitiveComplexity.pdf)\n\n##### Articles & blog posts\n\n*   Sonar Blog - [5 Clean Code Tips for Reducing Cognitive Complexity](https://www.sonarsource.com/blog/5-clean-code-tips-for-reducing-cognitive-complexity/)\n\n#### Overview\n\nThis rule raises an issue when the code cognitive complexity of a function is above a certain threshold."},{"id":"typescript:S7778","title":"Multiple consecutive calls to methods that accept multiple arguments should be combined","description":"#### Overview\n\nThis rule raises an issue when multiple consecutive calls are made to `Array#push()`, `Element#classList.add()`, `Element#classList.remove()`, or `importScripts()` on the same object.\n\n#### Why is this an issue?\n\nMaking multiple consecutive calls to methods that accept multiple arguments creates unnecessary overhead and reduces code readability.\n\nMethods like `Array#push()`, `Element#classList.add()`, `Element#classList.remove()`, and `importScripts()` are designed to accept multiple arguments in a single call. When you make multiple separate calls instead of one combined call, you create several issues:\n\n*   **Performance overhead**: Each method call has a small performance cost. Multiple calls mean multiple function invocations, parameter processing, and potential DOM updates (for classList methods).\n*   **Reduced readability**: Multiple lines doing similar operations make the code longer and harder to scan quickly.\n*   **Inconsistent patterns**: Using single calls when multiple arguments are supported goes against the intended API design.\n\nFor example, calling `array.push(1); array.push(2);` requires two separate function calls, while `array.push(1, 2)` accomplishes the same result with one call. Similarly, `element.classList.add('foo'); element.classList.add('bar');` triggers two DOM updates, while `element.classList.add('foo', 'bar')` can be optimized by the browser into a single update.\n\n##### What is the potential impact?\n\nThe impact is primarily on code maintainability and minor performance improvements. While the performance gain from combining calls is usually small, it can be noticeable in performance-critical code or when dealing with many DOM manipulations. The main benefit is improved code readability and consistency with JavaScript API best practices.\n\n##### How to fix?\n\nCombine multiple consecutive `Array#push()` calls into a single call with multiple arguments.\n\n##### Non-compliant code example\n\n```\nconst items = [];\nitems.push(1); // Noncompliant\nitems.push(2, 3); // Noncompliant\n```\n\n##### Compliant code example\n\n```\nconst items = [];\nitems.push(1, 2, 3);\n```\n\n##### How to fix in Web Workers?\n\nCombine multiple consecutive `importScripts()` calls into a single call.\n\n##### Non-compliant code example\n\n```\nimportScripts('https://example.com/lib1.js'); // Noncompliant\nimportScripts('https://example.com/lib2.js'); // Noncompliant\n```\n\n##### Compliant code example\n\n```\nimportScripts(\n  'https://example.com/lib1.js',\n  'https://example.com/lib2.js'\n);\n```\n\n##### Documentation\n\n*   [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn#readme) - Rule [prefer-single-call](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/HEAD/docs/rules/prefer-single-call.md)\n*   Array.prototype.push() - MDN - [Documentation for the Array push method that accepts multiple arguments](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push)\n*   Element.classList - MDN - [Documentation for the classList API including add() and remove() methods](https://developer.mozilla.org/en-US/docs/Web/API/Element/classList)\n*   WorkerGlobalScope.importScripts() - MDN - [Documentation for the importScripts method in Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/importScripts)"}]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

### Findings

- [ ] [10463588-2eae-4c4d-96d5-aa15e32ec8dc] `typescript:S7778` — Do not call \`Array\#push()\` multiple times. (src/todos/accomplishmentsService.ts:128)
- [ ] [324758fc-0623-4cbf-a360-41ba3e48a043] `typescript:S7778` — Do not call \`Array\#push()\` multiple times. (src/todos/accomplishmentsService.ts:84)
- [ ] [3a18a529-6421-4c73-bd1a-bbcc57a6b4b5] `typescript:S7778` — Do not call \`Array\#push()\` multiple times. (src/todos/accomplishmentsService.ts:129)
- [ ] [4e53bffa-8c94-4ecb-ab05-d2da3764fad6] `typescript:S3776` — Refactor this function to reduce its Cognitive Complexity from 23 to the 15 allowed. (src/todos/accomplishmentsService.ts:43)
- [ ] [7eb74d76-ac44-439a-8099-dafc513dbbd3] `typescript:S3776` — Refactor this function to reduce its Cognitive Complexity from 20 to the 15 allowed. (src/todos/accomplishmentsService.ts:89)
- [ ] [94415a74-19bd-4218-bb03-dd767895d051] `typescript:S7778` — Do not call \`Array\#push()\` multiple times. (src/todos/accomplishmentsService.ts:132)
- [ ] [a1fc7ceb-440c-42c2-a61a-0afcea82cdf5] `typescript:S7778` — Do not call \`Array\#push()\` multiple times. (src/todos/accomplishmentsService.ts:133)
- [ ] [cc189b25-4ca4-4d92-aa2a-4250cf7472cc] `typescript:S7778` — Do not call \`Array\#push()\` multiple times. (src/todos/accomplishmentsService.ts:134)
- [ ] [f051d49b-3743-41da-84d9-7698e04bbbda] `typescript:S7778` — Do not call \`Array\#push()\` multiple times. (src/todos/accomplishmentsService.ts:69)

### End Findings


- [ ] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Work Log
