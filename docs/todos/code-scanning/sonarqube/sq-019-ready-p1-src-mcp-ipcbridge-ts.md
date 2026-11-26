---
status: ready
priority: p1
issue_id: "sq-019"
tags: [code-scanning, sonarqube]
dependencies: []
scan_identity: 78f01df26223c69eba2ec8b425e07f95cee3ed1d63015c2fb4ab99a2afc265bb
scan_source: sonarqube
scan_scope: "https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351"
scan_grouping: file
scan_target: "src/mcp/ipcBridge.ts"
scan_refreshed_at: "2026-11-26T10:07:09.106Z"
scan_review_required: false
---

# src/mcp/ipcBridge.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-11-26T10:07:09.106Z

**Branch:** Default branch

7 reported; 0 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/mcp/ipcBridge.ts | Line: not reported

**Rule:** typescript:S3776

**Problem:** Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed.

**Severity:** CRITICAL

[View finding 2bb88b85-5b05-4155-b9b2-1ea8a406a566](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=2bb88b85-5b05-4155-b9b2-1ea8a406a566>)

#### File: src/mcp/ipcBridge.ts | Line: not reported

**Rule:** typescript:S1854

**Problem:** Remove this useless assignment to variable "truncated".

**Severity:** MAJOR

[View finding a76e8947-7018-47a9-aa91-bc06048348eb](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=a76e8947-7018-47a9-aa91-bc06048348eb>)

#### File: src/mcp/ipcBridge.ts | Line: not reported

**Rule:** typescript:S1854

**Problem:** Remove this useless assignment to variable "payload".

**Severity:** MAJOR

[View finding ad28d0f2-f1ea-4e89-8232-e18901b82a59](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=ad28d0f2-f1ea-4e89-8232-e18901b82a59>)

#### File: src/mcp/ipcBridge.ts | Line: not reported

**Rule:** typescript:S2933

**Problem:** Mark this member as \`readonly\`.

**Severity:** MAJOR

[View finding b25634c4-a76f-4ea8-be88-e9d04a846cea](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=b25634c4-a76f-4ea8-be88-e9d04a846cea>)

#### File: src/mcp/ipcBridge.ts | Line: not reported

**Rule:** typescript:S7780

**Problem:** \`String.raw\` should be used to avoid escaping \`\\\`.

**Severity:** MINOR

[View finding c940d96c-28bf-4b21-a8eb-33d1064c9c8f](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=c940d96c-28bf-4b21-a8eb-33d1064c9c8f>)

#### File: src/mcp/ipcBridge.ts | Line: not reported

**Rule:** typescript:S7059

**Problem:** Refactor this asynchronous operation outside of the constructor.

**Severity:** CRITICAL

[View finding cb6610c9-3915-4e49-8cf4-6775d6aa522b](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=cb6610c9-3915-4e49-8cf4-6775d6aa522b>)

#### File: src/mcp/ipcBridge.ts | Line: not reported

**Rule:** typescript:S3776

**Problem:** Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed.

**Severity:** CRITICAL

[View finding e6b797c8-93aa-439a-83a9-be1a23799643](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=e6b797c8-93aa-439a-83a9-be1a23799643>)

### Rule: Unused assignments should be removed

**Rule ID:** typescript:S1854

#### How to fix it

Remove the unnecessary assignment, then test the code to make sure that the right-hand side of a given assignment had no side effects (e.g. a method that writes certain data to a file and returns the number of written bytes).

##### Noncompliant code example

```
function foo(y) {
  let x = 100; // Noncompliant: dead store
  x = 150;     // Noncompliant: dead store
  x = 200;
  return x + y;
}
```

##### Compliant solution

```
function foo(y) {
  let x = 200; // Compliant: no unnecessary assignment
  return x + y;
}
```

#### References

##### Standards

*   CWE - [CWE-563 - Assignment to Variable without Use ('Unused Variable')](https://cwe.mitre.org/data/definitions/563)

##### Related rules

*   [S1763](/coding_rules#rule_key=javascript%3AS1763) - All code should be reachable
*   [S2589](/coding_rules#rule_key=javascript%3AS2589) - Boolean expressions should not be gratuitous
*   [S3516](/coding_rules#rule_key=javascript%3AS3516) - Function returns should not be invariant
*   [S3626](/coding_rules#rule_key=javascript%3AS3626) - Jump statements should not be redundant

#### Why is this an issue?

Dead stores refer to assignments made to local variables that are subsequently never used or immediately overwritten. Such assignments are unnecessary and don’t contribute to the functionality or clarity of the code. They may even negatively impact performance. Removing them enhances code cleanliness and readability. Even if the unnecessary operations do not do any harm in terms of the program’s correctness, they are - at best - a waste of computing resources.

##### Exceptions

The rule ignores

*   Initializations to `-1`, `0`, `1`, `undefined`, `[]`, `{}`, `true`, `false` and `""`.
*   Variables that start with an underscore (e.g. `_unused`) are ignored.
*   Assignment of `null` is ignored because it is sometimes used to help garbage collection
*   Increment and decrement expressions are ignored because they are often used idiomatically instead of `x+1`
*   This rule also ignores variables declared with object destructuring using rest syntax (used to exclude some properties from object)

```
let {a, b, ...rest} = obj;  // 'a' and 'b' are compliant
doSomething(rest);

let [x1, x2, x3] = arr;     // 'x1' is noncompliant, as omitting syntax can be used: "let [, x2, x3] = arr;"
doSomething(x2, x3);
```

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

### Rule: Constructors should not contain asynchronous operations

**Rule ID:** typescript:S7059

#### Why is this an issue?

Constructors should not be asynchronous because they are meant to initialize an instance of a class synchronously. While you can technically run a promise in a constructor, the instance will be returned before the asynchronous operation completes, which can lead to potential issues if the rest of your code expects the object to be fully initialized. While returning the promise may seem the solution for this problem, it is not standard practice and can lead to unexpected behavior. Returning a promise (or, in general, any object from another class) from a constructor can be misleading and is considered a bad practice as this leads to unexpected results with inheritance and the `instanceof` operator.

```
class MyClass {
  constructor() {
    Promise.resolve().then(() => this.data = fetchData()); // Noncompliant, this.data will be undefined in the new instance
  }
}
```

Instead, you can create an asynchronous method that performs the necessary asynchronous operations after the object has been constructed

```
class MyClass {
  constructor() {
    this.data = null;
  }

  async initialize() {
    this.data = await fetchData();
  }
}

(async () => {
  const myObject = new MyClass();
  await myObject.initialize();
})();
```

Otherwise, you can use a static factory method that returns a promise resolving to an instance of the class after performing the asynchronous operations.

```
class MyClass {
  constructor(data) {
    this.data = data;
  }

  static async create() {
    const data = await fetchData();
    return new MyClass(data);
  }
}

(async () => {
  const myObject = await MyClass.create();
})();
```

Using an asynchronous factory function or an initialization method provides a more conventional, readable, and maintainable approach to handling asynchronous initialization in JavaScript.

#### References

##### Documentation

*   MDN web docs - [new](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new)
*   MDN web docs - [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
*   MDN web docs - [instanceof](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/instanceof)
*   MDN web docs - [Inheritance and the prototype chain](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Inheritance_and_the_prototype_chain)

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
{"source":"sonarqube","scope":"https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351","grouping":"file","target":"src/mcp/ipcBridge.ts","version":1,"retrievedAt":"2026-11-26T10:07:09.106Z","findings":[{"id":"2bb88b85-5b05-4155-b9b2-1ea8a406a566","rule":"typescript:S3776","severity":"CRITICAL","message":"Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed.","path":"src/mcp/ipcBridge.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=2bb88b85-5b05-4155-b9b2-1ea8a406a566","resolved":false,"returned":true},{"id":"a76e8947-7018-47a9-aa91-bc06048348eb","rule":"typescript:S1854","severity":"MAJOR","message":"Remove this useless assignment to variable \"truncated\".","path":"src/mcp/ipcBridge.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=a76e8947-7018-47a9-aa91-bc06048348eb","resolved":false,"returned":true},{"id":"ad28d0f2-f1ea-4e89-8232-e18901b82a59","rule":"typescript:S1854","severity":"MAJOR","message":"Remove this useless assignment to variable \"payload\".","path":"src/mcp/ipcBridge.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=ad28d0f2-f1ea-4e89-8232-e18901b82a59","resolved":false,"returned":true},{"id":"b25634c4-a76f-4ea8-be88-e9d04a846cea","rule":"typescript:S2933","severity":"MAJOR","message":"Mark this member as `readonly`.","path":"src/mcp/ipcBridge.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=b25634c4-a76f-4ea8-be88-e9d04a846cea","resolved":false,"returned":true},{"id":"c940d96c-28bf-4b21-a8eb-33d1064c9c8f","rule":"typescript:S7780","severity":"MINOR","message":"`String.raw` should be used to avoid escaping `\\`.","path":"src/mcp/ipcBridge.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=c940d96c-28bf-4b21-a8eb-33d1064c9c8f","resolved":false,"returned":true},{"id":"cb6610c9-3915-4e49-8cf4-6775d6aa522b","rule":"typescript:S7059","severity":"CRITICAL","message":"Refactor this asynchronous operation outside of the constructor.","path":"src/mcp/ipcBridge.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=cb6610c9-3915-4e49-8cf4-6775d6aa522b","resolved":false,"returned":true},{"id":"e6b797c8-93aa-439a-83a9-be1a23799643","rule":"typescript:S3776","severity":"CRITICAL","message":"Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed.","path":"src/mcp/ipcBridge.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=e6b797c8-93aa-439a-83a9-be1a23799643","resolved":false,"returned":true}],"rules":[{"id":"typescript:S1854","title":"Unused assignments should be removed","description":"#### How to fix it\n\nRemove the unnecessary assignment, then test the code to make sure that the right-hand side of a given assignment had no side effects (e.g. a method that writes certain data to a file and returns the number of written bytes).\n\n##### Noncompliant code example\n\n```\nfunction foo(y) {\n  let x = 100; // Noncompliant: dead store\n  x = 150;     // Noncompliant: dead store\n  x = 200;\n  return x + y;\n}\n```\n\n##### Compliant solution\n\n```\nfunction foo(y) {\n  let x = 200; // Compliant: no unnecessary assignment\n  return x + y;\n}\n```\n\n#### References\n\n##### Standards\n\n*   CWE - [CWE-563 - Assignment to Variable without Use ('Unused Variable')](https://cwe.mitre.org/data/definitions/563)\n\n##### Related rules\n\n*   [S1763](/coding_rules#rule_key=javascript%3AS1763) - All code should be reachable\n*   [S2589](/coding_rules#rule_key=javascript%3AS2589) - Boolean expressions should not be gratuitous\n*   [S3516](/coding_rules#rule_key=javascript%3AS3516) - Function returns should not be invariant\n*   [S3626](/coding_rules#rule_key=javascript%3AS3626) - Jump statements should not be redundant\n\n#### Why is this an issue?\n\nDead stores refer to assignments made to local variables that are subsequently never used or immediately overwritten. Such assignments are unnecessary and don’t contribute to the functionality or clarity of the code. They may even negatively impact performance. Removing them enhances code cleanliness and readability. Even if the unnecessary operations do not do any harm in terms of the program’s correctness, they are - at best - a waste of computing resources.\n\n##### Exceptions\n\nThe rule ignores\n\n*   Initializations to `-1`, `0`, `1`, `undefined`, `[]`, `{}`, `true`, `false` and `\"\"`.\n*   Variables that start with an underscore (e.g. `_unused`) are ignored.\n*   Assignment of `null` is ignored because it is sometimes used to help garbage collection\n*   Increment and decrement expressions are ignored because they are often used idiomatically instead of `x+1`\n*   This rule also ignores variables declared with object destructuring using rest syntax (used to exclude some properties from object)\n\n```\nlet {a, b, ...rest} = obj;  // 'a' and 'b' are compliant\ndoSomething(rest);\n\nlet [x1, x2, x3] = arr;     // 'x1' is noncompliant, as omitting syntax can be used: \"let [, x2, x3] = arr;\"\ndoSomething(x2, x3);\n```"},{"id":"typescript:S2933","title":"Fields that are only assigned in the constructor should be \"readonly\"","description":"#### References\n\n##### Documentation\n\n*   [typescript-eslint](https://typescript-eslint.io/) - Rule [prefer-readonly](https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/docs/rules/prefer-readonly.mdx)\n*   TypeScript Documentation - [readonly](https://www.typescriptlang.org/docs/handbook/2/classes.html#readonly)\n\n#### How to fix it\n\nMark the given field with the `readonly` modifier.\n\nFor JavaScript and TypeScript, [S2933](/coding_rules#rule_key=javascript%3AS2933) reports one issue per class and uses secondary locations for each field that should be marked `readonly`.\n\n##### Noncompliant code example\n\n```\nclass Person { // Noncompliant: Mark this member as `readonly`.\n  private birthYear: number;\n\n  constructor(birthYear: number) {\n    this.birthYear = birthYear;\n  }\n}\n```\n\n##### Compliant solution\n\n```\nclass Person {\n  private readonly birthYear: number;\n\n  constructor(birthYear: number) {\n    this.birthYear = birthYear;\n  }\n}\n```\n\nWhen more than one field in the same class should be marked `readonly`, the issue remains on the class and each affected field is listed as a secondary location.\n\n```\nclass Person { // Noncompliant: Mark these members as `readonly`.\n  private birthYear: number;\n  private age: number;\n\n  constructor(birthYear: number, age: number) {\n    this.birthYear = birthYear;\n    this.age = age;\n  }\n}\n```\n\n```\nclass Person {\n  private readonly birthYear: number;\n  private readonly age: number;\n\n  constructor(birthYear: number, age: number) {\n    this.birthYear = birthYear;\n    this.age = age;\n  }\n}\n```\n\n#### Why is this an issue?\n\n`readonly` fields can only be assigned in a class constructor. If a class has a field that’s not marked `readonly` but is only set in the constructor, it could cause confusion about the field’s intended use. To avoid confusion, such fields should be marked `readonly` to make their intended use explicit, and to prevent future maintainers from inadvertently changing their use."},{"id":"typescript:S3776","title":"Cognitive Complexity of functions should not be too high","description":"#### References\n\n##### Documentation\n\n*   Sonar - [Cognitive Complexity](https://www.sonarsource.com/docs/CognitiveComplexity.pdf)\n\n##### Articles & blog posts\n\n*   Sonar Blog - [5 Clean Code Tips for Reducing Cognitive Complexity](https://www.sonarsource.com/blog/5-clean-code-tips-for-reducing-cognitive-complexity/)\n\n#### Overview\n\nThis rule raises an issue when the code cognitive complexity of a function is above a certain threshold.\n\n#### How to fix it\n\nReducing cognitive complexity can be challenging.  \nHere are a few suggestions:\n\n*   **Extract complex conditions in a new function.**  \n    Mixed operators in condition will increase complexity. Extracting the condition in a new function with an appropriate name will reduce cognitive load.\n*   **Break down large functions.**  \n    Large functions can be hard to understand and maintain. If a function is doing too many things, consider breaking it down into smaller, more manageable functions. Each function should have a single responsibility.\n*   **Avoid deep nesting by returning early.**  \n    To avoid the nesting of conditions, process exceptional cases first and return early.\n*   **Use null-safe operations (if available in the language).**  \n    When available the `.?` or `??` operator replaces multiple tests and simplifies the flow.\n\n**Extraction of a complex condition in a new function.**\n\n##### Noncompliant code example\n\nThe code is using a complex condition and has a cognitive cost of 3.\n\n```\nfunction calculateFinalPrice(user, cart) {\n  let total = calculateTotal(cart);\n  if (user.hasMembership                       // +1 (if)\n    && user.orders > 10                        // +1 (more than one condition)\n    && user.accountActive\n    && !user.hasDiscount\n    || user.orders === 1) {                    // +1 (change of operator in condition)\n      total = applyDiscount(user, total);\n  }\n  return total;\n}\n```\n\n##### Compliant solution\n\nEven if the cognitive complexity of the whole program did not change, it is easier for a reader to understand the code of the `calculateFinalPrice` function, which now only has a cognitive cost of 1.\n\n```\nfunction calculateFinalPrice(user, cart) {\n  let total = calculateTotal(cart);\n  if (isEligibleForDiscount(user)) {       // +1 (if)\n    total = applyDiscount(user, total);\n  }\n  return total;\n}\n\nfunction isEligibleForDiscount(user) {\n  return user.hasMembership\n    && user.orders > 10                     // +1 (more than one condition)\n    && user.accountActive\n    && !user.hasDiscount\n    || user.orders === 1                    // +1 (change of operator in condition)\n}\n```\n\n**Break down large functions.**\n\n##### Noncompliant code example\n\nFor example, consider a function that calculates the total price of a shopping cart, including sales tax and shipping.  \n_Note:_ The code is simplified here, to illustrate the purpose. Please imagine there is more happening in the `for` loops.\n\n```\nfunction calculateTotal(cart) {\n  let total = 0;\n  for (let i = 0; i \u003c cart.length; i++) {       // +1 (for)\n    total += cart[i].price;\n  }\n\n  // calculateSalesTax\n  for (let i = 0; i \u003c cart.length; i++) {       // +1 (for)\n    total += 0.2 * cart[i].price;\n  }\n\n  //calculateShipping\n  total += 5 * cart.length;\n\n  return total;\n}\n```\n\nThis function could be refactored into smaller functions: The complexity is spread over multiple functions and the complex `calculateTotal` has now a complexity score of zero.\n\n##### Compliant solution\n\n```\nfunction calculateTotal(cart) {\n  let total = calculateSubtotal(cart);\n  total += calculateSalesTax(cart);\n  total += calculateShipping(cart);\n  return total;\n}\n\nfunction calculateSubtotal(cart) {\n  let subTotal = 0;\n  for (const item of cart) {        // +1 (for)\n    subTotal += item.price;\n  }\n  return subTotal;\n}\n\nfunction calculateSalesTax(cart) {\n  let salesTax = 0;\n  for (const item of cart) {        // +1 (for)\n    salesTax += 0.2 * item.price;\n  }\n  return salesTax;\n}\n\nfunction calculateShipping(cart) {\n  return 5 * cart.length;\n}\n```\n\n**Avoid deep nesting by returning early.**\n\n##### Noncompliant code example\n\nThe below code has a cognitive complexity of 6.\n\n```\nfunction calculateDiscount(price, user) {\n  if (isEligibleForDiscount(user)) {  // +1 ( if )\n    if (user?.hasMembership) {        // +2 ( nested if )\n      return price * 0.9;\n  } else if (user?.orders === 1 ) {   // +1 ( else )\n          return price * 0.95;\n    } else {                          // +1 ( else )\n      return price;\n    }\n  } else {                            // +1 ( else )\n    return price;\n  }\n}\n```\n\n##### Compliant solution\n\nChecking for the edge case first flattens the `if` statements and reduces the cognitive complexity to 3.\n\n```\nfunction calculateDiscount(price, user) {\n    if (!isEligibleForDiscount(user)) {  // +1 ( if )\n      return price;\n    }\n    if (user?.hasMembership) {           // +1 ( if )\n      return price * 0.9;\n    }\n    if (user?.orders === 1) {            // +1 ( if )\n      return price * 0.95;\n    }\n    return price;\n}\n```\n\n**Use the optional chaining operator to access data.**\n\nIn the below code, the cognitive complexity is increased due to the multiple checks required to access the manufacturer’s name. This can be simplified using the optional chaining operator.\n\n##### Noncompliant code example\n\n```\nlet manufacturerName = null;\n\nif (product && product.details && product.details.manufacturer) { // +1 (if) +1 (multiple condition)\n    manufacturerName = product.details.manufacturer.name;\n}\nif (manufacturerName) { // +1 (if)\n  console.log(manufacturerName);\n} else {\n  console.log('Manufacturer name not found');\n}\n```\n\n##### Compliant solution\n\nThe optional chaining operator will return `undefined` if any reference in the chain is `undefined` or `null`, avoiding multiple checks:\n\n```\nlet manufacturerName = product?.details?.manufacturer?.name;\n\nif (manufacturerName) { // +1 (if)\n  console.log(manufacturerName);\n} else {\n  console.log('Manufacturer name not found');\n}\n```\n\n##### Pitfalls\n\nAs this code is complex, ensure that you have unit tests that cover the code before refactoring.\n\n#### Why is this an issue?\n\nCognitive Complexity is a measure of how hard it is to understand the control flow of a unit of code. Code with high cognitive complexity is hard to read, understand, test, and modify.\n\nAs a rule of thumb, high cognitive complexity is a sign that the code should be refactored into smaller, easier-to-manage pieces.\n\n##### Which syntax in code does impact cognitive complexity score?\n\nHere are the core concepts:\n\n*   **Cognitive complexity is incremented each time the code breaks the normal linear reading flow.**  \n    This concerns, for example, loop structures, conditionals, catches, switches, jumps to labels, and conditions mixing multiple operators.\n*   **Each nesting level increases complexity.**  \n    During code reading, the deeper you go through nested layers, the harder it becomes to keep the context in mind.\n*   **Method calls are free**  \n    A well-picked method name is a summary of multiple lines of code. A reader can first explore a high-level view of what the code is performing then go deeper and deeper by looking at called functions content.  \n    _Note:_ This does not apply to recursive calls, those will increment cognitive score.\n\nThe method of computation is fully detailed in the pdf linked in the resources.\n\nNote that the calculation of cognitive complexity at function level deviates from the documented process. Given the functional nature of JavaScript, nesting functions is a prevalent practice, especially within frameworks like React.js. Consequently, the cognitive complexity of functions remains independent from one another. This means that the complexity of a nesting function does not increase with the complexity of nested functions.\n\n##### What is the potential impact?\n\nDevelopers spend more time reading and understanding code than writing it. High cognitive complexity slows down changes and increases the cost of maintenance.\n\n##### Exceptions\n\nCognitive complexity calculations exclude logical expressions using the `||` and `??` operators.\n\n```\nfunction greet(name) {\n    name = name || 'Guest';\n    console.log('Hello, ' + name + '!');\n}\n```"},{"id":"typescript:S7059","title":"Constructors should not contain asynchronous operations","description":"#### Why is this an issue?\n\nConstructors should not be asynchronous because they are meant to initialize an instance of a class synchronously. While you can technically run a promise in a constructor, the instance will be returned before the asynchronous operation completes, which can lead to potential issues if the rest of your code expects the object to be fully initialized. While returning the promise may seem the solution for this problem, it is not standard practice and can lead to unexpected behavior. Returning a promise (or, in general, any object from another class) from a constructor can be misleading and is considered a bad practice as this leads to unexpected results with inheritance and the `instanceof` operator.\n\n```\nclass MyClass {\n  constructor() {\n    Promise.resolve().then(() => this.data = fetchData()); // Noncompliant, this.data will be undefined in the new instance\n  }\n}\n```\n\nInstead, you can create an asynchronous method that performs the necessary asynchronous operations after the object has been constructed\n\n```\nclass MyClass {\n  constructor() {\n    this.data = null;\n  }\n\n  async initialize() {\n    this.data = await fetchData();\n  }\n}\n\n(async () => {\n  const myObject = new MyClass();\n  await myObject.initialize();\n})();\n```\n\nOtherwise, you can use a static factory method that returns a promise resolving to an instance of the class after performing the asynchronous operations.\n\n```\nclass MyClass {\n  constructor(data) {\n    this.data = data;\n  }\n\n  static async create() {\n    const data = await fetchData();\n    return new MyClass(data);\n  }\n}\n\n(async () => {\n  const myObject = await MyClass.create();\n})();\n```\n\nUsing an asynchronous factory function or an initialization method provides a more conventional, readable, and maintainable approach to handling asynchronous initialization in JavaScript.\n\n#### References\n\n##### Documentation\n\n*   MDN web docs - [new](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new)\n*   MDN web docs - [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)\n*   MDN web docs - [instanceof](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/instanceof)\n*   MDN web docs - [Inheritance and the prototype chain](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Inheritance_and_the_prototype_chain)"},{"id":"typescript:S7780","title":"String literals with escaped backslashes should use `String.raw` template literals","description":"#### Overview\n\nAn issue is raised when a string literal contains escaped backslashes (`\\\\`) that could be simplified using `String.raw` template literals.\n\n#### Why is this an issue?\n\nString literals with escaped backslashes can be difficult to read and maintain. Each backslash character must be escaped with another backslash, creating sequences like `\\\\` that are hard to interpret at a glance.\n\nThis problem is particularly common when working with:\n\n*   File paths on Windows systems\n*   Regular expression patterns\n*   LaTeX or other markup that uses backslashes\n*   Any string content that naturally contains backslash characters\n\nThe `String.raw` template literal provides a cleaner alternative. It treats backslashes literally without requiring escaping, making the code more readable and less error-prone. The intent becomes clearer, and there’s less chance of accidentally missing or adding extra backslashes during maintenance.\n\n##### What is the potential impact?\n\nUsing escaped backslashes instead of `String.raw` reduces code readability and increases the likelihood of errors when maintaining string literals. While this doesn’t cause runtime issues, it makes the codebase harder to understand and modify correctly.\n\n##### How to fix?\n\nReplace string literals containing escaped backslashes with `String.raw` template literals. The backslashes inside the template literal don’t need to be escaped.\n\n##### Non-compliant code example\n\n```\nconst filePath = \"C:\\\\Users\\\\Documents\\\\file.txt\"; // Noncompliant\n```\n\n##### Compliant code example\n\n```\nconst filePath = String.raw`C:\\Users\\Documents\\file.txt`;\n```\n\n##### Documentation\n\n*   [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn#readme) - Rule [prefer-string-raw](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/HEAD/docs/rules/prefer-string-raw.md)\n*   String.raw - MDN Web Docs - [Official documentation for the String.raw template literal tag](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/raw)\n*   Template literals - MDN Web Docs - [Comprehensive guide to template literals in JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)"}]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

### Findings

- [ ] [2bb88b85-5b05-4155-b9b2-1ea8a406a566] `typescript:S3776` — Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed. (src/mcp/ipcBridge.ts)
- [ ] [a76e8947-7018-47a9-aa91-bc06048348eb] `typescript:S1854` — Remove this useless assignment to variable "truncated". (src/mcp/ipcBridge.ts)
- [ ] [ad28d0f2-f1ea-4e89-8232-e18901b82a59] `typescript:S1854` — Remove this useless assignment to variable "payload". (src/mcp/ipcBridge.ts)
- [ ] [b25634c4-a76f-4ea8-be88-e9d04a846cea] `typescript:S2933` — Mark this member as \`readonly\`. (src/mcp/ipcBridge.ts)
- [ ] [c940d96c-28bf-4b21-a8eb-33d1064c9c8f] `typescript:S7780` — \`String.raw\` should be used to avoid escaping \`\\\`. (src/mcp/ipcBridge.ts)
- [ ] [cb6610c9-3915-4e49-8cf4-6775d6aa522b] `typescript:S7059` — Refactor this asynchronous operation outside of the constructor. (src/mcp/ipcBridge.ts)
- [ ] [e6b797c8-93aa-439a-83a9-be1a23799643] `typescript:S3776` — Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed. (src/mcp/ipcBridge.ts)

### End Findings


- [ ] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

### Current disposition (2026-11-26)

- `S7780` is already satisfied by `windowsNamedPipe` using `String.raw`.
- The reported `S1854` assignments are still used to construct the bounded response; no behavior-safe removal was evident from the current code. `discoveryDirectories` is intentionally mutable because refresh replaces it. The startup update is already performed by the async `create` factory; the constructor's configuration callback triggers subsequent updates and must remain subscribed.
- Extracted buffered-line framing from the socket data callback to reduce nested control flow; existing IPC tests cover round-trip and oversized-frame behavior. Imported cognitive-complexity findings and any remaining issues need confirmation with a fresh scan.
- Do not treat this imported snapshot or local tests as scan clearance. Keep the full-scan criterion open.

## Resume Context

- Local review, implementation, and verification are complete. The remaining action is a fresh full-project SonarQube analysis of the current branch.
- Reconcile the imported finding IDs against that analysis. Keep any finding criteria open until the new analysis confirms their disposition; do not infer clearance from the 2026-11-26 imported snapshot or local tests.

## Work Log

- 2026-11-26: Inspected current source against imported Default-branch results retrieved at 2026-11-26T10:07:09.106Z. Refactored buffered line processing into a helper. S7780 is already fixed; other listed findings require fresh analysis or remain behaviorally justified as documented above. `npm test -- --grep "mcpProblems"` passed (the repository script ran the full suite: 563 passing); `npm run compile` and `git diff --check` passed. A fresh project scan is still required before closure.
- 2026-11-26: Lifecycle reconciled to ready after local implementation/review milestone. Fresh full-project analysis remains the only open step; no scan clearance claimed.
