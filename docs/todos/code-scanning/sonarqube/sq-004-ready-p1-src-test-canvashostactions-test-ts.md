---
status: ready
priority: p1
issue_id: "sq-004"
tags: [code-scanning, sonarqube]
dependencies: []
scan_identity: e247191605c55fbc967f23b9b4ffc67077df64184510cea7cfe94abe7e4afde3
scan_source: sonarqube
scan_scope: "https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351"
scan_grouping: file
scan_target: "src/test/canvasHostActions.test.ts"
scan_refreshed_at: "2026-10-27T16:35:51.526Z"
scan_review_required: true
---

# SonarQube: src/test/canvasHostActions.test.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-10-27T16:35:51.526Z

**Branch:** Default branch

1 reported; 0 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/test/canvasHostActions.test.ts | Line: not reported

**Rule:** typescript:S2699

**Problem:** Add at least one assertion to this test case.

**Severity:** BLOCKER

[View finding 4ee95d0f-f8f6-4a12-b8a7-4767f076e778](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=4ee95d0f-f8f6-4a12-b8a7-4767f076e778>)

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
{"source":"sonarqube","scope":"https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351","grouping":"file","target":"src/test/canvasHostActions.test.ts","version":1,"retrievedAt":"2026-10-27T16:35:51.526Z","findings":[{"id":"4ee95d0f-f8f6-4a12-b8a7-4767f076e778","rule":"typescript:S2699","severity":"BLOCKER","message":"Add at least one assertion to this test case.","path":"src/test/canvasHostActions.test.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=4ee95d0f-f8f6-4a12-b8a7-4767f076e778","resolved":false,"returned":true}],"rules":[{"id":"typescript:S2699","title":"Tests should include assertions","description":"#### References\n\n##### Documentation\n\n*   Chai.js Documentation - [API Reference](https://www.chaijs.com/api/)\n*   Sinon.js Documentation - [Assertions](https://sinonjs.org/concepts/assertions/)\n*   Vitest Documentation - [API](https://vitest.dev/api/)\n*   Jest Documentation - [Expect API](https://jestjs.io/docs/expect)\n*   Playwright Documentation - [Test Assertions](https://playwright.dev/docs/test-assertions)\n*   Cypress Documentation - [Assertions](https://docs.cypress.io/app/references/assertions)\n*   Node.js Documentation - [Assert API](https://nodejs.org/api/assert.html)\n*   SuperTest Documentation - [Project page](https://github.com/ladjs/supertest)\n*   AWS CDK Documentation - [Assertions Module](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.assertions-readme.html)\n*   uvu Documentation - [Assert API](https://github.com/lukeed/uvu/blob/master/docs/api.assert.md)\n*   Bun Documentation - [Matchers](https://bun.com/docs/test/writing-tests#matchers)\n\n#### Why is this an issue?\n\nAn assertion is a statement within the unit test that checks whether a particular condition is true or false. It defines the expected behavior of the unit being tested. Assertions are used to express the test’s expected outcome, and they are the criteria against which the actual output of the unit is evaluated.\n\nWhen the unit test is executed, the assertions are evaluated. If all the assertions in the test pass, it means the unit is functioning correctly for that specific set of inputs. If any of the assertions fail, it indicates that there is a problem with the unit’s implementation, and the test case helps identify the issue.\n\nWithout assertions, a unit test doesn’t actually verify anything, making it ineffective in catching potential bugs or regressions. It will always pass, regardless of the implementation of the unit. This can lead to a false sense of security, as you may believe that your code is working correctly when it might not be.\n\nThis rule raises an issue when a test uses no assertion, although one of the following assertion libraries is available:\n\n*   `chai`\n*   `sinon`\n*   `vitest`\n*   `supertest`\n*   `jest`\n*   `jasmine`\n*   `playwright`\n*   `cypress`\n*   `node:assert`\n*   `uvu/assert`\n*   `bun:test`\n*   `aws-cdk-lib/assertions`\n\nJest, Jasmine, Cypress, and Playwright do not need to be imported: having them in your project is enough. The other libraries must be imported.\n\nBecause `aws-cdk-lib/assertions` provides assertions only, an AWS CDK test must also use a test framework such as `node:test`, Jest, or Vitest.\n\n#### How to fix it\n\nUse an assertion on a template created with `Template.fromStack`, `Template.fromJSON`, or `Template.fromString`. Assertions on `Annotations.fromStack` and `Tags.fromStack` are recognized as well.\n\n##### Noncompliant code example\n\n```\nimport { test } from \"@jest/globals\";\nimport { Stack } from \"aws-cdk-lib\";\nimport { Bucket } from \"aws-cdk-lib/aws-s3\";\nimport { Template } from \"aws-cdk-lib/assertions\";\n\ntest(\"provisions an application logs bucket\", () => { // Noncompliant: The unit test doesn't assert anything\n  const stack = new Stack();\n  new Bucket(stack, \"ApplicationLogs\", { bucketName: \"application-logs\" });\n});\n```\n\n##### Compliant solution\n\n```\nimport { test } from \"@jest/globals\";\nimport { Stack } from \"aws-cdk-lib\";\nimport { Bucket } from \"aws-cdk-lib/aws-s3\";\nimport { Template } from \"aws-cdk-lib/assertions\";\n\ntest(\"provisions an application logs bucket\", () => {\n  const stack = new Stack();\n  new Bucket(stack, \"ApplicationLogs\", { bucketName: \"application-logs\" });\n\n  Template.fromStack(stack).hasResourceProperties(\"AWS::S3::Bucket\", {\n    BucketName: \"application-logs\",\n  });\n});\n```\n\n##### How does this work?\n\nQuery methods such as `findResources`, `getResourceId`, and `toJSON` only inspect the template, so they do not count as assertions.\n\n#### How to fix it\n\nUse a Cypress assertion such as `should()` to check the application state after an interaction.\n\n##### Noncompliant code example\n\n```\ndescribe(\"login\", () => {\n  it(\"signs in a user\", () => { // Noncompliant: The unit test doesn't assert anything\n    cy.visit(\"/login\");\n    cy.get(\"[name=email]\").type(\"alice@example.com\");\n    cy.get(\"[name=password]\").type(\"secret\");\n    cy.contains(\"Sign in\").click();\n  });\n});\n```\n\n##### Compliant solution\n\n```\ndescribe(\"login\", () => {\n  it(\"signs in a user\", () => {\n    cy.visit(\"/login\");\n    cy.get(\"[name=email]\").type(\"alice@example.com\");\n    cy.get(\"[name=password]\").type(\"secret\");\n    cy.contains(\"Sign in\").click();\n\n    cy.contains(\"Welcome, Alice\").should(\"be.visible\");\n  });\n});\n```\n\n#### How to fix it\n\nUse SuperTest’s `expect()` method to check the HTTP response.\n\n##### Noncompliant code example\n\n```\nimport test from \"node:test\";\nimport request from \"supertest\";\nimport app from \"./app.js\";\n\ntest(\"returns the health status\", async () => { // Noncompliant: The unit test doesn't assert anything\n  await request(app).get(\"/health\");\n});\n```\n\n##### Compliant solution\n\n```\nimport test from \"node:test\";\nimport request from \"supertest\";\nimport app from \"./app.js\";\n\ntest(\"returns the health status\", async () => {\n  await request(app).get(\"/health\").expect(200);\n});\n```\n\n#### How to fix it\n\nUse `expect(…​)`, `assert.*`, or a completed `should` chain such as `value.should.equal(2)` or `value.should.be.true`.\n\n##### Noncompliant code example\n\n```\nconst expect = require(\"chai\").expect;\n\ndescribe(\"No assertions\", function() {\n  it(\"does not test anything\", function() { // Noncompliant: The unit test doesn't assert anything\n    const result = \"\";\n  });\n});\n```\n\n##### Compliant solution\n\n```\nconst expect = require(\"chai\").expect;\n\ndescribe(\"Assertions\", function() {\n  it(\"tests something\", function() {\n    const result = \"\";\n    expect(result).to.be.a(\"string\");\n  });\n});\n```\n\n##### Noncompliant code example\n\n```\nconst chai = require(\"chai\");\nchai.should();\n\ndescribe(\"Object validation\", function() {\n  it(\"checks an object\", function() { // Noncompliant: The unit test doesn't assert anything\n    const user = {};\n    user.should;\n  });\n});\n```\n\n##### Compliant solution\n\n```\nconst chai = require(\"chai\");\nchai.should();\n\ndescribe(\"Object validation\", function() {\n  it(\"checks an object\", function() {\n    const user = {};\n    user.should.be.an(\"object\");\n  });\n});\n```\n\n##### How does this work?\n\nA standalone `.should` access does not count as an assertion. Complete the chain with an assertion method or property.\n\n#### How to fix it\n\nUse functions from the `node:assert` module to check the expected result.\n\n##### Noncompliant code example\n\n```\nimport test from \"node:test\";\nimport assert from \"node:assert/strict\";\n\ntest(\"returns an administrator\", () => { // Noncompliant: The unit test doesn't assert anything\n  const user = findUser(\"alice\");\n});\n```\n\n##### Compliant solution\n\n```\nimport test from \"node:test\";\nimport assert from \"node:assert/strict\";\n\ntest(\"returns an administrator\", () => {\n  const user = findUser(\"alice\");\n  assert.equal(user.role, \"administrator\");\n});\n```"}]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

### Findings

- [x] [4ee95d0f-f8f6-4a12-b8a7-4767f076e778] `typescript:S2699` — Add at least one assertion to this test case. (src/test/canvasHostActions.test.ts)

### End Findings






- [x] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Work Log

### 2026-10-27 - Verify clean-todo authorization

- Adding explicit assertions for the clean-todo authorization result and required repository refresh
- Preserving all prior malformed-input and guard regressions in this test file
- Fresh SonarQube `analyze_code_snippet` on the complete updated test source (`ts`, `TEST`, project key from `sonar-project.properties`) reports zero issues
- `npm test`: compilation and lint pass, 342 tests pass including the clean-todo authorization assertions; only the unchanged user-owned scanner-title fixture/assertion mismatch fails
- `git diff --check` passes; full-project scan clearance is not claimed

## Resume Context

**Current state:** Clean-todo authorization asserts the void result and exactly one repository refresh; real extension-host tests and fresh full-file snippet analysis pass.

**Next step:** Confirm clearance in a full project SonarQube scan before completion.
