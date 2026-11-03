### Spec Compliance
- Spec compliant. `replaceFromDisk(view: EditorView, text: string): void` is exported from `src/ui/docs/DocView.tsx:24` with the exact name and signature in the brief.
  - It sends one transaction carrying both `Transaction.remote.of(true)` and `Transaction.addToHistory.of(false)` (`DocView.tsx:28-31`).
  - It keeps the cursor at the same offset, clamped to the new length, via `Math.min(head, text.length)` (`DocView.tsx:27`).
  - Both callers use it: the silent reload (`DocView.tsx:138`) and Take theirs (`DocView.tsx:151`).
- The BoardView requirement is met. The `file-changed` handler for the open board waits on `queue.current` before it fetches and compares (`src/ui/board/BoardView.tsx:251`).
  - This matches Step 3's "runs after pending saves". The implementer used `await` instead of the literal `queue.current.then(...)` wrapper, and the two behave the same.
- The brief's test is present with the jsdom pragma (`test/ui/docReload.test.ts:1`). It builds an EditorView with `history()`, puts the cursor at 3 and replaces with longer text. It asserts the cursor head is still 3 and `undoDepth` is 0 (`docReload.test.ts:21-26`).
  - It also checks that `undo` returns false, that the doc stays clean, and that the cursor clamps on shorter text (`:26-29`). These additions are in scope.
- Extra: a new direct dependency, `@codemirror/commands` (`package.json:37`, `pnpm-lock.yaml`). It is not in the brief's file list.
  - It is justified: the test imports `history`, `undo` and `undoDepth`, and pnpm does not hoist the transitive copy. It resolves to the 6.11.1 copy `codemirror` already installs.
  - The report says the controller approved it. I cannot verify that ruling from the diff.
- Cannot verify from the diff:
  - The manual `pnpm dev` checks from Step 4 (Ctrl+Z after an external reload, and no spurious board conflict banner). The report describes them in detail, but I could not confirm them.
  - The reported `pnpm check` and `pnpm build` results. I did not re-run them.

### Strengths
- The change is small and exact: 5 files, about 49 lines, all within the brief.
- The comment on `replaceFromDisk` (`DocView.tsx:21-23`) explains why both annotations are needed, not just what they do.
- The BoardView fix is safe, which I checked outside the diff:
  - **Rejection:** `queue.current` cannot reject. `persist` catches errors in `.then(ok, err)` and then runs `.finally(() => inFlight.delete)` (`BoardView.tsx:126-132`), so the `await` at `:251` cannot throw.
  - **Ordering:** a save that settles drops its own entry from `inFlight` before the comparison. The echo check at `:258` then compares against `lastSaved`, which is the settled state.
- The dirty listener in the test uses DocView's real rule, `docChanged && !remote` (compare `DocView.tsx:106-110`). The implementer corrected an earlier draft that would have flagged selection-only updates as edits.
- The report flags a real pre-existing data-loss risk outside this task's files. `src/server/watch.ts` ignores changes for a whole time window after each write, so an external edit within 1 s of a save is lost. That deserves its own ticket.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
- **The test checks a copy of DocView's dirty rule, not DocView itself.** `test/ui/docReload.test.ts:12-18` mirrors DocView's listener instead of running it.
  - If DocView's rule changes, for example to check `addToHistory` instead of `remote`, this test would still pass.
  - What it does prove is that the remote annotation is present, which is the property DocView depends on. That is acceptable at this task's scope.
- **No automated test for the BoardView ordering change.** `BoardView.tsx:251` is covered only by the manual check. A future refactor that drops the `await` would not fail any test.
  - The brief does not ask for one, so this is not a compliance gap.
- **A selection range collapses to a cursor on reload** (`DocView.tsx:27`). If the user has text highlighted when an external change lands, the highlight is lost.
  - This is acceptable: the brief only asks to keep "the cursor", and the report acknowledges it.
- **Plan-mandated: exporting a helper from a component module.** `DocView.tsx` now exports a plain function next to the component. Vite's React Fast Refresh then does a full reload of this module instead of a hot swap during development.
  - This is a small cost, but the brief explicitly places the export there.

### Assessment
Task quality: Approved

Reasoning: Both robustness changes match the brief's interface and behavior exactly. The test asserts everything the brief lists and more. The only extra, the `@codemirror/commands` dependency, is needed for the test and adds no new code to the bundle.
