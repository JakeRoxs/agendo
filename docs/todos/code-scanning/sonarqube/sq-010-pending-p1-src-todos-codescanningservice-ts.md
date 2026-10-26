---
status: pending
priority: p1
issue_id: "sq-010"
tags: [code-scanning, sonarqube]
dependencies: []
scan_identity: 4f08f8a429f2854f7d0cbfff9b52ddf85a88d89eaf0a248a52f73960c8457c9c
scan_source: sonarqube
scan_scope: "https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351"
scan_grouping: file
scan_target: "src/todos/codeScanningService.ts"
scan_refreshed_at: "2026-10-26T22:08:57.489Z"
scan_review_required: false
---

# SonarQube: src/todos/codeScanningService.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-10-26T22:08:57.489Z

**Branch:** Default branch

17 reported; 0 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/todos/codeScanningService.ts | Line: 838

**Rule:** typescript:S3358

**Problem:** Extract this nested ternary operation into an independent statement.

**Severity:** MAJOR

[View finding 021d5aa7-1536-43d4-a6f0-2773438c27b1](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=021d5aa7-1536-43d4-a6f0-2773438c27b1>)

#### File: src/todos/codeScanningService.ts | Line: 172

**Rule:** typescript:S3358

**Problem:** Extract this nested ternary operation into an independent statement.

**Severity:** MAJOR

[View finding 132dc515-8790-4839-9bd3-0d9c09786fa5](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=132dc515-8790-4839-9bd3-0d9c09786fa5>)

#### File: src/todos/codeScanningService.ts | Line: 275

**Rule:** typescript:S7765

**Problem:** Use \`.includes()\`, rather than \`.indexOf()\`, when checking for existence.

**Severity:** MINOR

[View finding 1cf5303e-64ca-4fb6-b121-f648a59fbe70](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=1cf5303e-64ca-4fb6-b121-f648a59fbe70>)

#### File: src/todos/codeScanningService.ts | Line: 83

**Rule:** typescript:S6594

**Problem:** Use the "RegExp.exec()" method instead.

**Severity:** MINOR

[View finding 22e621fc-af28-44e7-806d-b887346db598](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=22e621fc-af28-44e7-806d-b887346db598>)

#### File: src/todos/codeScanningService.ts | Line: 83

**Rule:** typescript:S8786

**Problem:** Simplify this regular expression to reduce its runtime, as it has super-linear performance due to backtracking.

**Severity:** MAJOR

[View finding 3f600f6a-67b4-4e3b-ac0c-40e06319eeb3](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=3f600f6a-67b4-4e3b-ac0c-40e06319eeb3>)

#### File: src/todos/codeScanningService.ts | Line: 186

**Rule:** typescript:S6594

**Problem:** Use the "RegExp.exec()" method instead.

**Severity:** MINOR

[View finding 590debd2-a0b7-4031-ba9a-69fcf0eec877](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=590debd2-a0b7-4031-ba9a-69fcf0eec877>)

#### File: src/todos/codeScanningService.ts | Line: 124

**Rule:** typescript:S7780

**Problem:** \`String.raw\` should be used to avoid escaping \`\\\`.

**Severity:** MINOR

[View finding 5aac3cae-db09-4887-84e9-f168d1817738](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=5aac3cae-db09-4887-84e9-f168d1817738>)

#### File: src/todos/codeScanningService.ts | Line: 700

**Rule:** typescript:S3776

**Problem:** Refactor this function to reduce its Cognitive Complexity from 97 to the 15 allowed.

**Severity:** CRITICAL

[View finding 7067e5cb-6dc8-4d88-842f-f5b5d8323430](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=7067e5cb-6dc8-4d88-842f-f5b5d8323430>)

#### File: src/todos/codeScanningService.ts | Line: 514

**Rule:** typescript:S3776

**Problem:** Refactor this function to reduce its Cognitive Complexity from 48 to the 15 allowed.

**Severity:** CRITICAL

[View finding 71f22d1f-cc2a-46c5-a081-90dbdd670536](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=71f22d1f-cc2a-46c5-a081-90dbdd670536>)

#### File: src/todos/codeScanningService.ts | Line: 225

**Rule:** typescript:S6594

**Problem:** Use the "RegExp.exec()" method instead.

**Severity:** MINOR

[View finding 88d5a705-019b-4ae0-964d-25b53bec7239](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=88d5a705-019b-4ae0-964d-25b53bec7239>)

#### File: src/todos/codeScanningService.ts | Line: 679

**Rule:** typescript:S4624

**Problem:** Refactor this code to not use nested template literals.

**Severity:** MAJOR

[View finding 8b677ad1-98e7-42fe-afc3-7b9dad5ec9cd](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=8b677ad1-98e7-42fe-afc3-7b9dad5ec9cd>)

#### File: src/todos/codeScanningService.ts | Line: 836

**Rule:** typescript:S3358

**Problem:** Extract this nested ternary operation into an independent statement.

**Severity:** MAJOR

[View finding 98494789-b81a-4f6f-a71d-aaf6b613955a](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=98494789-b81a-4f6f-a71d-aaf6b613955a>)

#### File: src/todos/codeScanningService.ts | Line: 840

**Rule:** typescript:S2871

**Problem:** Provide a compare function to avoid sorting elements alphabetically.

**Severity:** CRITICAL

[View finding cfb23c13-2c20-4a09-ac22-5be87b1d7394](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=cfb23c13-2c20-4a09-ac22-5be87b1d7394>)

#### File: src/todos/codeScanningService.ts | Line: 276

**Rule:** typescript:S7765

**Problem:** Use \`.includes()\`, rather than \`.indexOf()\`, when checking for existence.

**Severity:** MINOR

[View finding dd89fa39-c67f-4a4e-94a0-2b763684f214](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=dd89fa39-c67f-4a4e-94a0-2b763684f214>)

#### File: src/todos/codeScanningService.ts | Line: 747

**Rule:** typescript:S6582

**Problem:** Prefer using an optional chain expression instead, as it's more concise and easier to read.

**Severity:** MINOR

[View finding e297db9f-1eee-4f79-8e0b-418954b2c22f](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=e297db9f-1eee-4f79-8e0b-418954b2c22f>)

#### File: src/todos/codeScanningService.ts | Line: 733

**Rule:** typescript:S3358

**Problem:** Extract this nested ternary operation into an independent statement.

**Severity:** MAJOR

[View finding e6677f65-d238-48a4-8fe5-c83077b63b52](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=e6677f65-d238-48a4-8fe5-c83077b63b52>)

#### File: src/todos/codeScanningService.ts | Line: 838

**Rule:** typescript:S4624

**Problem:** Refactor this code to not use nested template literals.

**Severity:** MAJOR

[View finding ea371f26-ae41-47c4-8d33-817e54063408](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=ea371f26-ae41-47c4-8d33-817e54063408>)

### Rule: "Array.prototype.sort()" and "Array.prototype.toSorted()" should use a compare function

**Rule ID:** typescript:S2871

#### Why is this an issue?

JavaScript provides built-in methods to sort arrays, making it convenient for developers to manipulate data. There are two primary ways to sort an array:

*   `Array.prototype.sort()`: This method sorts the elements of an array in place and returns the sorted array.
*   `Array.prototype.toSorted()`: This method is designed to return a new sorted array, leaving the original array unchanged.

The default sort order is lexicographic (dictionary) order, based on the string representation of the elements. This means that when sorting an array of strings, numbers, or other elements, they are converted to strings and sorted according to their Unicode code points (UTF-16). For most cases, this default behavior is suitable when sorting an array of strings.

However, it’s essential to be aware of potential pitfalls when sorting arrays of non-string elements, particularly numbers. The lexicographic order may not always produce the expected results for numbers:

```
const numbers = [10, 2, 30, 1, 5];
numbers.sort(); // Noncompliant: lexicographic sort
console.log(numbers); // Output: [1, 10, 2, 30, 5]
```

To sort numbers correctly, you must provide a custom comparison function that returns the correct ordering:

```
const numbers = [10, 2, 30, 1, 5];
numbers.sort((a, b) => a - b);
console.log(numbers); // Output: [1, 2, 5, 10, 30]
```

Even to sort strings, the default sort order may give unexpected results. Not only does it not support localization, it also doesn’t fully support Unicode, as it only considers UTF-16 code units. For example, in the code below, `"eΔ"` is surprisingly before and after `"éΔ"`. To guarantee that the sorting is reliable and remains as such in the long run, it is necessary to provide a compare function that is both locale and Unicode aware - typically `String.localeCompare`.

```
const code1 = '\u00e9\u0394'; // "éΔ"
const code2 = '\u0065\u0301\u0394'; // "éΔ" using Unicode combining marks
const code3 = '\u0065\u0394'; // "eΔ"
console.log([code1, code2, code3].sort()); // Noncompliant: ["éΔ", "eΔ", "éΔ"], "eΔ" position is inconsistent
console.log([code1, code2, code3].sort((a, b) => a.localeCompare(b))); // ["eΔ", "éΔ", "éΔ"]
```

##### Exceptions

This rule does not apply when two arrays of primitive values are sorted with the same method and then serialized before an equality or inequality comparison. In patterns such as `JSON.stringify(a.sort()) === JSON.stringify(b.sort())` or `JSON.stringify(a.toSorted()) !== JSON.stringify(b.toSorted())`, sorting is only used to normalize element order before comparing the serialized values.

```
function haveSameElements(left, right) {
  return JSON.stringify(left.sort()) === JSON.stringify(right.sort());
}

function differ(left, right) {
  return JSON.stringify(left.toSorted()) !== JSON.stringify(right.toSorted());
}
```

#### References

##### Documentation

*   MDN web docs - [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)
*   MDN web docs - [`Array.prototype.toSorted()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted)
*   MDN web docs - [`String.prototype.localeCompare()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare)

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

### Rule: Optional chaining should be preferred

**Rule ID:** typescript:S6582

#### References

##### Documentation

*   [typescript-eslint](https://typescript-eslint.io/) - Rule [prefer-optional-chain](https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/docs/rules/prefer-optional-chain.mdx)
*   MDN web docs - [Optional chaining](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining)

#### Why is this an issue?

Optional chaining allows to safely access nested properties or methods of an object without having to check for the existence of each intermediate property manually. It provides a concise and safe way to access nested properties or methods without having to write complex and error-prone `null`/`undefined` checks.

This rule flags logical operations that can be safely replaced with the `?.` optional chaining operator.

#### How to fix it

Replace with `?.` optional chaining the logical expression that checks for `null`/`undefined` before accessing the property of an object, the element of an array, or calling a function.

##### Noncompliant code example

```
function foo(obj, arr, fn) {
    if (obj && obj.value) {}
    if (arr && arr[0])    {}
    if (fn && fn(42))     {}
}
```

##### Compliant solution

```
function foo(obj, arr, fn) {
    if (obj?.value) {}
    if (arr?.[0])   {}
    if (fn?.(42))   {}
}
```

### Rule: "RegExp.exec()" should be preferred over "String.match()"

**Rule ID:** typescript:S6594

#### References

##### Documentation

*   MDN web docs - [`String.prototype.match()`](https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/String/match)
*   MDN web docs - [`RegExp.prototype.exec()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec)

#### Why is this an issue?

`String.match()` behaves the same way as `RegExp.exec()` when the regular expression does not include the global flag `g`. While they work the same, `RegExp.exec()` can be slightly faster than `String.match()`. Therefore, it should be preferred for better performance.

The rule reports an issue on a call to `String.match()` whenever it can be replaced with semantically equivalent `RegExp.exec()`.

```
'foo'.match(/bar/);
```

Rewrite the pattern matching from `string.match(regex)` to `regex.exec(string)`.

```
/bar/.exec('foo');
```

### Rule: Existence checks should use ".includes()" instead of ".indexOf()" or ".lastIndexOf()"

**Rule ID:** typescript:S7765

#### Overview

This rule raises an issue when `.indexOf()` or `.lastIndexOf()` are used with comparison operators to check element existence, or when `Array#some()` is used for simple equality checks that could be replaced with `.includes()`.

#### Why is this an issue?

Using `.indexOf()` or `.lastIndexOf()` with comparison operators like `!== -1` or `>= 0` to check if an element exists is less readable and semantic than using `.includes()`. The intent is not immediately clear - you need to understand that `-1` means "not found" and remember the comparison logic.

The `.includes()` method was specifically designed for existence checks. It clearly expresses the intent: "does this array/string include this element?" This makes code more readable and self-documenting.

Similarly, using `Array#some()` for simple equality checks is overkill. The `some()` method is designed for complex conditions and predicates. When you only need to check if an element exists, `.includes()` is more appropriate and can be more performant since it doesn’t need to execute a callback function.

Using the right method for the right purpose makes code more maintainable and easier to understand for other developers.

##### What is the potential impact?

This issue affects code readability and maintainability. While it doesn’t cause runtime errors, it makes code harder to understand and review. Using inappropriate methods can also have minor performance implications, as `.indexOf()` returns an index that gets discarded, and `Array#some()` executes callback functions unnecessarily.

##### How to fix?

Replace `.indexOf()` comparisons with `.includes()`. Instead of checking if the index is not -1 or greater than -1, directly use `.includes()` to check existence.

##### Non-compliant code example

```
if (array.indexOf('foo') !== -1) { // Noncompliant
  // element found
}

if (string.lastIndexOf('bar') >= 0) { // Noncompliant
  // element found
}
```

##### Compliant code example

```
if (array.includes('foo')) {
  // element found
}

if (string.includes('bar')) {
  // element found
}
```

##### Documentation

*   [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn#readme) - Rule [prefer-includes](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/HEAD/docs/rules/prefer-includes.md)
*   MDN - Array.prototype.includes() - [Official documentation for the Array includes() method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes)
*   MDN - String.prototype.includes() - [Official documentation for the String includes() method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes)
*   MDN - Array.prototype.some() - [Official documentation for the Array some() method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some)

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
{"source":"sonarqube","scope":"https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351","grouping":"file","target":"src/todos/codeScanningService.ts","version":1,"retrievedAt":"2026-10-26T22:08:57.489Z","findings":[{"id":"021d5aa7-1536-43d4-a6f0-2773438c27b1","rule":"typescript:S3358","severity":"MAJOR","message":"Extract this nested ternary operation into an independent statement.","path":"src/todos/codeScanningService.ts","line":838,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=021d5aa7-1536-43d4-a6f0-2773438c27b1","returned":true},{"id":"132dc515-8790-4839-9bd3-0d9c09786fa5","rule":"typescript:S3358","severity":"MAJOR","message":"Extract this nested ternary operation into an independent statement.","path":"src/todos/codeScanningService.ts","line":172,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=132dc515-8790-4839-9bd3-0d9c09786fa5","returned":true},{"id":"1cf5303e-64ca-4fb6-b121-f648a59fbe70","rule":"typescript:S7765","severity":"MINOR","message":"Use `.includes()`, rather than `.indexOf()`, when checking for existence.","path":"src/todos/codeScanningService.ts","line":275,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=1cf5303e-64ca-4fb6-b121-f648a59fbe70","returned":true},{"id":"22e621fc-af28-44e7-806d-b887346db598","rule":"typescript:S6594","severity":"MINOR","message":"Use the \"RegExp.exec()\" method instead.","path":"src/todos/codeScanningService.ts","line":83,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=22e621fc-af28-44e7-806d-b887346db598","returned":true},{"id":"3f600f6a-67b4-4e3b-ac0c-40e06319eeb3","rule":"typescript:S8786","severity":"MAJOR","message":"Simplify this regular expression to reduce its runtime, as it has super-linear performance due to backtracking.","path":"src/todos/codeScanningService.ts","line":83,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=3f600f6a-67b4-4e3b-ac0c-40e06319eeb3","returned":true},{"id":"590debd2-a0b7-4031-ba9a-69fcf0eec877","rule":"typescript:S6594","severity":"MINOR","message":"Use the \"RegExp.exec()\" method instead.","path":"src/todos/codeScanningService.ts","line":186,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=590debd2-a0b7-4031-ba9a-69fcf0eec877","returned":true},{"id":"5aac3cae-db09-4887-84e9-f168d1817738","rule":"typescript:S7780","severity":"MINOR","message":"`String.raw` should be used to avoid escaping `\\`.","path":"src/todos/codeScanningService.ts","line":124,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=5aac3cae-db09-4887-84e9-f168d1817738","returned":true},{"id":"7067e5cb-6dc8-4d88-842f-f5b5d8323430","rule":"typescript:S3776","severity":"CRITICAL","message":"Refactor this function to reduce its Cognitive Complexity from 97 to the 15 allowed.","path":"src/todos/codeScanningService.ts","line":700,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=7067e5cb-6dc8-4d88-842f-f5b5d8323430","returned":true},{"id":"71f22d1f-cc2a-46c5-a081-90dbdd670536","rule":"typescript:S3776","severity":"CRITICAL","message":"Refactor this function to reduce its Cognitive Complexity from 48 to the 15 allowed.","path":"src/todos/codeScanningService.ts","line":514,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=71f22d1f-cc2a-46c5-a081-90dbdd670536","returned":true},{"id":"88d5a705-019b-4ae0-964d-25b53bec7239","rule":"typescript:S6594","severity":"MINOR","message":"Use the \"RegExp.exec()\" method instead.","path":"src/todos/codeScanningService.ts","line":225,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=88d5a705-019b-4ae0-964d-25b53bec7239","returned":true},{"id":"8b677ad1-98e7-42fe-afc3-7b9dad5ec9cd","rule":"typescript:S4624","severity":"MAJOR","message":"Refactor this code to not use nested template literals.","path":"src/todos/codeScanningService.ts","line":679,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=8b677ad1-98e7-42fe-afc3-7b9dad5ec9cd","returned":true},{"id":"98494789-b81a-4f6f-a71d-aaf6b613955a","rule":"typescript:S3358","severity":"MAJOR","message":"Extract this nested ternary operation into an independent statement.","path":"src/todos/codeScanningService.ts","line":836,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=98494789-b81a-4f6f-a71d-aaf6b613955a","returned":true},{"id":"cfb23c13-2c20-4a09-ac22-5be87b1d7394","rule":"typescript:S2871","severity":"CRITICAL","message":"Provide a compare function to avoid sorting elements alphabetically.","path":"src/todos/codeScanningService.ts","line":840,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=cfb23c13-2c20-4a09-ac22-5be87b1d7394","returned":true},{"id":"dd89fa39-c67f-4a4e-94a0-2b763684f214","rule":"typescript:S7765","severity":"MINOR","message":"Use `.includes()`, rather than `.indexOf()`, when checking for existence.","path":"src/todos/codeScanningService.ts","line":276,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=dd89fa39-c67f-4a4e-94a0-2b763684f214","returned":true},{"id":"e297db9f-1eee-4f79-8e0b-418954b2c22f","rule":"typescript:S6582","severity":"MINOR","message":"Prefer using an optional chain expression instead, as it's more concise and easier to read.","path":"src/todos/codeScanningService.ts","line":747,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=e297db9f-1eee-4f79-8e0b-418954b2c22f","returned":true},{"id":"e6677f65-d238-48a4-8fe5-c83077b63b52","rule":"typescript:S3358","severity":"MAJOR","message":"Extract this nested ternary operation into an independent statement.","path":"src/todos/codeScanningService.ts","line":733,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=e6677f65-d238-48a4-8fe5-c83077b63b52","returned":true},{"id":"ea371f26-ae41-47c4-8d33-817e54063408","rule":"typescript:S4624","severity":"MAJOR","message":"Refactor this code to not use nested template literals.","path":"src/todos/codeScanningService.ts","line":838,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=ea371f26-ae41-47c4-8d33-817e54063408","returned":true}],"rules":[{"id":"typescript:S2871","title":"\"Array.prototype.sort()\" and \"Array.prototype.toSorted()\" should use a compare function","description":"#### Why is this an issue?\n\nJavaScript provides built-in methods to sort arrays, making it convenient for developers to manipulate data. There are two primary ways to sort an array:\n\n*   `Array.prototype.sort()`: This method sorts the elements of an array in place and returns the sorted array.\n*   `Array.prototype.toSorted()`: This method is designed to return a new sorted array, leaving the original array unchanged.\n\nThe default sort order is lexicographic (dictionary) order, based on the string representation of the elements. This means that when sorting an array of strings, numbers, or other elements, they are converted to strings and sorted according to their Unicode code points (UTF-16). For most cases, this default behavior is suitable when sorting an array of strings.\n\nHowever, it’s essential to be aware of potential pitfalls when sorting arrays of non-string elements, particularly numbers. The lexicographic order may not always produce the expected results for numbers:\n\n```\nconst numbers = [10, 2, 30, 1, 5];\nnumbers.sort(); // Noncompliant: lexicographic sort\nconsole.log(numbers); // Output: [1, 10, 2, 30, 5]\n```\n\nTo sort numbers correctly, you must provide a custom comparison function that returns the correct ordering:\n\n```\nconst numbers = [10, 2, 30, 1, 5];\nnumbers.sort((a, b) => a - b);\nconsole.log(numbers); // Output: [1, 2, 5, 10, 30]\n```\n\nEven to sort strings, the default sort order may give unexpected results. Not only does it not support localization, it also doesn’t fully support Unicode, as it only considers UTF-16 code units. For example, in the code below, `\"eΔ\"` is surprisingly before and after `\"éΔ\"`. To guarantee that the sorting is reliable and remains as such in the long run, it is necessary to provide a compare function that is both locale and Unicode aware - typically `String.localeCompare`.\n\n```\nconst code1 = '\\u00e9\\u0394'; // \"éΔ\"\nconst code2 = '\\u0065\\u0301\\u0394'; // \"éΔ\" using Unicode combining marks\nconst code3 = '\\u0065\\u0394'; // \"eΔ\"\nconsole.log([code1, code2, code3].sort()); // Noncompliant: [\"éΔ\", \"eΔ\", \"éΔ\"], \"eΔ\" position is inconsistent\nconsole.log([code1, code2, code3].sort((a, b) => a.localeCompare(b))); // [\"eΔ\", \"éΔ\", \"éΔ\"]\n```\n\n##### Exceptions\n\nThis rule does not apply when two arrays of primitive values are sorted with the same method and then serialized before an equality or inequality comparison. In patterns such as `JSON.stringify(a.sort()) === JSON.stringify(b.sort())` or `JSON.stringify(a.toSorted()) !== JSON.stringify(b.toSorted())`, sorting is only used to normalize element order before comparing the serialized values.\n\n```\nfunction haveSameElements(left, right) {\n  return JSON.stringify(left.sort()) === JSON.stringify(right.sort());\n}\n\nfunction differ(left, right) {\n  return JSON.stringify(left.toSorted()) !== JSON.stringify(right.toSorted());\n}\n```\n\n#### References\n\n##### Documentation\n\n*   MDN web docs - [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)\n*   MDN web docs - [`Array.prototype.toSorted()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted)\n*   MDN web docs - [`String.prototype.localeCompare()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare)"},{"id":"typescript:S3358","title":"Ternary operators should not be nested","description":"#### References\n\n##### Articles & blog posts\n\n*   Sonar - [Stop nesting ternaries in JavaScript](https://www.sonarsource.com/blog/stop-nesting-ternaries-javascript/)\n\n#### Why is this an issue?\n\nNested ternaries are hard to read and can make the order of operations complex to understand.\n\n```\nfunction getReadableStatus(job) {\n  return job.isRunning() ? \"Running\" : job.hasErrors() ? \"Failed\" : \"Succeeded \";  // Noncompliant\n}\n```\n\nInstead, use another line to express the nested operation in a separate statement.\n\n```\nfunction getReadableStatus(job) {\n  if (job.isRunning()) {\n    return \"Running\";\n  }\n  return job.hasErrors() ? \"Failed\" : \"Succeeded\";\n}\n```\n\n##### Exceptions\n\nThis rule does not apply in JSX expressions to support conditional rendering and conditional attributes as long as the nesting happens in separate JSX expression containers, i.e. JSX elements embedding JavaScript code, as shown below:\n\n```\nreturn (\n\u003c>\n  {isLoading ? (\n    \u003cLoader active />\n  ) : (\n    \u003cPanel label={isEditing ? 'Open' : 'Not open'}>\n      \u003ca>{isEditing ? 'Close now' : 'Start now'}\u003c/a>\n      \u003cCheckbox onClick={!saving ? setSaving(saving => !saving) : null} />\n    \u003c/Panel>\n  )}\n\u003c/>\n);\n```\n\nIf you have nested ternaries in the same JSX expression container, refactor your logic into a separate function like that:\n\n```\nfunction myComponent(condition) {\n  if (condition \u003c 0) {\n    return '\u003cDownSign>it is negative\u003c/DownSign>';\n  } else if (condition > 0) {\n    return '\u003cUpSign>it is positive\u003c/UpSign>';\n  } else {\n    return '\u003cBarSign>it is zero\u003c/BarSign>';\n  }\n}\n\nreturn (\n  {myComponent(foo)}\n);\n```"},{"id":"typescript:S3776","title":"Cognitive Complexity of functions should not be too high","description":"#### How to fix it\n\nReducing cognitive complexity can be challenging.  \nHere are a few suggestions:\n\n*   **Extract complex conditions in a new function.**  \n    Mixed operators in condition will increase complexity. Extracting the condition in a new function with an appropriate name will reduce cognitive load.\n*   **Break down large functions.**  \n    Large functions can be hard to understand and maintain. If a function is doing too many things, consider breaking it down into smaller, more manageable functions. Each function should have a single responsibility.\n*   **Avoid deep nesting by returning early.**  \n    To avoid the nesting of conditions, process exceptional cases first and return early.\n*   **Use null-safe operations (if available in the language).**  \n    When available the `.?` or `??` operator replaces multiple tests and simplifies the flow.\n\n**Extraction of a complex condition in a new function.**\n\n##### Noncompliant code example\n\nThe code is using a complex condition and has a cognitive cost of 3.\n\n```\nfunction calculateFinalPrice(user, cart) {\n  let total = calculateTotal(cart);\n  if (user.hasMembership                       // +1 (if)\n    && user.orders > 10                        // +1 (more than one condition)\n    && user.accountActive\n    && !user.hasDiscount\n    || user.orders === 1) {                    // +1 (change of operator in condition)\n      total = applyDiscount(user, total);\n  }\n  return total;\n}\n```\n\n##### Compliant solution\n\nEven if the cognitive complexity of the whole program did not change, it is easier for a reader to understand the code of the `calculateFinalPrice` function, which now only has a cognitive cost of 1.\n\n```\nfunction calculateFinalPrice(user, cart) {\n  let total = calculateTotal(cart);\n  if (isEligibleForDiscount(user)) {       // +1 (if)\n    total = applyDiscount(user, total);\n  }\n  return total;\n}\n\nfunction isEligibleForDiscount(user) {\n  return user.hasMembership\n    && user.orders > 10                     // +1 (more than one condition)\n    && user.accountActive\n    && !user.hasDiscount\n    || user.orders === 1                    // +1 (change of operator in condition)\n}\n```\n\n**Break down large functions.**\n\n##### Noncompliant code example\n\nFor example, consider a function that calculates the total price of a shopping cart, including sales tax and shipping.  \n_Note:_ The code is simplified here, to illustrate the purpose. Please imagine there is more happening in the `for` loops.\n\n```\nfunction calculateTotal(cart) {\n  let total = 0;\n  for (let i = 0; i \u003c cart.length; i++) {       // +1 (for)\n    total += cart[i].price;\n  }\n\n  // calculateSalesTax\n  for (let i = 0; i \u003c cart.length; i++) {       // +1 (for)\n    total += 0.2 * cart[i].price;\n  }\n\n  //calculateShipping\n  total += 5 * cart.length;\n\n  return total;\n}\n```\n\nThis function could be refactored into smaller functions: The complexity is spread over multiple functions and the complex `calculateTotal` has now a complexity score of zero.\n\n##### Compliant solution\n\n```\nfunction calculateTotal(cart) {\n  let total = calculateSubtotal(cart);\n  total += calculateSalesTax(cart);\n  total += calculateShipping(cart);\n  return total;\n}\n\nfunction calculateSubtotal(cart) {\n  let subTotal = 0;\n  for (const item of cart) {        // +1 (for)\n    subTotal += item.price;\n  }\n  return subTotal;\n}\n\nfunction calculateSalesTax(cart) {\n  let salesTax = 0;\n  for (const item of cart) {        // +1 (for)\n    salesTax += 0.2 * item.price;\n  }\n  return salesTax;\n}\n\nfunction calculateShipping(cart) {\n  return 5 * cart.length;\n}\n```\n\n**Avoid deep nesting by returning early.**\n\n##### Noncompliant code example\n\nThe below code has a cognitive complexity of 6.\n\n```\nfunction calculateDiscount(price, user) {\n  if (isEligibleForDiscount(user)) {  // +1 ( if )\n    if (user?.hasMembership) {        // +2 ( nested if )\n      return price * 0.9;\n  } else if (user?.orders === 1 ) {   // +1 ( else )\n          return price * 0.95;\n    } else {                          // +1 ( else )\n      return price;\n    }\n  } else {                            // +1 ( else )\n    return price;\n  }\n}\n```\n\n##### Compliant solution\n\nChecking for the edge case first flattens the `if` statements and reduces the cognitive complexity to 3.\n\n```\nfunction calculateDiscount(price, user) {\n    if (!isEligibleForDiscount(user)) {  // +1 ( if )\n      return price;\n    }\n    if (user?.hasMembership) {           // +1 ( if )\n      return price * 0.9;\n    }\n    if (user?.orders === 1) {            // +1 ( if )\n      return price * 0.95;\n    }\n    return price;\n}\n```\n\n**Use the optional chaining operator to access data.**\n\nIn the below code, the cognitive complexity is increased due to the multiple checks required to access the manufacturer’s name. This can be simplified using the optional chaining operator.\n\n##### Noncompliant code example\n\n```\nlet manufacturerName = null;\n\nif (product && product.details && product.details.manufacturer) { // +1 (if) +1 (multiple condition)\n    manufacturerName = product.details.manufacturer.name;\n}\nif (manufacturerName) { // +1 (if)\n  console.log(manufacturerName);\n} else {\n  console.log('Manufacturer name not found');\n}\n```\n\n##### Compliant solution\n\nThe optional chaining operator will return `undefined` if any reference in the chain is `undefined` or `null`, avoiding multiple checks:\n\n```\nlet manufacturerName = product?.details?.manufacturer?.name;\n\nif (manufacturerName) { // +1 (if)\n  console.log(manufacturerName);\n} else {\n  console.log('Manufacturer name not found');\n}\n```\n\n##### Pitfalls\n\nAs this code is complex, ensure that you have unit tests that cover the code before refactoring.\n\n#### Why is this an issue?\n\nCognitive Complexity is a measure of how hard it is to understand the control flow of a unit of code. Code with high cognitive complexity is hard to read, understand, test, and modify.\n\nAs a rule of thumb, high cognitive complexity is a sign that the code should be refactored into smaller, easier-to-manage pieces.\n\n##### Which syntax in code does impact cognitive complexity score?\n\nHere are the core concepts:\n\n*   **Cognitive complexity is incremented each time the code breaks the normal linear reading flow.**  \n    This concerns, for example, loop structures, conditionals, catches, switches, jumps to labels, and conditions mixing multiple operators.\n*   **Each nesting level increases complexity.**  \n    During code reading, the deeper you go through nested layers, the harder it becomes to keep the context in mind.\n*   **Method calls are free**  \n    A well-picked method name is a summary of multiple lines of code. A reader can first explore a high-level view of what the code is performing then go deeper and deeper by looking at called functions content.  \n    _Note:_ This does not apply to recursive calls, those will increment cognitive score.\n\nThe method of computation is fully detailed in the pdf linked in the resources.\n\nNote that the calculation of cognitive complexity at function level deviates from the documented process. Given the functional nature of JavaScript, nesting functions is a prevalent practice, especially within frameworks like React.js. Consequently, the cognitive complexity of functions remains independent from one another. This means that the complexity of a nesting function does not increase with the complexity of nested functions.\n\n##### What is the potential impact?\n\nDevelopers spend more time reading and understanding code than writing it. High cognitive complexity slows down changes and increases the cost of maintenance.\n\n##### Exceptions\n\nCognitive complexity calculations exclude logical expressions using the `||` and `??` operators.\n\n```\nfunction greet(name) {\n    name = name || 'Guest';\n    console.log('Hello, ' + name + '!');\n}\n```\n\n#### References\n\n##### Documentation\n\n*   Sonar - [Cognitive Complexity](https://www.sonarsource.com/docs/CognitiveComplexity.pdf)\n\n##### Articles & blog posts\n\n*   Sonar Blog - [5 Clean Code Tips for Reducing Cognitive Complexity](https://www.sonarsource.com/blog/5-clean-code-tips-for-reducing-cognitive-complexity/)\n\n#### Overview\n\nThis rule raises an issue when the code cognitive complexity of a function is above a certain threshold."},{"id":"typescript:S4624","title":"Template literals should not be nested","description":"#### Why is this an issue?\n\nTemplate literals, also known as template strings, allow for string interpolation and multiline strings in JavaScript. They provide a more convenient and flexible way to work with strings compared to traditional string concatenation or manipulation.\n\nTemplate literals are delimited with the backtick ``(`)`` character. They are a convenient way to include variables or expressions within a string using placeholders `` `${expression}` `` in the string and evaluate them dynamically.\n\nHowever, nesting template literals can make the code less readable. With each nested template literal, the code becomes more complex and harder to understand. It can be challenging to keep track of the opening and closing backticks and properly escape characters if needed.\n\n```\nconst color = \"red\";\nconst count = 3;\nconst message = `I have ${color ? `${count} ${color}` : count} apples`; // Noncompliant: nested template strings not easy to read\n```\n\nIn such situations, moving the nested template into a separate statement is preferable.\n\n```\nconst color = \"red\";\nconst count = 3;\nconst apples = color ? `${count} ${color}` : count;\nconst message = `I have ${apples} apples`;\n```\n\nThe rule makes an exception for nested template literals spanning multiple lines. It allows you to visually separate different sections and gives you more freedom in formatting your text, including line breaks, indentation, and other formatting elements, enhancing readability.\n\n```\nconst name = 'John';\nconst age = 42;\n\nconst message = `Hello ${name}!\nYou are ${age} years old.\n${`This is a nested template literal.`}\nIt can span multiple lines.`;\n```\n\n#### References\n\n##### Documentation\n\n*   MDN web docs - [Template literals (Template strings)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)"},{"id":"typescript:S6582","title":"Optional chaining should be preferred","description":"#### References\n\n##### Documentation\n\n*   [typescript-eslint](https://typescript-eslint.io/) - Rule [prefer-optional-chain](https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/docs/rules/prefer-optional-chain.mdx)\n*   MDN web docs - [Optional chaining](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining)\n\n#### Why is this an issue?\n\nOptional chaining allows to safely access nested properties or methods of an object without having to check for the existence of each intermediate property manually. It provides a concise and safe way to access nested properties or methods without having to write complex and error-prone `null`/`undefined` checks.\n\nThis rule flags logical operations that can be safely replaced with the `?.` optional chaining operator.\n\n#### How to fix it\n\nReplace with `?.` optional chaining the logical expression that checks for `null`/`undefined` before accessing the property of an object, the element of an array, or calling a function.\n\n##### Noncompliant code example\n\n```\nfunction foo(obj, arr, fn) {\n    if (obj && obj.value) {}\n    if (arr && arr[0])    {}\n    if (fn && fn(42))     {}\n}\n```\n\n##### Compliant solution\n\n```\nfunction foo(obj, arr, fn) {\n    if (obj?.value) {}\n    if (arr?.[0])   {}\n    if (fn?.(42))   {}\n}\n```"},{"id":"typescript:S6594","title":"\"RegExp.exec()\" should be preferred over \"String.match()\"","description":"#### References\n\n##### Documentation\n\n*   MDN web docs - [`String.prototype.match()`](https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/String/match)\n*   MDN web docs - [`RegExp.prototype.exec()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec)\n\n#### Why is this an issue?\n\n`String.match()` behaves the same way as `RegExp.exec()` when the regular expression does not include the global flag `g`. While they work the same, `RegExp.exec()` can be slightly faster than `String.match()`. Therefore, it should be preferred for better performance.\n\nThe rule reports an issue on a call to `String.match()` whenever it can be replaced with semantically equivalent `RegExp.exec()`.\n\n```\n'foo'.match(/bar/);\n```\n\nRewrite the pattern matching from `string.match(regex)` to `regex.exec(string)`.\n\n```\n/bar/.exec('foo');\n```"},{"id":"typescript:S7765","title":"Existence checks should use \".includes()\" instead of \".indexOf()\" or \".lastIndexOf()\"","description":"#### Overview\n\nThis rule raises an issue when `.indexOf()` or `.lastIndexOf()` are used with comparison operators to check element existence, or when `Array#some()` is used for simple equality checks that could be replaced with `.includes()`.\n\n#### Why is this an issue?\n\nUsing `.indexOf()` or `.lastIndexOf()` with comparison operators like `!== -1` or `>= 0` to check if an element exists is less readable and semantic than using `.includes()`. The intent is not immediately clear - you need to understand that `-1` means \"not found\" and remember the comparison logic.\n\nThe `.includes()` method was specifically designed for existence checks. It clearly expresses the intent: \"does this array/string include this element?\" This makes code more readable and self-documenting.\n\nSimilarly, using `Array#some()` for simple equality checks is overkill. The `some()` method is designed for complex conditions and predicates. When you only need to check if an element exists, `.includes()` is more appropriate and can be more performant since it doesn’t need to execute a callback function.\n\nUsing the right method for the right purpose makes code more maintainable and easier to understand for other developers.\n\n##### What is the potential impact?\n\nThis issue affects code readability and maintainability. While it doesn’t cause runtime errors, it makes code harder to understand and review. Using inappropriate methods can also have minor performance implications, as `.indexOf()` returns an index that gets discarded, and `Array#some()` executes callback functions unnecessarily.\n\n##### How to fix?\n\nReplace `.indexOf()` comparisons with `.includes()`. Instead of checking if the index is not -1 or greater than -1, directly use `.includes()` to check existence.\n\n##### Non-compliant code example\n\n```\nif (array.indexOf('foo') !== -1) { // Noncompliant\n  // element found\n}\n\nif (string.lastIndexOf('bar') >= 0) { // Noncompliant\n  // element found\n}\n```\n\n##### Compliant code example\n\n```\nif (array.includes('foo')) {\n  // element found\n}\n\nif (string.includes('bar')) {\n  // element found\n}\n```\n\n##### Documentation\n\n*   [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn#readme) - Rule [prefer-includes](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/HEAD/docs/rules/prefer-includes.md)\n*   MDN - Array.prototype.includes() - [Official documentation for the Array includes() method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes)\n*   MDN - String.prototype.includes() - [Official documentation for the String includes() method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes)\n*   MDN - Array.prototype.some() - [Official documentation for the Array some() method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some)"},{"id":"typescript:S7780","title":"String literals with escaped backslashes should use `String.raw` template literals","description":"#### Overview\n\nAn issue is raised when a string literal contains escaped backslashes (`\\\\`) that could be simplified using `String.raw` template literals.\n\n#### Why is this an issue?\n\nString literals with escaped backslashes can be difficult to read and maintain. Each backslash character must be escaped with another backslash, creating sequences like `\\\\` that are hard to interpret at a glance.\n\nThis problem is particularly common when working with:\n\n*   File paths on Windows systems\n*   Regular expression patterns\n*   LaTeX or other markup that uses backslashes\n*   Any string content that naturally contains backslash characters\n\nThe `String.raw` template literal provides a cleaner alternative. It treats backslashes literally without requiring escaping, making the code more readable and less error-prone. The intent becomes clearer, and there’s less chance of accidentally missing or adding extra backslashes during maintenance.\n\n##### What is the potential impact?\n\nUsing escaped backslashes instead of `String.raw` reduces code readability and increases the likelihood of errors when maintaining string literals. While this doesn’t cause runtime issues, it makes the codebase harder to understand and modify correctly.\n\n##### How to fix?\n\nReplace string literals containing escaped backslashes with `String.raw` template literals. The backslashes inside the template literal don’t need to be escaped.\n\n##### Non-compliant code example\n\n```\nconst filePath = \"C:\\\\Users\\\\Documents\\\\file.txt\"; // Noncompliant\n```\n\n##### Compliant code example\n\n```\nconst filePath = String.raw`C:\\Users\\Documents\\file.txt`;\n```\n\n##### Documentation\n\n*   [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn#readme) - Rule [prefer-string-raw](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/HEAD/docs/rules/prefer-string-raw.md)\n*   String.raw - MDN Web Docs - [Official documentation for the String.raw template literal tag](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/raw)\n*   Template literals - MDN Web Docs - [Comprehensive guide to template literals in JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)"},{"id":"typescript:S8786","title":"Regular expressions should not cause non-linear backtracking","description":"#### Why is this an issue?\n\nRegular expression engines use backtracking to try all possible execution paths when evaluating a pattern against an input. In some cases, this leads to non-linear backtracking where the worst-case evaluation time grows polynomially (e.g., O(n²) or O(n³)) with the input size. While not as severe as catastrophic backtracking, such patterns can significantly degrade application performance when processing large or untrusted inputs.\n\nThis rule reports regular expressions that exhibit non-linear backtracking behavior.\n\n#### How to fix it\n\nTo fix a regular expression with non-linear backtracking, consider the following strategies:\n\n*   Replace `.` with negated character classes to exclude separators where applicable (e.g., `[^,]*` instead of `.*` before `,`).\n*   Use bounded quantifiers such as `{1,5}` to limit repetitions.\n*   Restructure alternations and quantifiers to eliminate ambiguity — avoid patterns where multiple alternatives can match the same character.\n*   JavaScript does not support possessive quantifiers, but atomic grouping can be emulated using lookahead assertions and backreferences.\n*   Use a non-backtracking implementation such as [node-re2](https://github.com/uhop/node-re2/).\n\nThe following examples illustrate two distinct causes of non-linear backtracking. The first shows a pattern that is polynomial when unanchored: without a start anchor, the engine retries the pattern at every position, leading to quadratic evaluation time when there is no match. The second shows ambiguous alternation, which causes quadratic backtracking regardless of anchoring because multiple alternatives can match the same input in different ways.\n\n##### Noncompliant code example\n\n```\n/a+b/.test(input); // Noncompliant - polynomial backtracking when the pattern does not match\n```\n\n```\n/(a|aa)+/.test(input); // Noncompliant - ambiguous alternation causes quadratic backtracking\n```\n\n##### Compliant solution\n\nAdding a start anchor prevents the engine from retrying at every position:\n\n```\n/^a+b/.test(input); // Compliant - anchor eliminates redundant backtracking positions\n```\n\nRestructuring the alternation to eliminate the overlap removes the quadratic behavior:\n\n```\n/a+/.test(input); // Compliant - unambiguous\n```\n\n#### References\n\n##### Articles & blog posts\n\n*   [owasp.org](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS) - Regular expression Denial of Service - ReDoS\n*   [regular-expressions.info](https://www.regular-expressions.info/catastrophic.html) - Runaway Regular Expressions: Catastrophic Backtracking\n\n##### Related rules\n\n*   [S5852](/coding_rules#rule_key=javascript%3AS5852) - Regular expressions should not cause catastrophic backtracking\n\n#### Overview\n\nRegular expression engines rely on backtracking to evaluate patterns against input. Certain regex patterns lead to non-linear backtracking, where the evaluation time grows polynomially with input size."}]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

### Findings

- [ ] [021d5aa7-1536-43d4-a6f0-2773438c27b1] `typescript:S3358` — Extract this nested ternary operation into an independent statement. (src/todos/codeScanningService.ts:838)
- [ ] [132dc515-8790-4839-9bd3-0d9c09786fa5] `typescript:S3358` — Extract this nested ternary operation into an independent statement. (src/todos/codeScanningService.ts:172)
- [ ] [1cf5303e-64ca-4fb6-b121-f648a59fbe70] `typescript:S7765` — Use \`.includes()\`, rather than \`.indexOf()\`, when checking for existence. (src/todos/codeScanningService.ts:275)
- [ ] [22e621fc-af28-44e7-806d-b887346db598] `typescript:S6594` — Use the "RegExp.exec()" method instead. (src/todos/codeScanningService.ts:83)
- [ ] [3f600f6a-67b4-4e3b-ac0c-40e06319eeb3] `typescript:S8786` — Simplify this regular expression to reduce its runtime, as it has super-linear performance due to backtracking. (src/todos/codeScanningService.ts:83)
- [ ] [590debd2-a0b7-4031-ba9a-69fcf0eec877] `typescript:S6594` — Use the "RegExp.exec()" method instead. (src/todos/codeScanningService.ts:186)
- [ ] [5aac3cae-db09-4887-84e9-f168d1817738] `typescript:S7780` — \`String.raw\` should be used to avoid escaping \`\\\`. (src/todos/codeScanningService.ts:124)
- [ ] [7067e5cb-6dc8-4d88-842f-f5b5d8323430] `typescript:S3776` — Refactor this function to reduce its Cognitive Complexity from 97 to the 15 allowed. (src/todos/codeScanningService.ts:700)
- [ ] [71f22d1f-cc2a-46c5-a081-90dbdd670536] `typescript:S3776` — Refactor this function to reduce its Cognitive Complexity from 48 to the 15 allowed. (src/todos/codeScanningService.ts:514)
- [ ] [88d5a705-019b-4ae0-964d-25b53bec7239] `typescript:S6594` — Use the "RegExp.exec()" method instead. (src/todos/codeScanningService.ts:225)
- [ ] [8b677ad1-98e7-42fe-afc3-7b9dad5ec9cd] `typescript:S4624` — Refactor this code to not use nested template literals. (src/todos/codeScanningService.ts:679)
- [ ] [98494789-b81a-4f6f-a71d-aaf6b613955a] `typescript:S3358` — Extract this nested ternary operation into an independent statement. (src/todos/codeScanningService.ts:836)
- [ ] [cfb23c13-2c20-4a09-ac22-5be87b1d7394] `typescript:S2871` — Provide a compare function to avoid sorting elements alphabetically. (src/todos/codeScanningService.ts:840)
- [ ] [dd89fa39-c67f-4a4e-94a0-2b763684f214] `typescript:S7765` — Use \`.includes()\`, rather than \`.indexOf()\`, when checking for existence. (src/todos/codeScanningService.ts:276)
- [ ] [e297db9f-1eee-4f79-8e0b-418954b2c22f] `typescript:S6582` — Prefer using an optional chain expression instead, as it's more concise and easier to read. (src/todos/codeScanningService.ts:747)
- [ ] [e6677f65-d238-48a4-8fe5-c83077b63b52] `typescript:S3358` — Extract this nested ternary operation into an independent statement. (src/todos/codeScanningService.ts:733)
- [ ] [ea371f26-ae41-47c4-8d33-817e54063408] `typescript:S4624` — Refactor this code to not use nested template literals. (src/todos/codeScanningService.ts:838)

### End Findings


- [ ] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Work Log
