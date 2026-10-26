---
status: pending
priority: p1
issue_id: "sq-001"
tags: [code-scanning, sonarqube]
group: SonarQube
dependencies: []
scan_identity: fccc0293521eef88c1c5b36c36c3de5052479d328945bb0e990ff3821aeb90e2
scan_source: sonarqube
---

# SonarQube: typescript:S2871

Review these scanner findings and verify any fix before completing this todo.

<!-- agendo:scan-evidence:start -->
## Scanner Evidence

### Affected Locations

#### File: src/todos/todoRepository.ts | Line: 65

**Problem:** Provide a compare function that depends on "String.localeCompare", to reliably sort elements alphabetically.

**Severity:** CRITICAL

[View finding 84cb07e6-b402-4e4a-871b-1899c46c29e1](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=84cb07e6-b402-4e4a-871b-1899c46c29e1>)

#### File: src/todos/codeScanningService.ts | Line: 261

**Problem:** Provide a compare function to avoid sorting elements alphabetically.

**Severity:** CRITICAL

[View finding cfb23c13-2c20-4a09-ac22-5be87b1d7394](<https://sonarqube.jakesws.xyz/project/issues?id=JakeRoxs_agendo_0e06f1d4-7d6a-4e3c-98e8-6e6e2bbcf351&issues=cfb23c13-2c20-4a09-ac22-5be87b1d7394>)

### Rule: "Array.prototype.sort()" and "Array.prototype.toSorted()" should use a compare function

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
<!-- agendo:scan-evidence:end -->

## Acceptance Criteria

- [ ] Review each finding and address or document its disposition
- [ ] Verify changes with tests and a new scan

## Work Log
