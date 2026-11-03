### Task 11: Mermaid parser test over the golden blocks

**Files:**
- Modify: `package.json` (dev dependency `mermaid`)
- Test: `test/export/mermaid.test.ts`

- [ ] **Step 1: Write the failing test** (jsdom pragma)

```ts
test("every mermaid block the renderer produces parses with the real Mermaid parser", async () => {
  // basic.md's block, plus boardGraphToMarkdown over graphs that exercise: a label with quotes, pipes and brackets; both arrowheads; none; start-only; a diamond; a subgraph
  for (const block of blocks) await expect(mermaid.parse(block)).resolves.toBeTruthy();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm add -D mermaid && pnpm vitest run test/export/mermaid.test.ts`
Expected: the test file runs; any block that does not parse fails the test. If all parse on the first run, the step still proves the harness works (temporarily break a label in the test input to see a failure, then restore it, and note that in the report).

- [ ] **Step 3: Fix the renderer only if a block fails to parse**

Any fix goes in `src/export/markdown.ts` with the golden fixture updated.

- [ ] **Step 4: Run the full check**

Run: `pnpm check`
Expected: PASS, pristine.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml test/export/mermaid.test.ts src/export/markdown.ts test/export/fixtures
git commit -m "test(export): parse the golden Mermaid blocks with the real parser"
```

---

