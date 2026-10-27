---
status: ready
priority: p1
issue_id: "sq-006"
tags: [code-scanning, sonarqube]
dependencies: []
scan_identity: 65ad1dd430ff02cab6a96801be67f223b73215ecee4b08e6a31942152c0b6a9b
scan_source: sonarqube
scan_scope: "https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351"
scan_grouping: file
scan_target: "src/test/sharedBoardPresentation.test.ts"
scan_refreshed_at: "2026-10-27T02:18:14.795Z"
scan_review_required: true
---

# SonarQube: src/test/sharedBoardPresentation.test.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-10-27T02:18:14.795Z

**Branch:** Default branch

0 reported; 1 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/test/sharedBoardPresentation.test.ts | Line: 312

**Rule:** typescript:S2699

**Problem:** Add at least one assertion to this test case.

**Severity:** BLOCKER

**Observation:** Not returned in the latest successful result; resolution is not verified.

[View finding a85b796a-2e86-4821-ab2e-1dc1e8a6db40](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=a85b796a-2e86-4821-ab2e-1dc1e8a6db40>)

### Rule: Tests should include assertions

**Rule ID:** typescript:S2699

#### References

##### Documentation

*   Chai.js Documentation - [API Reference](https://www.chaijs.com/api/)
*   Sinon.js Documentation - [Assertions](https://sinonjs.org/concepts/assertions/)
*   Vitest Documentation - [API](https://vitest.dev/api/)
*   Jest Documentation - [Expect API](https://jestjs.io/docs/expect)
*   Playwright Documentation - [Test Assertions](https://playwright.dev/docs/test-assertions)
*   Cypress Documentation - [Assertions](https://docs.cypress.io/app/references/assertions)
*   Node.js Documentation - [Assert API](https://nodejs.org/api/assert.html)
*   SuperTest Documentation - [Project page](https://github.com/ladjs/supertest)
*   AWS CDK Documentation - [Assertions Module](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.assertions-readme.html)
*   uvu Documentation - [Assert API](https://github.com/lukeed/uvu/blob/master/docs/api.assert.md)
*   Bun Documentation - [Matchers](https://bun.com/docs/test/writing-tests#matchers)

#### Why is this an issue?

An assertion is a statement within the unit test that checks whether a particular condition is true or false. It defines the expected behavior of the unit being tested. Assertions are used to express the test’s expected outcome, and they are the criteria against which the actual output of the unit is evaluated.

When the unit test is executed, the assertions are evaluated. If all the assertions in the test pass, it means the unit is functioning correctly for that specific set of inputs. If any of the assertions fail, it indicates that there is a problem with the unit’s implementation, and the test case helps identify the issue.

Without assertions, a unit test doesn’t actually verify anything, making it ineffective in catching potential bugs or regressions. It will always pass, regardless of the implementation of the unit. This can lead to a false sense of security, as you may believe that your code is working correctly when it might not be.

This rule raises an issue when a test uses no assertion, although one of the following assertion libraries is available:

*   `chai`
*   `sinon`
*   `vitest`
*   `supertest`
*   `jest`
*   `jasmine`
*   `playwright`
*   `cypress`
*   `node:assert`
*   `uvu/assert`
*   `bun:test`
*   `aws-cdk-lib/assertions`

Jest, Jasmine, Cypress, and Playwright do not need to be imported: having them in your project is enough. The other libraries must be imported.

Because `aws-cdk-lib/assertions` provides assertions only, an AWS CDK test must also use a test framework such as `node:test`, Jest, or Vitest.

#### How to fix it

Use an assertion on a template created with `Template.fromStack`, `Template.fromJSON`, or `Template.fromString`. Assertions on `Annotations.fromStack` and `Tags.fromStack` are recognized as well.

##### Noncompliant code example

```
import { test } from "@jest/globals";
import { Stack } from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Template } from "aws-cdk-lib/assertions";

test("provisions an application logs bucket", () => { // Noncompliant: The unit test doesn't assert anything
  const stack = new Stack();
  new Bucket(stack, "ApplicationLogs", { bucketName: "application-logs" });
});
```

##### Compliant solution

```
import { test } from "@jest/globals";
import { Stack } from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Template } from "aws-cdk-lib/assertions";

test("provisions an application logs bucket", () => {
  const stack = new Stack();
  new Bucket(stack, "ApplicationLogs", { bucketName: "application-logs" });

  Template.fromStack(stack).hasResourceProperties("AWS::S3::Bucket", {
    BucketName: "application-logs",
  });
});
```

##### How does this work?

Query methods such as `findResources`, `getResourceId`, and `toJSON` only inspect the template, so they do not count as assertions.

#### How to fix it

Use a Cypress assertion such as `should()` to check the application state after an interaction.

##### Noncompliant code example

```
describe("login", () => {
  it("signs in a user", () => { // Noncompliant: The unit test doesn't assert anything
    cy.visit("/login");
    cy.get("[name=email]").type("alice@example.com");
    cy.get("[name=password]").type("secret");
    cy.contains("Sign in").click();
  });
});
```

##### Compliant solution

```
describe("login", () => {
  it("signs in a user", () => {
    cy.visit("/login");
    cy.get("[name=email]").type("alice@example.com");
    cy.get("[name=password]").type("secret");
    cy.contains("Sign in").click();

    cy.contains("Welcome, Alice").should("be.visible");
  });
});
```

#### How to fix it

Use SuperTest’s `expect()` method to check the HTTP response.

##### Noncompliant code example

```
import test from "node:test";
import request from "supertest";
import app from "./app.js";

test("returns the health status", async () => { // Noncompliant: The unit test doesn't assert anything
  await request(app).get("/health");
});
```

##### Compliant solution

```
import test from "node:test";
import request from "supertest";
import app from "./app.js";

test("returns the health status", async () => {
  await request(app).get("/health").expect(200);
});
```

#### How to fix it

Use `expect(…​)`, `assert.*`, or a completed `should` chain such as `value.should.equal(2)` or `value.should.be.true`.

##### Noncompliant code example

```
const expect = require("chai").expect;

describe("No assertions", function() {
  it("does not test anything", function() { // Noncompliant: The unit test doesn't assert anything
    const result = "";
  });
});
```

##### Compliant solution

```
const expect = require("chai").expect;

describe("Assertions", function() {
  it("tests something", function() {
    const result = "";
    expect(result).to.be.a("string");
  });
});
```

##### Noncompliant code example

```
const chai = require("chai");
chai.should();

describe("Object validation", function() {
  it("checks an object", function() { // Noncompliant: The unit test doesn't assert anything
    const user = {};
    user.should;
  });
});
```

##### Compliant solution

```
const chai = require("chai");
chai.should();

describe("Object validation", function() {
  it("checks an object", function() {
    const user = {};
    user.should.be.an("object");
  });
});
```

##### How does this work?

A standalone `.should` access does not count as an assertion. Complete the chain with an assertion method or property.

#### How to fix it

Use functions from the `node:assert` module to check the expected result.

##### Noncompliant code example

```
import test from "node:test";
import assert from "node:assert/strict";

test("returns an administrator", () => { // Noncompliant: The unit test doesn't assert anything
  const user = findUser("alice");
});
```

##### Compliant solution

```
import test from "node:test";
import assert from "node:assert/strict";

test("returns an administrator", () => {
  const user = findUser("alice");
  assert.equal(user.role, "administrator");
});
```

<!-- agendo:scan-snapshot
{"source":"sonarqube","scope":"https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351","grouping":"file","target":"src/test/sharedBoardPresentation.test.ts","version":1,"retrievedAt":"2026-10-27T02:18:14.795Z","findings":[{"id":"a85b796a-2e86-4821-ab2e-1dc1e8a6db40","rule":"typescript:S2699","severity":"BLOCKER","message":"Add at least one assertion to this test case.","path":"src/test/sharedBoardPresentation.test.ts","line":312,"url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=a85b796a-2e86-4821-ab2e-1dc1e8a6db40","returned":false}],"rules":[{"id":"typescript:S2699","title":"Tests should include assertions","description":"#### References\n\n##### Documentation\n\n*   Chai.js Documentation - [API Reference](https://www.chaijs.com/api/)\n*   Sinon.js Documentation - [Assertions](https://sinonjs.org/concepts/assertions/)\n*   Vitest Documentation - [API](https://vitest.dev/api/)\n*   Jest Documentation - [Expect API](https://jestjs.io/docs/expect)\n*   Playwright Documentation - [Test Assertions](https://playwright.dev/docs/test-assertions)\n*   Cypress Documentation - [Assertions](https://docs.cypress.io/app/references/assertions)\n*   Node.js Documentation - [Assert API](https://nodejs.org/api/assert.html)\n*   SuperTest Documentation - [Project page](https://github.com/ladjs/supertest)\n*   AWS CDK Documentation - [Assertions Module](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.assertions-readme.html)\n*   uvu Documentation - [Assert API](https://github.com/lukeed/uvu/blob/master/docs/api.assert.md)\n*   Bun Documentation - [Matchers](https://bun.com/docs/test/writing-tests#matchers)\n\n#### Why is this an issue?\n\nAn assertion is a statement within the unit test that checks whether a particular condition is true or false. It defines the expected behavior of the unit being tested. Assertions are used to express the test’s expected outcome, and they are the criteria against which the actual output of the unit is evaluated.\n\nWhen the unit test is executed, the assertions are evaluated. If all the assertions in the test pass, it means the unit is functioning correctly for that specific set of inputs. If any of the assertions fail, it indicates that there is a problem with the unit’s implementation, and the test case helps identify the issue.\n\nWithout assertions, a unit test doesn’t actually verify anything, making it ineffective in catching potential bugs or regressions. It will always pass, regardless of the implementation of the unit. This can lead to a false sense of security, as you may believe that your code is working correctly when it might not be.\n\nThis rule raises an issue when a test uses no assertion, although one of the following assertion libraries is available:\n\n*   `chai`\n*   `sinon`\n*   `vitest`\n*   `supertest`\n*   `jest`\n*   `jasmine`\n*   `playwright`\n*   `cypress`\n*   `node:assert`\n*   `uvu/assert`\n*   `bun:test`\n*   `aws-cdk-lib/assertions`\n\nJest, Jasmine, Cypress, and Playwright do not need to be imported: having them in your project is enough. The other libraries must be imported.\n\nBecause `aws-cdk-lib/assertions` provides assertions only, an AWS CDK test must also use a test framework such as `node:test`, Jest, or Vitest.\n\n#### How to fix it\n\nUse an assertion on a template created with `Template.fromStack`, `Template.fromJSON`, or `Template.fromString`. Assertions on `Annotations.fromStack` and `Tags.fromStack` are recognized as well.\n\n##### Noncompliant code example\n\n```\nimport { test } from \"@jest/globals\";\nimport { Stack } from \"aws-cdk-lib\";\nimport { Bucket } from \"aws-cdk-lib/aws-s3\";\nimport { Template } from \"aws-cdk-lib/assertions\";\n\ntest(\"provisions an application logs bucket\", () => { // Noncompliant: The unit test doesn't assert anything\n  const stack = new Stack();\n  new Bucket(stack, \"ApplicationLogs\", { bucketName: \"application-logs\" });\n});\n```\n\n##### Compliant solution\n\n```\nimport { test } from \"@jest/globals\";\nimport { Stack } from \"aws-cdk-lib\";\nimport { Bucket } from \"aws-cdk-lib/aws-s3\";\nimport { Template } from \"aws-cdk-lib/assertions\";\n\ntest(\"provisions an application logs bucket\", () => {\n  const stack = new Stack();\n  new Bucket(stack, \"ApplicationLogs\", { bucketName: \"application-logs\" });\n\n  Template.fromStack(stack).hasResourceProperties(\"AWS::S3::Bucket\", {\n    BucketName: \"application-logs\",\n  });\n});\n```\n\n##### How does this work?\n\nQuery methods such as `findResources`, `getResourceId`, and `toJSON` only inspect the template, so they do not count as assertions.\n\n#### How to fix it\n\nUse a Cypress assertion such as `should()` to check the application state after an interaction.\n\n##### Noncompliant code example\n\n```\ndescribe(\"login\", () => {\n  it(\"signs in a user\", () => { // Noncompliant: The unit test doesn't assert anything\n    cy.visit(\"/login\");\n    cy.get(\"[name=email]\").type(\"alice@example.com\");\n    cy.get(\"[name=password]\").type(\"secret\");\n    cy.contains(\"Sign in\").click();\n  });\n});\n```\n\n##### Compliant solution\n\n```\ndescribe(\"login\", () => {\n  it(\"signs in a user\", () => {\n    cy.visit(\"/login\");\n    cy.get(\"[name=email]\").type(\"alice@example.com\");\n    cy.get(\"[name=password]\").type(\"secret\");\n    cy.contains(\"Sign in\").click();\n\n    cy.contains(\"Welcome, Alice\").should(\"be.visible\");\n  });\n});\n```\n\n#### How to fix it\n\nUse SuperTest’s `expect()` method to check the HTTP response.\n\n##### Noncompliant code example\n\n```\nimport test from \"node:test\";\nimport request from \"supertest\";\nimport app from \"./app.js\";\n\ntest(\"returns the health status\", async () => { // Noncompliant: The unit test doesn't assert anything\n  await request(app).get(\"/health\");\n});\n```\n\n##### Compliant solution\n\n```\nimport test from \"node:test\";\nimport request from \"supertest\";\nimport app from \"./app.js\";\n\ntest(\"returns the health status\", async () => {\n  await request(app).get(\"/health\").expect(200);\n});\n```\n\n#### How to fix it\n\nUse `expect(…​)`, `assert.*`, or a completed `should` chain such as `value.should.equal(2)` or `value.should.be.true`.\n\n##### Noncompliant code example\n\n```\nconst expect = require(\"chai\").expect;\n\ndescribe(\"No assertions\", function() {\n  it(\"does not test anything\", function() { // Noncompliant: The unit test doesn't assert anything\n    const result = \"\";\n  });\n});\n```\n\n##### Compliant solution\n\n```\nconst expect = require(\"chai\").expect;\n\ndescribe(\"Assertions\", function() {\n  it(\"tests something\", function() {\n    const result = \"\";\n    expect(result).to.be.a(\"string\");\n  });\n});\n```\n\n##### Noncompliant code example\n\n```\nconst chai = require(\"chai\");\nchai.should();\n\ndescribe(\"Object validation\", function() {\n  it(\"checks an object\", function() { // Noncompliant: The unit test doesn't assert anything\n    const user = {};\n    user.should;\n  });\n});\n```\n\n##### Compliant solution\n\n```\nconst chai = require(\"chai\");\nchai.should();\n\ndescribe(\"Object validation\", function() {\n  it(\"checks an object\", function() {\n    const user = {};\n    user.should.be.an(\"object\");\n  });\n});\n```\n\n##### How does this work?\n\nA standalone `.should` access does not count as an assertion. Complete the chain with an assertion method or property.\n\n#### How to fix it\n\nUse functions from the `node:assert` module to check the expected result.\n\n##### Noncompliant code example\n\n```\nimport test from \"node:test\";\nimport assert from \"node:assert/strict\";\n\ntest(\"returns an administrator\", () => { // Noncompliant: The unit test doesn't assert anything\n  const user = findUser(\"alice\");\n});\n```\n\n##### Compliant solution\n\n```\nimport test from \"node:test\";\nimport assert from \"node:assert/strict\";\n\ntest(\"returns an administrator\", () => {\n  const user = findUser(\"alice\");\n  assert.equal(user.role, \"administrator\");\n});\n```"}]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

### Findings

- [x] [a85b796a-2e86-4821-ab2e-1dc1e8a6db40] `typescript:S2699` — Add at least one assertion to this test case. (src/test/sharedBoardPresentation.test.ts:312)
- [x] [a85b796a-2e86-4821-ab2e-1dc1e8a6db40] `typescript:S2699` — Add at least one assertion to this test case. (src/test/sharedBoardPresentation.test.ts:312) (not returned)

### End Findings



- [x] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Resume Context

**Current state:** The ready-message test asserts the resulting board scope, six status columns, and the exact snapshot message posted to the webview. It passes in the real extension host. Focused analysis of the final affected test is clean; earlier full-file analysis still reported unrelated existing diagnostics.

**Next step:** Confirm project scan clearance before completion; assess the unrelated existing snippet diagnostics separately rather than claiming they were resolved by this assertion change.

## Work Log

- Added assertions to the "ready message" test to resolve S2699 finding.
- Verified compilation passes with `npm run compile`.

### 2026-10-27 - Verification scope

- Added meaningful board-snapshot assertions after handling the ready message, without changing production behavior
- Fresh full-file SonarQube snippet analysis (`ts`, `TEST`, project key from `sonar-project.properties`) reported ten unrelated diagnostics in existing code (S1523 dynamic code execution, S7784 JSON deep cloning, and S7755 preference for `.at()`); the selected S2699 finding was not reported
- These existing diagnostics are not claimed resolved by adding assertions; a full project scan remains required, so its acceptance criterion is unchecked
- Parent real extension-host `npm test`: compilation and lint pass, 342 tests pass, including the updated ready-message test; the only failure remains the existing scanner-title fixture/assertion mismatch
- Standalone canvas suite remains 247 passing with its existing error-message assertion failure; no production canvas files were changed in this assertion cleanup

### 2026-10-27 - Observe ready-message transport behavior

- Added a minimal webview transport stub and asserted that handling `ready` posts exactly one snapshot matching `getSnapshot()`, rather than only asserting independently queried board state
- Fresh focused SonarQube analysis of the complete updated test body and imports (`ts`, `TEST`) returned zero issues; the previously recorded whole-file diagnostics are not claimed cleared
- The updated ready-message test passes in the real extension host; compile and lint pass. Integration also caught an unrelated in-progress scanner-service marker-parsing regression, forwarded to its owner before final verification
