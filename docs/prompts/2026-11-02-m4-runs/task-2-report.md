# Task 2 report: The run prompt and the PR link

## What I implemented

`src/server/runs/prompt.ts` exports two functions.

- `runPrompt({ task, taskFile, spec, branch })` returns the brief's prompt text verbatim apart from the interpolations.
  `dependsOn` and `files` are joined with `", "` and fall back to `nothing` and `unknown` when empty.
  Each acceptance line renders as one `- ` bullet.
- `prUrlIn(text)` splits on `\n`, trims each line (so `\r\n` and surrounding spaces are fine), and returns the first line matching `^https://github\.com/[^/\s]+/[^/\s]+/pull/\d+$`, or `null`.

## TDD evidence

RED: `pnpm vitest run test/server/runs/prompt.test.ts`

```
Error: Cannot find module '../../../src/server/runs/prompt.js' imported from .../test/server/runs/prompt.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

GREEN: `pnpm vitest run test/server/runs/prompt.test.ts`

```
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

`pnpm check`: both `tsc` passes clean, `biome check` "Checked 114 files ... No fixes applied.", vitest `44 passed (44)` files, `303 passed (303)` tests.
The first `pnpm check` run flagged formatting in the new test file; I ran `biome format --write` on it and reran, clean.

## Tests

1. `runPrompt carries the task, the spec, the branch, and the definition of done`: asserts the whole prompt string exactly, each section heading, and the `gh pr create` line.
2. `runPrompt says nothing and unknown when a task has no dependencies or files`.
3. `prUrlIn finds a PR URL on its own line and ignores inline mentions`: the brief's three assertions.
4. `prUrlIn allows surrounding whitespace and takes the first URL line`: whitespace and CRLF, first of two URLs wins, `/pull/7/files` and empty input give `null`.

## Manual verification

The brief names none.

## Files changed

- Created `src/server/runs/prompt.ts`
- Created `test/server/runs/prompt.test.ts`

Commit: `f88815f feat(runs): the run prompt and PR link detection` (no co-author trailer).

## Self-review

- Prompt text compared line by line against the brief, and the exact-string test pins it.
- Relative imports use `.js` extensions; `Task` is imported as a type only.
- Only the two files the brief lists were touched; no new dependencies.

## Concerns

- A task with no acceptance lines renders `Acceptance:` followed by an empty line.
  The brief gives no fallback for that case, so I left it as is; the split's tasks normally carry acceptance lines.

## Fix round 0

Ruling: a task with no acceptance lines renders `Acceptance:` followed by `- none listed; use the task description and the specification`.
- `runPrompt` falls back to that bullet when `task.acceptance` is empty.
- The "nothing and unknown" test now also empties `acceptance` and asserts the fallback line sits between `Acceptance:` and `## Specification`.
- RED (source change stashed): `pnpm vitest run test/server/runs/prompt.test.ts` gave `× runPrompt says nothing, unknown, and none listed ...`, 1 failed.
- GREEN: the same command gave 4 passed. `pnpm check` was clean: "Checked 114 files ... No fixes applied.", 44 files, 303 tests passed.
- Commit: `fix(runs): the run prompt says when no acceptance checks are listed` (no co-author trailer).
- The concern above is resolved.
