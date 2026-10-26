---
status: pending
priority: p2
issue_id: "040"
tags: [code-scanning, workflow, related-files, skill]
group: scanner-workflow
dependencies: ["038"]
---

# Scanner Related-File Work Scope and Linked Findings

Treat a file-based import as a focus for investigation, not a prohibition against necessary changes in related files.

## Problem Statement

A finding reported in one file may require changes to a shared helper, caller, test, or other related file. Users and agents need to distinguish necessary implementation work from unrelated cleanup, explain those changes, and reference overlapping findings without merging independently imported todos or silently declaring their work complete.

## Findings

- File grouping currently selects findings by their scanner-reported full path. It does not establish an implementation scope or enumerate required edits elsewhere.
- Different grouping modes can contain the same upstream finding while retaining independent todo identities and notes.
- The bundled skill already supports Findings, Recommended Action, Acceptance Criteria, Resume Context, dependencies, and Work Log; these can express the plan without introducing another tracking hierarchy.
- The user wants necessary refactors and related-file fixes to remain part of the main task when they directly address its findings.

## Recommended Action

Proposed for triage: record the main imported target and a small related-files plan with a reason and linked finding IDs for each necessary change. Include that work in additional acceptance criteria. Keep small, directly necessary changes in the same todo; create a linked pending todo for independent cleanup, a separately verifiable larger change, or work needing separate approval. Reference overlapping scanner findings rather than automatically merging or closing their todos.

## Acceptance Criteria

- [ ] Workflow guidance explicitly permits necessary changes outside the scanner's main reported file
- [ ] Related-file work records its purpose and relationship to the main finding or required regression test
- [ ] Additional criteria can cover a shared helper, caller updates, refactor, and tests without fabricating scanner findings for those files
- [ ] The work plan distinguishes related findings already in the selected import from references to findings in other todos/grouping modes
- [ ] Overlap references do not propagate checklist completion, change lifecycle, or merge notes across independent todos
- [ ] Any claimed clearance in another file is supported by appropriate tests and scanner evidence, not inferred solely from a related edit
- [ ] Independent cleanup or materially expanded work becomes a linked pending todo instead of silently expanding the approved task
- [ ] Documentation and skill examples cover a local fix, a shared-helper fix spanning files, and a change overlapping another scanner todo
- [ ] Canvas/context presentation makes the primary file and planned related files distinguishable where useful

## Technical Details

Primary areas: bundled Agendo skill, scanner todo work-plan conventions, additional-work criteria from todo 038, and canvas context where needed. Prefer existing Markdown sections and links; add structured metadata only if an actual UI/action needs it. Do not turn this into automated whole-repository finding reconciliation or an architectural-refactor planner.

## Resume Context

**Current state:** Scope policy captured for review; no existing todo has been broadened, merged, or moved.

**Next step:** Draft the smallest related-files work-plan example against the checklist model in todo 038 and use it to decide whether any new UI field is necessary.

## Work Log

### 2026-10-25 - Follow-up Created

**By:** Kilo

**Actions:**

- Recorded the user's request to account for directly related fixes outside the imported main file
- Defined the boundary between necessary supporting changes and separately tracked work
- Preserved independent ownership of existing scanner todos and grouping modes
