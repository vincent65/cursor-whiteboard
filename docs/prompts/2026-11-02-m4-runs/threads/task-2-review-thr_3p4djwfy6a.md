### Spec Compliance
- Spec compliant. Both exports match the brief's signatures (`src/server/runs/prompt.ts:4-9`, `:37`). The prompt template matches the brief word for word (`:14-31`). The fallbacks `nothing` and `unknown` are in place (`:19-20`).
- The acceptance fallback `- none listed; use the task description and the specification` (`src/server/runs/prompt.ts:11-13`) is not in the brief. The report says it came from a "Fix round 0" ruling, so I accept it as sanctioned and do not count it as Extra.
- The two tests the brief lists both exist. The first test pins the whole prompt string exactly, then checks each section heading and the `gh pr create` line (`test/server/runs/prompt.test.ts:14-51`). The second test contains the brief's three `prUrlIn` assertions word for word (`:65-71`).
- I checked outside the diff for two risks:
  - The tests call `test` and `expect` without importing them. `vitest.config.ts:6` sets `globals: true`, so that works.
  - The fixture has to match the `Task` type. `Task` is `z.infer` of the schema in `src/shared/tasks.ts:14`, and the report says `tsc` passed on the fixture.
- Cannot verify from the diff: the test and `pnpm check` results are only what the report claims (RED, then GREEN with 4 tests, 303 tests and 114 files clean). I did not re-run them because nothing in the code raised a doubt.

### Strengths
- The implementation is short: one template literal and one regex with `find`. There are no extra helpers or exports.
- The exact `toBe` on the full prompt guards against drift from the brief's wording.
- Edge cases have tests:
  - CRLF line endings and surrounding whitespace.
  - When two URL lines appear, the first one is returned.
  - `/pull/7/files` and empty input both return `null`.
  - Empty `dependsOn`, `files` and `acceptance`.
- The `.js` extension is used on the relative import, and `Task` is imported as a type only (`src/server/runs/prompt.ts:1`).

### Issues
#### Critical (Must Fix)
- None.

#### Important (Should Fix)
- None.

#### Minor (Nice to Have)
- `test/server/runs/prompt.test.ts:45-50`: the heading and `gh pr create` checks repeat what the exact `toBe` above them already proves. The brief asked for them, so this is harmless duplication only.
- `src/server/runs/prompt.ts:35`: `PR_URL` rejects URLs that `gh pr create` users might still print, such as a trailing `/`, a `#...` fragment, or a URL wrapped as `<url>` or `**PR:** url`. In those cases the PR link is silently missed. This matches the brief's "exactly a URL" contract, and the prompt asks for the URL on its own line, so I accept it. A test for one tolerated wrapper would make the decision explicit.
- `src/server/runs/prompt.ts:17`: if `task.body` or `spec` ends with a newline, the prompt gets an extra blank line before the next heading. This is cosmetic only.

### Assessment
Task quality: Approved
Reasoning: Both functions match the brief exactly, and the exact-string tests pin them. The only addition beyond the brief is the sanctioned acceptance fallback, and the remaining items are polish.
