---
status: ready
priority: p1
issue_id: "sq-015"
tags: [code-scanning, sonarqube]
dependencies: []
scan_identity: 9b484f13293f562b84bd01e35ddff0d98a08984cef56b1888280500e958ed5fa
scan_source: sonarqube
scan_scope: "https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351"
scan_grouping: file
scan_target: "src/todos/todoRepository.ts"
scan_refreshed_at: "2026-10-27T05:16:51.141Z"
scan_review_required: true
---

# SonarQube: src/todos/todoRepository.ts

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

**Retrieved:** 2026-10-27T05:16:51.141Z

**Branch:** Default branch

1 reported; 0 not returned. This retrieves existing scanner results, not a new analysis.

### Affected Locations

#### File: src/todos/todoRepository.ts | Line: not reported

**Rule:** typescript:S2871

**Problem:** Provide a compare function that depends on "String.localeCompare", to reliably sort elements alphabetically.

**Severity:** CRITICAL

[View finding 84cb07e6-b402-4e4a-871b-1899c46c29e1](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=84cb07e6-b402-4e4a-871b-1899c46c29e1>)

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

<!-- agendo:scan-snapshot
{"source":"sonarqube","scope":"https://sonarqube.jakesws.xyz/#JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351","grouping":"file","target":"src/todos/todoRepository.ts","version":1,"retrievedAt":"2026-10-27T05:16:51.141Z","findings":[{"id":"84cb07e6-b402-4e4a-871b-1899c46c29e1","rule":"typescript:S2871","severity":"CRITICAL","message":"Provide a compare function that depends on \"String.localeCompare\", to reliably sort elements alphabetically.","path":"src/todos/todoRepository.ts","url":"https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=84cb07e6-b402-4e4a-871b-1899c46c29e1","resolved":false,"returned":true}],"rules":[{"id":"typescript:S2871","title":"\"Array.prototype.sort()\" and \"Array.prototype.toSorted()\" should use a compare function","description":"#### Why is this an issue?\n\nJavaScript provides built-in methods to sort arrays, making it convenient for developers to manipulate data. There are two primary ways to sort an array:\n\n*   `Array.prototype.sort()`: This method sorts the elements of an array in place and returns the sorted array.\n*   `Array.prototype.toSorted()`: This method is designed to return a new sorted array, leaving the original array unchanged.\n\nThe default sort order is lexicographic (dictionary) order, based on the string representation of the elements. This means that when sorting an array of strings, numbers, or other elements, they are converted to strings and sorted according to their Unicode code points (UTF-16). For most cases, this default behavior is suitable when sorting an array of strings.\n\nHowever, it’s essential to be aware of potential pitfalls when sorting arrays of non-string elements, particularly numbers. The lexicographic order may not always produce the expected results for numbers:\n\n```\nconst numbers = [10, 2, 30, 1, 5];\nnumbers.sort(); // Noncompliant: lexicographic sort\nconsole.log(numbers); // Output: [1, 10, 2, 30, 5]\n```\n\nTo sort numbers correctly, you must provide a custom comparison function that returns the correct ordering:\n\n```\nconst numbers = [10, 2, 30, 1, 5];\nnumbers.sort((a, b) => a - b);\nconsole.log(numbers); // Output: [1, 2, 5, 10, 30]\n```\n\nEven to sort strings, the default sort order may give unexpected results. Not only does it not support localization, it also doesn’t fully support Unicode, as it only considers UTF-16 code units. For example, in the code below, `\"eΔ\"` is surprisingly before and after `\"éΔ\"`. To guarantee that the sorting is reliable and remains as such in the long run, it is necessary to provide a compare function that is both locale and Unicode aware - typically `String.localeCompare`.\n\n```\nconst code1 = '\\u00e9\\u0394'; // \"éΔ\"\nconst code2 = '\\u0065\\u0301\\u0394'; // \"éΔ\" using Unicode combining marks\nconst code3 = '\\u0065\\u0394'; // \"eΔ\"\nconsole.log([code1, code2, code3].sort()); // Noncompliant: [\"éΔ\", \"eΔ\", \"éΔ\"], \"eΔ\" position is inconsistent\nconsole.log([code1, code2, code3].sort((a, b) => a.localeCompare(b))); // [\"eΔ\", \"éΔ\", \"éΔ\"]\n```\n\n##### Exceptions\n\nThis rule does not apply when two arrays of primitive values are sorted with the same method and then serialized before an equality or inequality comparison. In patterns such as `JSON.stringify(a.sort()) === JSON.stringify(b.sort())` or `JSON.stringify(a.toSorted()) !== JSON.stringify(b.toSorted())`, sorting is only used to normalize element order before comparing the serialized values.\n\n```\nfunction haveSameElements(left, right) {\n  return JSON.stringify(left.sort()) === JSON.stringify(right.sort());\n}\n\nfunction differ(left, right) {\n  return JSON.stringify(left.toSorted()) !== JSON.stringify(right.toSorted());\n}\n```\n\n#### References\n\n##### Documentation\n\n*   MDN web docs - [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)\n*   MDN web docs - [`Array.prototype.toSorted()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted)\n*   MDN web docs - [`String.prototype.localeCompare()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare)"}]}
-->
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

### Findings

- [x] [84cb07e6-b402-4e4a-871b-1899c46c29e1] `typescript:S2871` — Provide a compare function that depends on "String.localeCompare", to reliably sort elements alphabetically. (src/todos/todoRepository.ts)

### End Findings




- [x] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Work Log

### 2026-10-27 - Scoped group sorting

- Confirmed scoped groups use default UTF-16 sorting while cached groups use `localeCompare`
- Implementing the same locale-aware comparator for scoped groups with mixed-case regression coverage in `src/test/todoModel.test.ts`
- `npm run compile` and `npm run lint` pass
- `npm test`: 322 passing, including the repository regression; one unrelated failure in the pre-existing `src/test/codeScanning.test.ts` edit (file-name fixture versus rule-name assertion), left untouched
- Fresh SonarQube `analyze_code_snippet` on the complete updated production file (`ts`, `MAIN`, project key resolved from `sonar-project.properties`) returned zero issues
- Remains ready pending a full project scan; snippet analysis does not establish remote finding clearance
- Final integrated `npm test`: compile and lint pass, 335 passing tests, same unrelated pre-existing scanner canvas title assertion failure

## Resume Context

**Current state:** Scoped and cached groups now share locale-aware ordering; regression tests and fresh full-file snippet analysis pass.

**Next step:** Confirm finding clearance in a full project SonarQube scan before completion.
