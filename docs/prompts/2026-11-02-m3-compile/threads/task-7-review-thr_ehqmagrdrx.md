### Spec Compliance
- Spec compliant. Every interface in the brief is present: `citationHash` and `citationMarks` in `src/ui/plan/citations.ts:1-22`, `SpecView`, `TasksView`, the `watch.ts` `spec`/`task` kinds, and the `App.tsx` wiring.
- Both tests the brief names exist and check what it says:
  - `test/ui/citations.test.ts:13` ("citationMarks finds every citation with its hash") covers a repeated citation and text with no citations.
  - `test/ui/TasksView.test.tsx:51` covers cards, `Depends on: db, config`, source-link `href`s, the empty state and the cost line.
  - The watcher case is at `test/server/watch.test.ts:799`.
- Three changes go beyond the brief, and each is justified:
  - The `ServerMessage` kind union widened in `src/shared/messages.ts:292-296`. The new kinds have to travel over the WebSocket, so this is required.
  - `theme` is now exported from `src/ui/docs/DocView.tsx:401`, so the spec editor reuses it instead of copying it.
  - `TasksView` also reloads on `file-changed` `task` (`src/ui/plan/TasksView.tsx:586`). The brief says the watcher change exists "for these reloads", so this is a reasonable reading.
- `citationHash` strips `.md` from doc pages (`src/ui/plan/citations.ts:644`). The brief's literal form is `#/docs/<page>`, but doc citations carry the file name and the doc route needs the doc name, so this corrects the brief rather than misreading it. The test pins it at `test/ui/citations.test.ts:9-10`.
- Cannot verify from the diff: the manual `pnpm dev` check (underlined citation, click opens the board with the element selected). The report describes screenshots in `task-7-shots/`; I did not open them.
- Cannot verify from the diff: that `pnpm check` and `pnpm build` are clean. The report claims 276/276 tests passing, no stderr, and only the chunk-size warning. I did not re-run them.

### Strengths
- `citationMarks` relies on `parseCitations` using `matchAll` (`src/export/citations.ts:16`). I checked this outside the diff because `indexOf` silently returns -1 if `raw` ever differs from the source text. Since `raw` is the exact match and matches come in order without overlap, the `indexOf`-from-last-end scan cannot return -1 or pick the wrong occurrence.
- The click handler uses `posAtDOM` on the clicked `.cite` span plus a strict `from <= pos < to` filter (`src/ui/plan/SpecView.tsx:446-454`). This avoids the edge ambiguity of `posAtCoords` for adjacent citations, and the report says this was tested by hand. It returns `false` outside citations, so CodeMirror's normal handling still runs there.
- Reloads reuse `replaceFromDisk`, which applies the change with `Transaction.remote` and stays out of undo history (`DocView.tsx:25-34`). Programmatic dispatch is not blocked by `readOnly`, so swapping text in place works.
- `classify` now keys on the parent directory (`src/server/watch.ts:242-248`), so `.md` files under `docs/` and `tasks/` are told apart. I checked that `FileStore.init` creates `tasks/` (`src/server/files.ts:74`, `SUBDIRS`), so the watched directory always exists.
- Error handling is complete: a rejected `agentSplit` (409) shows its message and re-enables the button, and that is tested (`test/ui/SpecView.test.tsx:902`).
- Tests drive real components and only mock the API and event boundary. `vi.resetAllMocks()` stops queued once-values leaking between tests.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
1. **`SpecView` keeps stale errors.** `src/ui/plan/SpecView.tsx:506-511` sets `error` on a split `error` but never clears it on `running` or `done`; only clicking Split clears it (`:515`). Example: tab A shows "bad graph", then tab B runs a successful split, and tab A still shows "bad graph". `TasksView` clears on any `split.status` (`TasksView.tsx:588`), so the two views disagree. A failed `load()` error also survives a later successful reload, in both views (`SpecView.tsx:469`, `TasksView.tsx:578`).
2. **The click-to-follow behaviour has no automated test.** `followCitation` (`src/ui/plan/SpecView.tsx:444-456`) is checked only by hand. `posAtDOM` does not need layout, so a jsdom test that clicks the `.cite` element and asserts `location.hash === "#/boards/main?focus=a1"` would lock in the headline feature.
3. **Duplicate React keys are possible.** `key={a}` on acceptance items (`TasksView.tsx:615`) and `key={s}` on sources (`:622`) produce a key warning and possible mis-reconciliation if a task repeats a criterion or a source. Keying by index or `${i}-${a}` avoids this.
4. **Cross-component import.** `SpecView` imports `theme` and `replaceFromDisk` from the `DocView` component module (`SpecView.tsx:425`). A small shared editor module would be cleaner than reaching into another view's file. This is not blocking.
5. **Plan-mandated copy reads badly.** "Dropped 1 citations that no longer resolve" (`SpecView.tsx:532`) follows the brief's literal format. A singular/plural switch would read better.
6. **The spec match depends on the directory name.** `classify` recognises the spec only when its parent directory's basename is `.blueprint` (`src/server/watch.ts:244`). Comparing the full path to `join(store.dir, "spec.md")` would not depend on that name. This works today because the store directory is `.blueprint`.
7. **Deletions are not reported (acknowledged in the report).** The watcher reports only add and change events, so a hand-deleted `spec.md` or task file does not update an open view until a page reload. This comes from the existing watcher design.

### Assessment
Task quality: Approved
Reasoning: Everything the brief asks for is implemented and its listed tests exist and check the specified behaviour. The changes outside the brief are small and justified. The remaining issues are polish: SpecView's error clearing differs from TasksView's, the citation click lacks a test, and duplicate list keys are possible.
