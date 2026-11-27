---
status: ready
priority: p2
issue_id: "sq-021"
tags: [code-scanning, sonarqube]
dependencies: []
scan_identity: 92e54142e7b484fc82b2c12dec338a83294117b6a49eb7cd83f5064f92614daa
scan_source: sonarqube
scan_scope: "https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351"
scan_grouping: file
scan_target: "src/todos/configService.ts"
scan_refreshed_at: "2026-11-26T10:07:09.106Z"
scan_review_required: false
---

# src/todos/configService.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-11-26T10:07:09.106Z

**Branch:** Default branch

1 reported; 0 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/todos/configService.ts | Line: not reported

**Rule:** typescript:S2933

**Problem:** Mark this member as \`readonly\`.

**Severity:** MAJOR

[View finding 4de8c6fd-c1b6-4864-b779-bd891a5da748](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=4de8c6fd-c1b6-4864-b779-bd891a5da748>)

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

<!-- agendo:scan-snapshot
{"source":"sonarqube","scope":"https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351","grouping":"file","target":"src/todos/configService.ts","version":1,"retrievedAt":"2026-11-26T10:07:09.106Z","findings":[{"id":"4de8c6fd-c1b6-4864-b779-bd891a5da748","rule":"typescript:S2933","severity":"MAJOR","message":"Mark this member as `readonly`.","path":"src/todos/configService.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=4de8c6fd-c1b6-4864-b779-bd891a5da748","resolved":false,"returned":true}],"rules":[{"id":"typescript:S2933","title":"Fields that are only assigned in the constructor should be \"readonly\"","description":"#### References\n\n##### Documentation\n\n*   [typescript-eslint](https://typescript-eslint.io/) - Rule [prefer-readonly](https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/docs/rules/prefer-readonly.mdx)\n*   TypeScript Documentation - [readonly](https://www.typescriptlang.org/docs/handbook/2/classes.html#readonly)\n\n#### How to fix it\n\nMark the given field with the `readonly` modifier.\n\nFor JavaScript and TypeScript, [S2933](/coding_rules#rule_key=javascript%3AS2933) reports one issue per class and uses secondary locations for each field that should be marked `readonly`.\n\n##### Noncompliant code example\n\n```\nclass Person { // Noncompliant: Mark this member as `readonly`.\n  private birthYear: number;\n\n  constructor(birthYear: number) {\n    this.birthYear = birthYear;\n  }\n}\n```\n\n##### Compliant solution\n\n```\nclass Person {\n  private readonly birthYear: number;\n\n  constructor(birthYear: number) {\n    this.birthYear = birthYear;\n  }\n}\n```\n\nWhen more than one field in the same class should be marked `readonly`, the issue remains on the class and each affected field is listed as a secondary location.\n\n```\nclass Person { // Noncompliant: Mark these members as `readonly`.\n  private birthYear: number;\n  private age: number;\n\n  constructor(birthYear: number, age: number) {\n    this.birthYear = birthYear;\n    this.age = age;\n  }\n}\n```\n\n```\nclass Person {\n  private readonly birthYear: number;\n  private readonly age: number;\n\n  constructor(birthYear: number, age: number) {\n    this.birthYear = birthYear;\n    this.age = age;\n  }\n}\n```\n\n#### Why is this an issue?\n\n`readonly` fields can only be assigned in a class constructor. If a class has a field that’s not marked `readonly` but is only set in the constructor, it could cause confusion about the field’s intended use. To avoid confusion, such fields should be marked `readonly` to make their intended use explicit, and to prevent future maintainers from inadvertently changing their use."}]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

- [ ] **Next:** Run a fresh full SonarQube scan to confirm S2933 clearance; readonly declarations in current source are local evidence only.

### Findings

- [ ] [4de8c6fd-c1b6-4864-b779-bd891a5da748] `typescript:S2933` — Current source has constructor-bound `workspaceState` and `explicitRootUri` declared `readonly`; finding appears already fixed. Fresh scan required to confirm clearance. (src/todos/configService.ts)

### End Findings


- [x] Review each finding and document its local disposition
- [ ] Verify changes with tests and a new scan

## Work Log

- 2026-11-26: Classified S2933 as already fixed in current source: constructor-only `workspaceState` and `explicitRootUri` are readonly. No fresh scan was performed; todo remains open pending confirmation.
- Validation: `npm test -- --grep "root registry"` passed (563 passing); `npm run compile` passed; `git diff --check` passed.

## Resume Context

**Current state:** Constructor-only `workspaceState` and `explicitRootUri` are readonly; no remaining code change identified.
**Next step:** Run a fresh full SonarQube scan and verify S2933 clearance; do not complete before scan confirmation.
