### Spec Compliance
- Spec compliant. Every interface bullet in the brief is in the diff:
  - **Arrows section:** `## Arrows` comes right after the ids comment, only when `linked.length > 0`, with the same bullet shape as Unconnected arrows (`src/export/markdown.ts:72-76,104`). The golden `test/export/fixtures/basic.md:18-22` was edited by hand.
  - **Prompt:** the propose line ends with the exact sentence the brief asks for (`src/server/agent/prompt.ts:7`). The old "Use element ids…" sentence was dropped, which is a reasonable merge, not an extra.
  - **ApiError:** `ApiError` has a `status` field, and `request()` throws it for every non-ok response (`src/ui/api.ts:14-35`).
  - **Server-first decide:** `BoardView.decide` (`src/ui/board/BoardView.tsx:384-409`):
    - It awaits the server first.
    - On a 404 it warns and still applies locally.
    - On any other error, 409 included, it shows `Decision failed: <message>` and applies nothing.
    - It deletes the proposal's entry from `titles`.
    - The match on the message text is gone.
- All three tests the brief lists exist and assert what it says:
  - `test/export/markdown.test.ts:58-69` checks the SQL edge bullet with both node ids. It also checks that a board with no connected arrows has no Arrows section.
  - `test/server/agent/prompt.test.ts:77-79`.
  - `test/ui/api.test.ts:6-19` starts with the jsdom pragma, expects a 404 `ApiError` with the server's message, and adds a test for the 500 fallback message.
- Cannot verify from the diff:
  - The 409-during-revise path has had no end-to-end check. The report says so openly (report "Concerns"), and no automated test covers BoardView's branching.
  - Green `pnpm check` and `pnpm build` come only from the report. Its evidence looks complete, so I did not re-run them.

### Strengths
- The `side` and `arrow` helpers were moved up so both arrow sections share them. That removed duplicated code instead of copying it (`src/export/markdown.ts:72-78,108`).
- `ApiError` keeps the existing message rules and adds only the status. `name` is set, so logs read cleanly.
- I checked the status mapping on the server side:
  - `NotFoundError` maps to 404 and `ProposalBusyError` maps to 409 (`src/server/app.ts:18-20`).
  - "Not pending" throws `NotFoundError` (`src/server/agent/proposals.ts:106`).
  - So the 404 and 409 branches in `decide` match what the server really sends.
- I checked whether a fast Accept then Reject can corrupt the board. The second click gets a 404 and applies `decideProposal` locally again. After the accept, `ghostOf(e)` no longer matches, because `customData` becomes `{origin, proposalId}` (`src/ui/board/ghosts.ts:272-274,283`), so the second call does nothing. No corruption.
- I checked that removing the id from `titles` does not hide anything wrong. The bar's list comes from `pending`, and `titles` only supplies labels (`BoardView.tsx:463`).

### Issues
#### Critical (Must Fix)
- None.

#### Important (Should Fix)
- None.

#### Minor (Nice to Have)
- **Shadowed name:** `src/export/markdown.ts:97` declares `const arrow = start && head ? "<-->" : …` inside the Mermaid loop. That hides the new outer `arrow` helper from line 75, two dozen lines away. It works, but it confuses readers. Rename the inner one, for example `link`.
- **No in-flight guard:** `decide` is now async (`BoardView.tsx:384`) and the Accept and Reject buttons stay live while the request runs.
  - A double click sends a second request, which returns 404 and logs a warning. That is harmless, as checked above, but the noise is avoidable.
  - On a slow server there is also no feedback that anything is happening.
- **Stale closure:** `target` is read after the `await` (`BoardView.tsx:408`), so it can be stale. The report acknowledges this. Use the functional form, `setTarget((t) => (t?.id === id ? null : t))`, to make it correct for little cost.
- **Untested branching:** this task's main behaviour change, the 404/409/success branching in `decide`, has no automated test. Only the `ApiError` contract it depends on is tested. The brief did not require a BoardView test. Moving the branching into a pure helper, for example `shouldApplyLocally(err)`, would make it testable without mounting Excalidraw.
- **Prompt does not mention every id source (plan-mandated wording):** `prompt.ts:7` points Claude to "nodes in its ids comment, arrows in its Arrows list". But the export also lists ids under "Unconnected arrows" and "Other elements" (`basic.md:24-28`), so Claude may miss those targets. The brief mandates this exact text, so I note it rather than block on it.
- **Bullet direction differs from the diagram:** the Arrows bullets show `from -> to` as stored, while the Mermaid line reverses start-only arrows (`markdown.ts:95-96`). So for those arrows, the diagram and the list point opposite ways. The brief mandates this shape; the report calls it out.

### Assessment
Task quality: Approved
Reasoning: The diff implements every interface in the brief exactly, and the 404/409 handling matches how the server maps its errors. What remains is readability and robustness polish, plus one test gap the brief did not require.
