### Task 3: Compile

**Files:**
- Modify: `src/server/agent/prompt.ts`, `src/server/agent/index.ts`, `src/server/agentRoutes.ts`
- Test: `test/server/agent/prompt.test.ts`, `test/server/agentRoutes.test.ts`

**Interfaces:**
- Produces in `src/server/agent/prompt.ts`: `COMPILE_INSTRUCTION`, verbatim:

```
Compile the plan into .blueprint/spec.md.
Read every board export under .blueprint/export/boards/*.md and every doc under .blueprint/docs/.
Write .blueprint/spec.md with exactly these level-2 sections in this order: Goals, Architecture, Interfaces, Constraints, Acceptance criteria, Open questions.
Cite the board elements and doc headings each statement comes from with [[board:<board>#<elementId>]] and [[doc:<file>#<heading-slug>]]. Element ids are in each export's "ids" comment and in its element lists; heading slugs are the heading text lowercased with spaces as hyphens. Cite nothing you did not read.
Keep it specific and short; prefer bullets. When the file is written, reply with two lines on what changed.
```

- Produces on `Agent`: `compile(): Promise<string>` sends `COMPILE_INSTRUCTION` through `send` (so notes and the user event apply) and returns the user event id; the user event's shown text is `Compile the plan into spec.md`. A compile while a compile is already queued or running (tracked by the returned id until the next `result` event) returns the same id without sending again.
- Produces in `src/server/agentRoutes.ts`: `POST /compile` → 202 `{ id }`.

- [ ] **Step 1: Write the failing tests**

```ts
test("COMPILE_INSTRUCTION names the six sections in order and the citation grammar", ...);
test("compile sends the instruction once while one is pending", async () => {
  // fake sdk from the wiring test: compile() twice before any result → one user message in the stream, same id returned; after a result, compile() sends again
});
test("POST /api/agent/compile returns 202 with the id", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/server/agent/prompt.test.ts test/server/agentRoutes.test.ts -t compile`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/agent/prompt.ts src/server/agent/index.ts src/server/agentRoutes.ts test/server/agent/prompt.test.ts test/server/agentRoutes.test.ts
git commit -m "feat(agent): the Compile action"
```

---

