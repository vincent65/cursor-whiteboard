You are reviewing one task's implementation: first whether it matches its requirements, then whether it is well-built. This is a task-scoped gate, not a merge review; a broad whole-branch review happens separately after all tasks are complete.

## What Was Requested

Read the task brief: /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/task-8-brief.md

Global constraints from the spec that bind this task:
- Node 22.1 or later; TypeScript strict; ESM; server code uses NodeNext resolution with explicit `.js` extensions on relative imports.
- No API key anywhere. The SDK runs on the user's Claude Code login; Blueprint never reads, stores, or forwards credentials.
- Claude never edits board files directly: proposals are the only write path, and the `PreToolUse` guard from milestone 1 stays.
- AI edits are never applied without an accept step: every operation lands as a ghost first, and only `accepted` makes it real.
- Ghost styling: added elements at `opacity: 40` with `strokeStyle: "dashed"` and the proposal id appended to `groupIds` as the outermost group; updated elements with `strokeStyle: "dashed"`; deleted elements at `opacity: 40` with `strokeStyle: "dashed"` and `strokeColor: "#e03131"`. Ghosts are not locked.
- Every element Blueprint creates or accepts carries `customData.origin: "ai"` and `customData.proposalId`.
- Placement: beside the anchor's bounding box with an 80 pixel gap to the right, top-aligned; several additions in one proposal stack downward with a 40 pixel gap; with nothing to anchor on, centered in the viewport.
- Diagrams must be flowchart, sequence, class, ER, or state Mermaid; anything the importer turns into an image is rejected with a message naming those five kinds.
- All agent output reaches the browser as typed WebSocket messages; commands go through HTTP routes so they are testable with `app.request()`.
- No "Claude Code" branding in UI copy; the panel is titled `Claude`.
- Every UI test file that renders components or hooks starts with `// @vitest-environment jsdom`.
- Commit messages use conventional commits and carry no co-author trailer.
- `pnpm check` (both typechecks, Biome, Vitest) stays pristine; `pnpm build` warns only about the pre-existing chunk size.

## What the Implementer Claims They Built

Read the implementer's report: /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/task-8-report.md

## Diff Under Review

Base: fab1e18
Head: a8d2db0
Diff file: /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/review-fab1e18..a8d2db0.diff

Read the diff file once. It contains the commit list, a stat summary, and the full diff with context. The diff's context lines are the changed files: do not Read a changed file separately unless a hunk you must judge is cut off, and say so in your report. Do not re-run git commands. Do not crawl the broader codebase. Inspect code outside the diff only to evaluate a concrete risk you can name, and name both the risk and what you checked.

Your review is read-only on this checkout. Do not mutate the working tree, the index, HEAD, or branch state in any way.

## You Do Not Dispatch Subagents

Do all of this review yourself. Never spawn a subagent or another reviewer.

## Do Not Trust the Report

Treat the implementer's report as unverified claims, including its design rationales. Verify them against the diff. A stated rationale never downgrades a finding's severity.

## Tests

The implementer already ran the tests and reported results with TDD evidence. Do not re-run the suite to confirm. Run a focused test only when reading the code raises a specific doubt no existing run answers. Warnings or noise in the reported output are findings. If the report's evidence looks truncated, re-read the report file; if it is genuinely missing, report that as a gap.

## Part 1: Spec Compliance

Compare the diff against the brief: Missing (skipped or claimed without implementing), Extra (unrequested features, files, exports), Misunderstood (right thing built the wrong way). Check every test the brief lists exists and asserts what the brief says. Report anything you cannot verify from the diff alone as a warning item.

## Part 2: Code Quality

Separation of concerns, error handling, DRY without premature abstraction, edge cases; whether tests verify real behavior rather than mocks and cover the task's edge cases; whether each file has one responsibility and follows the plan's structure.

Point at evidence with file:line references for every finding.

## Calibration

Important means this task cannot be trusted until fixed: incorrect or fragile behavior, a missed requirement, or maintainability damage you would block a merge over. Polish is Minor. If the brief mandates something this rubric calls a defect, report it as Important, labeled plan-mandated. Acknowledge what was done well before listing issues.

## Output Format

Your final message is the report itself. Begin directly with the spec-compliance verdict; every line is a verdict, a finding with file:line, or a check you ran.

### Spec Compliance
- Spec compliant | Issues found: ...
- Cannot verify from diff: ...

### Strengths

### Issues
#### Critical (Must Fix)
#### Important (Should Fix)
#### Minor (Nice to Have)

### Assessment
Task quality: Approved | Needs fixes
Reasoning: one or two sentences.
