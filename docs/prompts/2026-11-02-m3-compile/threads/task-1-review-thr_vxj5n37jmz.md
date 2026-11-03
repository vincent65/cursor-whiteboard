### Spec Compliance
- **Verdict: spec compliant.** Every export in the brief is present with the specified signature: `Task`, `TaskGraph`, `TaskFile`, `orderTasks`, `taskFileName`, `taskToMarkdown` and `taskFromMarkdown` (`src/shared/tasks.ts:5-113`).
- **Error strings match the brief exactly:**
  - `duplicate task slug <s>` (`:29`)
  - `task <s> depends on unknown task <t>` (`:35`)
  - `tasks <a> and <b> depend on each other` (`:67`)
  - `task frontmatter: <reason>` (`:89`)
- **All four tests from the brief are present** with the brief's assertions (`test/shared/tasks.test.ts:18-59`).
  - Accepted deviation: the `t` helper moved to file scope.
  - Extra: a "missing slug throws" assertion was added (`:56-58`).
- **The slug is required in the frontmatter, and a file without it throws** (`tasks.ts:105`, test `:57`). Brief Step 3 says `taskFromMarkdown` "reads `slug` from the frontmatter when present", which could also be read as "optional".
  - The strict reading matches the plan's return type (`Task` requires `slug`).
  - It also matches the pre-flight ruling in `progress.md:8`: "slug comes from frontmatter (`taskToMarkdown` writes it, `taskFromMarkdown` reads it)".
  - So this is not a finding. It is a constraint Task 2 inherits (see Minor 4).
- **Cannot verify from the diff:** the `pnpm check` output is cited only in the report and I did not re-run it. The report's RED/GREEN output and the `pnpm check` summary (244 tests, biome clean) are internally consistent.

### Strengths
- **`orderTasks` validates fully before it sorts.** It checks for duplicates, then unknown dependencies, then cycles, so the "first problem found" order is deterministic (`tasks.ts:26-49`).
- **The ordering is stable.** Each step picks the earliest ready task in input order, which is what the brief's ordering test asserts.
- **`cycleMessage` is correct.** Once no task is ready, every unplaced task has an unplaced dependency, so the walk must close a loop, and both names it returns lie on that loop. The report's admission that the `?? ""` fallbacks never fire is accurate.
- **`taskFromMarkdown` is tight:**
  - It checks that there is a block between `---` fences.
  - It requires each line to be `key: <json>` and runs `JSON.parse` on the value.
  - It strips one blank line after the fence, so the body comes back byte-identical, trailing newline included.
  - It validates the result with Zod and names the first issue's path.
  - A `body:` line in the frontmatter cannot override the real body, because the body is spread last (`:106`).
- **`Object.fromEntries` is safe against a `__proto__:` key.** It defines own properties, so such a line cannot change the prototype.
- **The JSON values keep the frontmatter valid YAML** for other tools, as the comment at `:81` notes.
- **The `ponytail:` comment names the O(n²) ceiling and why it is fine here** (`:24`).

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
1. **The cycle-error tests only check a substring.** `test/shared/tasks.test.ts:25-27` checks `"depend on each other"` and does not check which tasks are named.
   - A regression that names the wrong pair, or the `""` fallback slug, would still pass.
   - Suggested fix: assert `"tasks a and b depend on each other"` exactly.
   - Suggested addition: a three-task cycle with a waiting task outside it (`x→a→b→c→a`), so the cycle-walk logic is pinned.
2. **A task that depends on itself gets an awkward message:** "tasks a and a depend on each other" (`tasks.ts:67`).
   - The implementer flags this in the report, but no test covers it.
   - A model-generated split could plausibly emit a self-dependency.
   - Suggested fix: a dedicated `task a depends on itself` branch plus one assertion.
3. **CRLF files are rejected as having no fence** (`tasks.ts:91-94`).
   - A task file the user saved in a CRLF editor would read as "expected a block between --- lines".
   - Files under `.blueprint/tasks/` are user-editable Markdown, so this can happen.
   - Suggested fix: one `text.replace(/\r\n/g, "\n")`.
4. **The frontmatter `slug` is now the only source of truth, and Task 2 must take that into account.**
   - The brief says `FileStore` fills `slug` from the file name. `taskFromMarkdown` throws when `slug` is absent (`:105`), so `FileStore` cannot fill a missing one.
   - A mismatch between the frontmatter `slug` and the file name is not detected anywhere yet.
   - Not a Task 1 defect, but the Task 2 reviewer should check how `FileStore` reconciles the two.
5. **Unknown frontmatter keys are silently dropped by Zod's default strip, and a duplicate key silently wins last** (`:96-106`).
   - This is acceptable for this format. It is noted only because a typo such as `dependson:` gives a missing-field error rather than an unknown-key error.

### Assessment
**Task quality: Approved.**
Reasoning: The implementation matches the brief's interfaces, error strings and tests, and it handles the round-trip and ordering edge cases correctly. The remaining items are test precision and small robustness improvements.
