### Task 4: Citations

**Files:**
- Create: `src/export/citations.ts`
- Modify: `src/export/index.ts`
- Test: `test/export/citations.test.ts`

**Interfaces:**
- Produces: `type Citation = { kind: "board" | "doc"; page: string; id: string; raw: string }`, `parseCitations(text: string): Citation[]`, `headingSlugs(markdown: string): string[]`, `buildCitationIndex(input: { boards: Record<string, BoardGraph>; docs: Record<string, string> }): Set<string>`, `dropUnknownCitations(text: string, index: Set<string>): { text: string; dropped: Citation[] }`.

- [ ] **Step 1: Write the failing tests**

```ts
test("parses board and doc citations", () => {
  expect(parseCitations("see [[board:main#r1]] and [[doc:api.md#auth-flow]]")).toEqual([
    { kind: "board", page: "main", id: "r1", raw: "[[board:main#r1]]" },
    { kind: "doc", page: "api.md", id: "auth-flow", raw: "[[doc:api.md#auth-flow]]" },
  ]);
});
test("heading slugs follow GitHub rules", () => {
  expect(headingSlugs("# Auth Flow\n## Step 2: Tokens!\ntext\n### A  B")).toEqual(["auth-flow", "step-2-tokens", "a--b"]);
});
test("index keys are board:<name>#<id> for nodes, edges and loose, and doc:<file>#<slug>", ...);
test("unknown citations are removed from the text and reported", () => {
  const r = dropUnknownCitations("x [[board:main#r1]] y [[board:main#zzz]]", new Set(["board:main#r1"]));
  expect(r.text).toBe("x [[board:main#r1]] y ");
  expect(r.dropped.map(c => c.raw)).toEqual(["[[board:main#zzz]]"]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/export/citations.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/export/citations.ts`**

Citation regex: `/\[\[(board|doc):([^#\]]+)#([^\]]+)\]\]/g`.
Slug rule: lowercase, strip characters that are not letters, digits, spaces, or hyphens, replace each space with a hyphen.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/export/citations.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/export/citations.ts src/export/index.ts test/export/citations.test.ts
git commit -m "feat(export): citation grammar, heading slugs and index"
```

---

