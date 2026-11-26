---
status: ready
priority: p3
issue_id: "sq-024"
tags: [code-scanning, sonarqube]
dependencies: []
scan_identity: a5cdfccbde5ad38484a5232c514b7c691e3416e124ed7ee53f5318f7e9927020
scan_source: sonarqube
scan_scope: "https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351"
scan_grouping: file
scan_target: "src/todos/todoModel.ts"
scan_refreshed_at: "2026-11-26T10:07:09.106Z"
scan_review_required: false
---

# src/todos/todoModel.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-11-26T10:07:09.106Z

**Branch:** Default branch

1 reported; 0 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/todos/todoModel.ts | Line: not reported

**Rule:** typescript:S7763

**Problem:** Use \`export…from\` to re-export \`buildFileName\`.

**Severity:** MINOR

[View finding ac02220e-ca98-4167-a972-6a550162d51f](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=ac02220e-ca98-4167-a972-6a550162d51f>)

### Rule: Re-exports should use "export...from" syntax

**Rule ID:** typescript:S7763

#### Overview

This rule raises an issue when code imports named or namespace bindings from a module and then immediately re-exports them, possibly under a different name, without using them elsewhere.

#### Why is this an issue?

When re-exporting named or namespace bindings from a module, using separate import and export statements creates unnecessary verbosity and intermediate variables.

The pattern of importing something just to export it again is common when creating barrel exports or module facades. However, JavaScript provides the `export…​from` syntax specifically for this use case.

Using `import` followed by `export` for re-exports has several drawbacks:

*   It creates unnecessary intermediate variables that serve no purpose
*   It makes the code more verbose and harder to read
*   It requires two statements where one would suffice
*   It can confuse readers about whether the imported values are used locally

The `export…​from` syntax is more explicit about the intent to re-export and eliminates the intermediate step entirely.

##### What is the potential impact?

This issue affects code readability and maintainability. While it doesn’t cause runtime problems, it makes the codebase more verbose and potentially confusing for developers who need to understand the module’s exports.

##### How to fix?

Replace the import and export statements with a single `export…​from` statement. Use `export { …​ } from` for named re-exports and `export * as …​ from` for namespace re-exports. Preserve any aliases in the export clause.

##### Non-compliant code examples

```
import { named } from './foo.js';
export { named }; // Noncompliant
```

```
import * as ns from './foo.js';
export { ns }; // Noncompliant
```

##### Compliant code examples

```
export { named } from './foo.js';
```

```
export * as ns from './foo.js';
```

##### Exceptions

No issue will be raised when re-exporting a default import. This includes cases where the imported default is re-exported under a named alias.

```
import logger from './logger.js';
export { logger as appLogger };
```

No issue will be raised when named or namespace imports are also used locally in the same module. Replacing the import with an `export…​from` statement would remove the local binding needed by that local usage.

```
import { foo } from './foo.js';
export const values = [foo];
export { foo };
```

##### Documentation

*   [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn#readme) - Rule [prefer-export-from](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/HEAD/docs/rules/prefer-export-from.md)
*   MDN - export statement - [Comprehensive documentation on JavaScript export statements including export…​from syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export)
*   MDN - import statement - [Documentation on JavaScript import statements and module imports](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import)

<!-- agendo:scan-snapshot
{"source":"sonarqube","scope":"https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351","grouping":"file","target":"src/todos/todoModel.ts","version":1,"retrievedAt":"2026-11-26T10:07:09.106Z","findings":[{"id":"ac02220e-ca98-4167-a972-6a550162d51f","rule":"typescript:S7763","severity":"MINOR","message":"Use `export…from` to re-export `buildFileName`.","path":"src/todos/todoModel.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=ac02220e-ca98-4167-a972-6a550162d51f","resolved":false,"returned":true}],"rules":[{"id":"typescript:S7763","title":"Re-exports should use \"export...from\" syntax","description":"#### Overview\n\nThis rule raises an issue when code imports named or namespace bindings from a module and then immediately re-exports them, possibly under a different name, without using them elsewhere.\n\n#### Why is this an issue?\n\nWhen re-exporting named or namespace bindings from a module, using separate import and export statements creates unnecessary verbosity and intermediate variables.\n\nThe pattern of importing something just to export it again is common when creating barrel exports or module facades. However, JavaScript provides the `export…​from` syntax specifically for this use case.\n\nUsing `import` followed by `export` for re-exports has several drawbacks:\n\n*   It creates unnecessary intermediate variables that serve no purpose\n*   It makes the code more verbose and harder to read\n*   It requires two statements where one would suffice\n*   It can confuse readers about whether the imported values are used locally\n\nThe `export…​from` syntax is more explicit about the intent to re-export and eliminates the intermediate step entirely.\n\n##### What is the potential impact?\n\nThis issue affects code readability and maintainability. While it doesn’t cause runtime problems, it makes the codebase more verbose and potentially confusing for developers who need to understand the module’s exports.\n\n##### How to fix?\n\nReplace the import and export statements with a single `export…​from` statement. Use `export { …​ } from` for named re-exports and `export * as …​ from` for namespace re-exports. Preserve any aliases in the export clause.\n\n##### Non-compliant code examples\n\n```\nimport { named } from './foo.js';\nexport { named }; // Noncompliant\n```\n\n```\nimport * as ns from './foo.js';\nexport { ns }; // Noncompliant\n```\n\n##### Compliant code examples\n\n```\nexport { named } from './foo.js';\n```\n\n```\nexport * as ns from './foo.js';\n```\n\n##### Exceptions\n\nNo issue will be raised when re-exporting a default import. This includes cases where the imported default is re-exported under a named alias.\n\n```\nimport logger from './logger.js';\nexport { logger as appLogger };\n```\n\nNo issue will be raised when named or namespace imports are also used locally in the same module. Replacing the import with an `export…​from` statement would remove the local binding needed by that local usage.\n\n```\nimport { foo } from './foo.js';\nexport const values = [foo];\nexport { foo };\n```\n\n##### Documentation\n\n*   [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn#readme) - Rule [prefer-export-from](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/HEAD/docs/rules/prefer-export-from.md)\n*   MDN - export statement - [Comprehensive documentation on JavaScript export statements including export…​from syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export)\n*   MDN - import statement - [Documentation on JavaScript import statements and module imports](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import)"}]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

- [ ] **Next:** Run a fresh full SonarQube scan to confirm S7763 clearance; direct re-export syntax is local evidence only.

### Findings

- [ ] [ac02220e-ca98-4167-a972-6a550162d51f] `typescript:S7763` — Already fixed in current source using direct `export { buildFileName } from ...` syntax. (src/todos/todoModel.ts)

### End Findings


- [x] Review each finding and document its local disposition
- [ ] Verify changes with tests and a new scan

## Work Log

- 2026-11-26: Classified S7763 as already fixed in current source. Imported results are historical; no fresh scan was performed, so todo remains open pending confirmation.
- Validation: `npm test -- --grep "root registry"` passed (563 passing); `npm run compile` passed; `git diff --check` passed.

## Resume Context

**Current state:** `buildFileName` is already directly re-exported; no further local code work identified.
**Next step:** Run a fresh full SonarQube scan and verify S7763 clearance; do not complete before scan confirmation.
