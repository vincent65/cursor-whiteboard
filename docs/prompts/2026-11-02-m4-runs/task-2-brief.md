### Task 2: The run prompt and the PR link

**Files:**
- Create: `src/server/runs/prompt.ts`
- Test: `test/server/runs/prompt.test.ts`

**Interfaces:**
- Produces in `src/server/runs/prompt.ts`:

```ts
export function runPrompt(input: { task: Task; taskFile: string; spec: string; branch: string }): string;
export function prUrlIn(text: string): string | null;   // first line that is exactly a https://github.com/<owner>/<repo>/pull/<n> URL (surrounding whitespace allowed)
```

  `runPrompt` returns, verbatim apart from the interpolations:

```
You are implementing one task of a plan in this worktree, on branch <branch>.

## Task (<taskFile>)
<task.body>

Depends on: <dependsOn joined by ", " or "nothing">
Files likely touched: <files joined or "unknown">
Acceptance:
- <each acceptance line>

## Specification
<spec>

## Definition of done
1. Implement the task with tests where the project has them; keep the existing checks green.
2. Commit with clear conventional commit messages on this branch.
3. Push the branch and open a pull request with `gh pr create` if `gh` is installed and authenticated; if it is not, say so and stop after pushing or committing.
4. Print the pull request URL on its own line, then summarize what you did and anything left open.
```

- [ ] **Step 1: Write the failing tests**

```ts
test("runPrompt carries the task, the spec, the branch, and the definition of done", ...);   // asserts each section heading and the `gh pr create` line
test("prUrlIn finds a PR URL on its own line and ignores inline mentions", () => {
  expect(prUrlIn("Done.\nhttps://github.com/a/b/pull/12\nSummary")).toBe("https://github.com/a/b/pull/12");
  expect(prUrlIn("see https://github.com/a/b/pull/12 for details")).toBeNull();
  expect(prUrlIn("https://github.com/a/b/issues/3")).toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/server/runs/prompt.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add src/server/runs/prompt.ts test/server/runs/prompt.test.ts
git commit -m "feat(runs): the run prompt and PR link detection"
```

---

