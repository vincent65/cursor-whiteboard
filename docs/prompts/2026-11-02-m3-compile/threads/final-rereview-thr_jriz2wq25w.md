### Finding Verdicts

1. **ADDRESSED.** `writeBoardExports()` at `src/server/agent/index.ts:170-184` goes through `listBoards`, `readBoard`, `excalidrawToBoardGraph`, `boardGraphToMarkdown` and `writeExport`. A failed board is skipped with `console.warn`. `compile()` awaits it before the send (`:199`). The test "compile writes every board's export before the send and skips a board that fails to parse" reads the export file synchronously inside the fake `query`, so the export must exist before the send. It also asserts the warning and that no `broken.md` is written.

2. **ADDRESSED.** The slug clause now reads "use only the heading slugs listed below" (`src/server/agent/prompt.ts:286`). `compileMessage` (`:291-301`) appends `Doc headings you may cite:` with one line per doc, `<file>: <slug>, …`, built from `headingSlugs`. `compile()` sends it (`index.ts:200-206`). The prompt test checks the exact output, and the route test asserts `api.md: api--auth`.

3. **ADDRESSED.** `state()` returns `splitting` (`index.ts:146, 249`), and `AgentState` gains the field (`src/ui/api.ts:560`). `SpecView` seeds from `agentState()` on mount, and a `split.status` heard first wins through `heardSplit` (`SpecView.tsx:675-683, 705`). The server test checks the state route reports false, then true, then false. Two UI tests cover the seed and the race.

4. **ADDRESSED.** `read()` catches a rejected `proposals.reconcile`, warns with the save route's wording and returns the file (`src/server/agent/tools.ts:465-472`). The test uses `failAppends()` to make `appendProposal` throw, and checks that the board text is still returned and the warning is logged.

5. **ADDRESSED.** "Read files with the Read and Glob tools, not Bash." is at `prompt.ts:283`, and the prompt test asserts it.

6. **ADDRESSED.** The list is deduped by `raw` (`SpecView.tsx:722`) and the line is pluralized (`:733-735`). Tests cover "Dropped 1 citation that no longer resolves" and the x, y, x case giving "Dropped 2 citations".

7. **NOT ADDRESSED (partial).** Both cases from the ruling pass (`test/export/citations.test.ts:807-810`). The mirror case does not: when the unknown citation comes first in a list, it still leaves a stray comma. `SEPARATOR_BEFORE` (`src/export/citations.ts:66, 90-91`) prefers the whitespace before the citation over the comma after it. I ran a probe with `node --experimental-strip-types` against the source:
   - `"Statement [[board:main#x]], [[board:main#a]]."` gives `"Statement, [[board:main#a]]."`
   - `"Login (see [[board:main#x]], [[board:main#a]]) fast."` gives `"Login (see, [[board:main#a]]) fast."`
   - `"See [[board:main#x]], [[board:main#y]], A."` gives `"See, A."`

   This is the defect the finding targets, and it contradicts the new comment at `:69-70` ("a list of them leaves no stray commas"). The fix is small: when the text after the citation starts with `,` or `;` and the text before it ends in whitespace only, take the separator after. Add the first-in-list case to the test.

8. **ADDRESSED.** `split()` passes `dropUnknownCitations(text, await store.citationIndex()).text` to `splitSpec` (`index.ts:224-227`). The test "split is fed the spec without citations that no longer resolve" checks that the prompt contains `Ship [[board:main#e1]].`.

9. **ADDRESSED.** Acceptance items and sources are keyed by index, with `biome-ignore` reasons (`src/ui/plan/TasksView.tsx:763-775`). A test with repeated lines and sources asserts both copies render and `console.error` is never called.

10. **ADDRESSED.** Every `split.status` sets the error: the message on `error`, null otherwise (`SpecView.tsx:708`). A successful `getSpec` also clears it (`:661-667`). The test covers `running`, `done`, and a failed reload followed by a successful one.

11. **ADDRESSED.** `.on("unlink", onEvent)` is at `src/server/watch.ts:521`, and the test covers all four kinds. I checked the UI handlers for a deleted file: `BoardView.tsx:404` and `DocView.tsx:152` both catch the 404 and return, `SpecView` falls back to its empty state, and `TasksView` reloads. Nothing breaks.

12. **ADDRESSED.** `shownPrompt` maps any saved prompt with a line equal to the instruction's first line to `COMPILE_LABEL` (`src/server/agent/session.ts:350-354, 378`). The test covers a plain compile, one with a decision note in front, and a near-miss prompt that stays as typed.

13. **ADDRESSED.** The catch clears `compiling` only when `compiling === p` (`index.ts:207-214`). `p` is assigned before the catch can run. The "a failed compile does not clear a newer one" test exercises the race.

14. **ADDRESSED.** `ClaudePanel` takes `onBoard` and switches the placeholder (`ClaudePanel.tsx:588, 611`). `App` passes `route?.kind === "board"` (`App.tsx:540`). The test covers both values.

15. **ADDRESSED.** The `FAILURES` map holds the four exact sentences (`src/server/agent/split.ts:405-411`). A result whose `errors` array is empty gets the sentence. The test checks all four subtypes against the exact error.

The report names a covering test for every finding and shows its output, plus `pnpm check` (292 of 292 passing) and `pnpm build`. Those claims agree with the diff.

### New Breakage in the Fix Diff

- **Minor:** `SpecView.tsx:676-683`. If the user clicks Split before the mount-time `agentState()` answer arrives, a stale `splitting: false` can overwrite the local `setSplitting(true)`. The local click does not set `heardSplit`. The button re-enables until the server's `running` broadcast arrives, so a second click in that window gets a 409. Setting `heardSplit.current = true` in `split()` closes the window.
- **Minor:** `index.ts:224-227`. A corrupt board file now makes `split()` fail. The compile skips that same board with a warning, so the two paths treat it differently. This matches `GET /api/spec`, which also fails, so the spec view could not show anyway. Noting it only for consistency.

The finding 7 gap is listed above, not here. It is not a regression: the old output was `"Statement , [[a]]"`.

### Out-of-Scope Observations

- `compile()` reads docs with `Promise.all` (`index.ts:200-205`), so one unreadable doc fails the whole compile. Boards get skip-and-warn. Consider handling docs the same way.
- The report's concern stands: a result from any turn still clears `compiling`. The new async prelude (writing exports and reading docs) widens the window before the send. The worst case is unchanged: a second compile that rewrites the same spec.

### Verdict

The fix round has findings open. Finding 7 is only partly fixed: an unknown citation that leads a list still leaves a stray comma (`src/export/citations.ts:90-92`). The other 14 findings are fixed, and the fix introduced nothing Critical or Important.
