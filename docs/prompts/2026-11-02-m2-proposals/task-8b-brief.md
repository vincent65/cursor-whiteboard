### Task 8b: Arrow ids in the board export and typed API errors

Added during execution: the Task 8 real-login check showed that connected arrows have no ids in the board Markdown, so Claude cannot target them with `update` or `delete`; and the board view matched a 404 by its message text because `api.ts` throws without a status.

**Files:**
- Modify: `src/export/markdown.ts`, `test/export/fixtures/basic.md`, `src/server/agent/prompt.ts`, `src/ui/api.ts`, `src/ui/board/BoardView.tsx`
- Test: `test/export/markdown.test.ts`, `test/server/agent/prompt.test.ts`, `test/ui/api.test.ts`

**Interfaces:**
- `boardGraphToMarkdown` emits, right after the `<!-- ids: … -->` comment and only when there are connected arrows, a section `## Arrows` with one bullet per connected arrow in diagram order: `- <id>: "<from label>" (<fromId>) -> "<to label>" (<toId>)` plus ` label "<label>"` when the label is not blank (the same shape as the Unconnected arrows bullets). The golden `basic.md` gains that section.
- `SYSTEM_PROMPT_APPEND`'s propose line ends with `Element ids come from the selection header or get_board: nodes in its ids comment, arrows in its Arrows list.`
- `src/ui/api.ts` exports `class ApiError extends Error { status: number }`; `request()` throws it for every non-ok response; `BoardView` treats a decision failure as "the server lost the record" only when `err instanceof ApiError && err.status === 404`.
- `BoardView` decides server-first: it calls `api.decideProposal` before touching the scene; on success or on a 404 (the server lost the record) it applies `decideProposal` locally (warning on the 404); on a 409 (Claude is revising it) it applies nothing and shows `Decision failed: <message>`; any other error applies nothing. It also deletes the proposal's entry from the `titles` map once decided.

- [ ] **Step 1: Write the failing tests**

```ts
test("connected arrows are listed with their ids after the diagram", () => {
  // the basic fixture graph → the Markdown contains "## Arrows" and the bullet for the SQL edge with both node ids
});
test("the prompt tells Claude where arrow ids come from", () => { expect(SYSTEM_PROMPT_APPEND).toMatch(/arrows in its Arrows list/); });
// @vitest-environment jsdom  (api.test.ts)
test("request throws ApiError with the status and the server's message", async () => {
  // fetch mocked to return 404 { error: "proposal p_1 is not pending" } → rejects with ApiError, status 404, message from the body
});
```

- [ ] **Step 2: Run the tests to verify they fail**
- [ ] **Step 3: Implement and regenerate the golden by hand (edit `basic.md`; do not add a snapshot updater)**
- [ ] **Step 4: Run `pnpm check`** — pristine.
- [ ] **Step 5: Commit**

```bash
git add src/export/markdown.ts test/export/fixtures/basic.md test/export/markdown.test.ts src/server/agent/prompt.ts test/server/agent/prompt.test.ts src/ui/api.ts src/ui/board/BoardView.tsx test/ui/api.test.ts
git commit -m "feat(export): list connected arrows with ids, and typed API errors"
```
