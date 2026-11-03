# Milestone 3 final-review fixes

Branch `m3-compile`, starting from `45b3c1e`.
All fifteen findings in `final-findings.md` are fixed as ruled, in thirteen commits with no trailers.
No real Claude session was started; the unit tests and `pnpm build` are the verification.

## Commits

| SHA | Subject | Findings |
| --- | --- | --- |
| faf1f49 | fix(agent): compile writes every board's export before it sends | 1 |
| 18bc893 | fix(agent): the compile lists each doc's citable heading slugs | 2, 5 |
| d089bd6 | fix(agent): a failed compile clears only its own promise | 13 |
| a0c5dab | fix(agent): a restored compile shows its short label | 12 |
| 7a283a7 | fix(agent): a reconcile that cannot log no longer fails a board read | 4 |
| 8c33a8f | fix(export): a dropped citation takes one adjacent separator with it | 7 |
| f348476 | fix(agent): the split reads the spec as it is served | 8 |
| 9d5d9ca | fix(agent): a split error without details reads as a sentence | 15 |
| 544fb6b | fix(server): the watcher reports deleted plan files | 11 |
| c0fdfff | fix(split): a view that mounts mid-split shows it running | 3 |
| 2dc48b6 | fix(ui): the spec view's dropped line and errors | 6, 10 |
| 2f89504 | fix(ui): key task acceptance lines and sources by index | 9 |
| 42e28f4 | fix(ui): the panel asks about this board only on a board route | 14 |

Every new test was written first and seen failing for the stated reason before the fix, except the second SpecView race test under finding 3 (noted there).

## 1. Compile regenerates the board exports

**Change.** `Agent.compile()` in `src/server/agent/index.ts` now runs `writeBoardExports()` before the send.
It goes over `store.listBoards()`, and for each board calls `readBoard`, `excalidrawToBoardGraph`, `boardGraphToMarkdown`, and `writeExport("boards/<name>.md", …)`.
A board that fails (parse or write) is skipped with `console.warn("skipping board <name> in the compile: <message>")`.
The PNG is not regenerated (the instruction does not need it).

**Test.** `test/server/agentRoutes.test.ts` > "compile writes every board's export before the send and skips a board that fails to parse".
It starts with no `export/` files, a valid board `main`, and a corrupt `broken.excalidraw.json`.
The fake `query` reads `export/boards/main.md` synchronously when the session starts, so the file must exist before the send.
It also asserts the warning and that no `broken.md` was written.

**Flake fixed along the way.** The extra awaits before the send moved the session-id write (`onSessionId`, fire-and-forget) later, so `afterEach`'s `rm` sometimes raced it with `ENOTEMPTY` in the compile tests (2 of 6 runs).
I added a `sessionSaved()` helper that waits for `sessions.json` to hold the id.
The compile tests now call it before `close()`.
After the change: 0 failures in 30 consecutive runs of the file (HEAD before my change: 0 in 15).

**Command.** `npx vitest run test/server/agentRoutes.test.ts -t "compile writes" --reporter=verbose`

```
 ✓ test/server/agentRoutes.test.ts > compile writes every board's export before the send and skips a board that fails to parse 70ms
      Tests  1 passed | 21 skipped (22)
```

## 2 and 5. Doc heading slugs listed; Read and Glob, not Bash

**Change.** `src/server/agent/prompt.ts`:
- `COMPILE_INSTRUCTION` gains the line "Read files with the Read and Glob tools, not Bash." (finding 5).
- The slug clause now reads "use only the heading slugs listed below." in place of "heading slugs are the heading text lowercased with spaces as hyphens".
- New `compileMessage(docs)` returns the instruction plus a block that starts with `Doc headings you may cite:`.
  The block has one line per doc, `<file>: <slug>, <slug>, …`, built from `headingSlugs` (deduped, empty slugs dropped).
  A doc without headings gets `(no headings)`.
  With no docs, the block reads `Doc headings you may cite: none, there are no docs.`

`compile()` reads every doc (`listDocs`, `readDoc`) after regenerating the exports and sends `compileMessage(docs)`.

**Tests.**
- `test/server/agent/prompt.test.ts` > "COMPILE_INSTRUCTION names the six sections in order and the citation grammar" (updated: the Read/Glob sentence, the "listed below" clause, the old "spaces as hyphens" gone, six lines).
- `test/server/agent/prompt.test.ts` > "compileMessage lists each doc's citable heading slugs after the instruction" (`# API & Auth` gives `api--auth`, `## Goals (v1)` twice gives one `goals-v1`, a headingless doc, and no docs).
- `test/server/agentRoutes.test.ts` > "compile sends the instruction once while one is pending" (updated: a doc `api` with `# API & Auth`; the received message is `compileMessage(...)` and contains `api.md: api--auth`).

**Command.** `npx vitest run test/server/agent/prompt.test.ts test/server/agentRoutes.test.ts -t "compile|COMPILE" --reporter=verbose`

```
 ✓ test/server/agent/prompt.test.ts > COMPILE_INSTRUCTION names the six sections in order and the citation grammar 1ms
 ✓ test/server/agent/prompt.test.ts > compileMessage lists each doc's citable heading slugs after the instruction 1ms
 ✓ test/server/agentRoutes.test.ts > POST /api/agent/compile returns 202 with the id 19ms
 ✓ test/server/agentRoutes.test.ts > compile sends the instruction once while one is pending 67ms
 ✓ test/server/agentRoutes.test.ts > compile writes every board's export before the send and skips a board that fails to parse 61ms
 ✓ test/server/agentRoutes.test.ts > a compile whose send throws or whose run ends without a result can be sent again 58ms
      Tests  6 passed | 23 skipped (29)
```

## 3. A split in flight is visible to a view that mounts later

**Change.**
- `Agent.state()` returns `splitting: boolean`, the same flag that guards `split()` (`src/server/agent/index.ts`).
- `AgentState` in `src/ui/api.ts` gains `splitting`.
- `SpecView` calls `api.agentState()` on mount and seeds `splitting` from it.
  A `split.status` heard before that answer arrives is newer, so a ref (`heardSplit`) makes it win.
  This is the same pattern `ClaudePanel` uses for `heardStatus`.
  A failed state fetch shows as the view's error.

**Tests.**
- `test/server/agentRoutes.test.ts` > "POST /api/agent/split is 404 without a spec and 409 while running": `GET /api/agent/state` gives `splitting` false before, true while running, and false after `done`.
- `test/server/agentRoutes.test.ts` > "state is returned as JSON and interrupt returns 204", and the `createAgent: interrupt …` test: updated for the new field.
- `test/ui/SpecView.test.tsx` > "a view that mounts during a split shows it running until it ends" (failed first).
- `test/ui/SpecView.test.tsx` > "a split status heard before the state arrives wins over it". This test guards the race and passed before the fix, since nothing seeded then.
- `test/ui/ClaudePanel.test.tsx`: the `state()` fixture gains `splitting: false` (type only).

**Command.** `npx vitest run test/ui/SpecView.test.tsx test/server/agentRoutes.test.ts --reporter=verbose` (split and state lines)

```
 ✓ test/server/agentRoutes.test.ts > state is returned as JSON and interrupt returns 204 3ms
 ✓ test/ui/SpecView.test.tsx > a view that mounts during a split shows it running until it ends 10ms
 ✓ test/ui/SpecView.test.tsx > a split status heard before the state arrives wins over it 10ms
 ✓ test/server/agentRoutes.test.ts > split broadcasts running then done and writes task files; a cycle leaves old files and broadcasts error 108ms
 ✓ test/server/agentRoutes.test.ts > split is fed the spec without citations that no longer resolve 57ms
 ✓ test/server/agentRoutes.test.ts > POST /api/agent/split is 404 without a spec and 409 while running 58ms
      Tests  27 passed (27)
```

## 4. A failed reconcile no longer fails a read-only tool

**Change.** `read()` in `src/server/agent/tools.ts` catches a rejected `proposals.reconcile` and logs `console.warn("could not reconcile proposals on board <board>: <message>")`, the same wording as the save route.
It then returns the board.

**Test.** `test/server/agent/tools.test.ts` > "a reconcile that cannot log warns and the read still answers".
`setup()` gains `failAppends()`, which makes the store's `appendProposal` throw `disk full`.
A stale proposal is marked by one read, appends start failing, and the next `get_board` still returns the board's Markdown and warns.

**Command.** `npx vitest run test/server/agent/tools.test.ts --reporter=verbose`

```
 ✓ test/server/agent/tools.test.ts > a reconcile that cannot log warns and the read still answers 1ms
      Tests  23 passed (23)
```

## 6 and 10. Spec view: dropped line and error clearing

**Change.** `src/ui/plan/SpecView.tsx`:
- The dropped line dedupes by `raw` and pluralizes: "Dropped 1 citation that no longer resolves: …" and "Dropped N citations that no longer resolve: …" (finding 6).
- Every `split.status` now sets the error: the message on `error`, `null` on `running` and `done`. A successful `getSpec` also clears it (finding 10), as `TasksView` already did.

**Tests.** `test/ui/SpecView.test.tsx`:
- "SpecView shows the empty state, then the spec with marked citations on file-changed" (updated to the singular wording).
- "the dropped line names each citation once and counts them" (x, y, x gives "Dropped 2 citations …: [[board:main#x]], [[board:main#y]]").
- "an error clears on any split status and on a successful reload" (error, then `running` clears; error, then `done` clears; a failed reload shows its error, and the next successful reload clears it).

**Command.** `npx vitest run test/ui/SpecView.test.tsx --reporter=verbose`

```
 ✓ test/ui/SpecView.test.tsx > SpecView shows the empty state, then the spec with marked citations on file-changed 142ms
 ✓ test/ui/SpecView.test.tsx > Split into tasks shows Splitting… until done, and errors from the split 52ms
 ✓ test/ui/SpecView.test.tsx > a rejected split shows the server's message 20ms
 ✓ test/ui/SpecView.test.tsx > a view that mounts during a split shows it running until it ends 10ms
 ✓ test/ui/SpecView.test.tsx > a split status heard before the state arrives wins over it 11ms
 ✓ test/ui/SpecView.test.tsx > the dropped line names each citation once and counts them 4ms
 ✓ test/ui/SpecView.test.tsx > an error clears on any split status and on a successful reload 12ms
      Tests  7 passed (7)
```

## 7. A dropped citation takes one adjacent separator

**Change.** `dropUnknownCitations` in `src/export/citations.ts` now works in two passes:
1. It removes a citation aside whose citations are all unknown, together with the one space before it.
   An aside is a parenthetical made only of citations, with an optional leading `see ` / `See ` / `cf. `, like ` (see [[x]]; [[y]])`.
2. It walks the citations. Each unknown one goes with one separator: a `,` or `;` with its spaces, or spaces alone.
   It takes the separator before it, or the one after it when nothing precedes (start of a line, or just after `(`).
   Newlines are never taken.

The `dropped` list is unchanged.
Results: "See A, B, [[x]], [[y]]." gives "See A, B."; "(see [[x]])" gives ""; "Login (see [[a]], [[x]]) fast." gives "Login (see [[a]]) fast."; "[[x]], [[a]] first" gives "[[a]] first".

**Tests.**
- `test/export/citations.test.ts` > "an unknown citation goes with one adjacent separator" (the two cases from the ruling, plus a mixed aside, an all-unknown aside mid-sentence, a mid-sentence citation, a leading citation, and a bullet).
- `test/export/citations.test.ts` > "unknown citations are removed from the text and reported", and `test/server/routes.test.ts` > "GET /api/spec drops unknown citations and reports them": expectations updated for the new trailing-space behaviour ("y " gives "y", "and ." gives "and.").

**Command.** `npx vitest run test/export/citations.test.ts test/server/routes.test.ts --reporter=verbose` (citation and spec lines)

```
 ✓ test/export/citations.test.ts > parses board and doc citations 1ms
 ✓ test/export/citations.test.ts > heading slugs follow GitHub rules 1ms
 ✓ test/export/citations.test.ts > index keys are board:<name>#<id> for nodes, edges and loose, and doc:<file>#<slug> 0ms
 ✓ test/export/citations.test.ts > unknown citations are removed from the text and reported 1ms
 ✓ test/export/citations.test.ts > an unknown citation goes with one adjacent separator 0ms
 ✓ test/server/routes.test.ts > GET /api/spec drops unknown citations and reports them 6ms
 ✓ test/server/routes.test.ts > GET /api/spec without a spec returns null text 2ms
      Tests  19 passed (19)
```

## 8. The split is fed the cleaned spec

**Change.** `split()` in `src/server/agent/index.ts` computes `dropUnknownCitations(text, await store.citationIndex()).text` and passes that to `splitSpec`, which builds `SPLIT_PROMPT` from it.
The cleaning happens in the pre-start `try`, so a corrupt board fails the request, the same way `GET /api/spec` does.

**Test.** `test/server/agentRoutes.test.ts` > "split is fed the spec without citations that no longer resolve".
The spec is "Ship [[board:main#e1]], [[board:main#gone]]." and the prompt contains "Ship [[board:main#e1]].".

**Command.** `npx vitest run test/server/agentRoutes.test.ts --reporter=verbose`

```
 ✓ test/server/agentRoutes.test.ts > split is fed the spec without citations that no longer resolve 60ms
      Tests  22 passed (22)
```

## 9. Task acceptance lines and sources keyed by index

**Change.** `src/ui/plan/TasksView.tsx` keys `<li>` and `<Source>` by index.
Each key has a `biome-ignore lint/suspicious/noArrayIndexKey` with the reason (lines can repeat and never move).

**Test.** `test/ui/TasksView.test.tsx` > "a repeated acceptance line or source renders each time without a key warning" (both copies render, and `console.error` is never called).

**Command.** `npx vitest run test/ui/TasksView.test.tsx --reporter=verbose`

```
 ✓ test/ui/TasksView.test.tsx > TasksView renders cards with dependencies and source links, and the empty state 95ms
 ✓ test/ui/TasksView.test.tsx > the split cost shows even when the split finished on another route 5ms
 ✓ test/ui/TasksView.test.tsx > TasksView reloads when a task file changes on disk 6ms
 ✓ test/ui/TasksView.test.tsx > TasksView shows a split error until the next split 7ms
 ✓ test/ui/TasksView.test.tsx > a repeated acceptance line or source renders each time without a key warning 8ms
      Tests  5 passed (5)
```

## 11. The watcher reports unlink

**Change.** `src/server/watch.ts` adds `.on("unlink", onEvent)` and updates the comment.
`isOwnWrite` returns false for a missing file, so every deletion is reported, including the store's own unlinks in `replaceTasks`.
Those only cause an extra tasks reload.

**Test.** `test/server/watch.test.ts` > "watcher reports deleted boards, docs, the spec, and task files" (creates each file, waits for its add event, deletes it, and expects the same `{ kind, name }`).
It passed in three consecutive runs.

**Command.** `npx vitest run test/server/watch.test.ts --reporter=verbose`

```
 ✓ test/server/watch.test.ts > watcher reports an external doc write and ignores the server's own write 1626ms
 ✓ test/server/watch.test.ts > watcher reports an outside edit made right after the server's own write 1323ms
 ✓ test/server/watch.test.ts > watcher maps board files to kind board and strips the extension 1332ms
 ✓ test/server/watch.test.ts > watcher reports the spec and task files 1514ms
 ✓ test/server/watch.test.ts > watcher reports deleted boards, docs, the spec, and task files 2329ms
      Tests  5 passed (5)
```

## 12. A restored compile shows its short label

**Change.**
- `src/server/agent/prompt.ts` exports `COMPILE_LABEL = "Compile the plan into spec.md"`, which `compile()` now uses as the shown text.
- `src/server/agent/session.ts` maps a restored user prompt to `COMPILE_LABEL` when one of its lines equals the instruction's first line, `Compile the plan into .blueprint/spec.md.`.
  Matching a line, not the whole text, covers the varying headings block after the instruction.
  It also covers decision notes before it, which a compile sent after an accept carries.

**Test.** `test/server/agent/session.test.ts` > "restore shows a saved compile as its short label" (a plain compile message, one with a decision note before it, and a user prompt that only starts like the instruction, which stays as typed).

**Command.** `npx vitest run test/server/agent/session.test.ts -t "short label" --reporter=verbose`

```
 ✓ test/server/agent/session.test.ts > restore shows a saved compile as its short label 4ms
      Tests  1 passed | 19 skipped (20)
```

## 13. `compiling` cleared only when `compiling === p`

**Change.** `compile()` creates its promise `p`, stores it in `compiling`, and its `catch` clears `compiling` only when `compiling === p`.
Without the guard, a compile still gathering exports and docs when the run ended could start a newer compile, then fail and clear that newer one.

**Test.** `test/server/agentRoutes.test.ts` > "a failed compile does not clear a newer one".
The first compile's `listDocs` waits on a gate and then throws.
`close()` clears it (run stopped), and a second compile sends.
Then the first fails, and a third `compile()` must return the second's id without a new send.
Before the fix it returned a fresh id.

**Command.** `npx vitest run test/server/agentRoutes.test.ts -t "newer" --reporter=verbose`

```
 ✓ test/server/agentRoutes.test.ts > a failed compile does not clear a newer one 117ms
      Tests  1 passed | 20 skipped (21)
```

## 14. Panel placeholder by route

**Change.** `ClaudePanel` takes `onBoard: boolean`, and `App` passes `route?.kind === "board"`.
The textarea's placeholder is `Ask Claude about this board` when `onBoard` is true and `Ask Claude` otherwise.

**Test.** `test/ui/ClaudePanel.test.tsx` > "the input asks about the board only on a board route" (rendered with `onBoard`, then rerendered with `onBoard={false}`).
The existing renders pass `onBoard`.

**Command.** `npx vitest run test/ui/ClaudePanel.test.tsx --reporter=verbose`

```
 ✓ test/ui/ClaudePanel.test.tsx > the input asks about the board only on a board route 3ms
      Tests  9 passed (9)
```

## 15. Split errors without details read as sentences

**Change.** `src/server/agent/split.ts` maps an error subtype with an empty `errors` array to a sentence:
- `error_max_turns`: "the split ran out of turns"
- `error_max_structured_output_retries`: "Claude did not return a valid task list"
- `error_max_budget_usd`: "the split hit its budget"
- `error_during_execution`: "the split failed while running"

The sentence is the whole message, with no "split failed:" prefix, since it already names the split.
A result that does carry errors keeps `split failed: <errors>`, and an unknown subtype keeps `split failed: <subtype>`.

**Test.** `test/server/agent/split.test.ts` > "an error result without errors reads as a sentence" (all four subtypes, exact message).

**Command.** `npx vitest run test/server/agent/split.test.ts --reporter=verbose`

```
 ✓ test/server/agent/split.test.ts > splitSpec passes the schema and returns validated tasks 5ms
 ✓ test/server/agent/split.test.ts > splitSpec rejects a result without valid structured output 1ms
 ✓ test/server/agent/split.test.ts > an error result without errors reads as a sentence 0ms
      Tests  3 passed (3)
```

## Final verification

`pnpm check` (exit 0, no stderr in the test run, and three more `vitest run`s also passed 292 of 292 with no stderr):

```
> blueprint@ check /Users/vincentyip/programming/cursor-whiteboard
> tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.server.json && biome check . && vitest run

Checked 108 files in 64ms. No fixes applied.

 RUN  v5.0.5 /Users/vincentyip/programming/cursor-whiteboard


 Test Files  41 passed (41)
      Tests  292 passed (292)
   Start at  22:29:44
   Duration  5.95s (tests 34%, environment 29%, setup 18%, import 14%, transform 4%, worker 1%)
```

`pnpm build` (exit 0):

```
> blueprint@ build /Users/vincentyip/programming/cursor-whiteboard
> tsc -p tsconfig.server.json && node scripts/copy-excalidraw-assets.mjs && vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 2461 modules transformed.
rendering chunks...
…
dist/ui/assets/index-DFSikR1v.js                         2,032.70 kB │ gzip: 663.16 kB

(!) Some chunks are larger than 500 kB after minification. …
✓ built in 887ms
```

The chunk-size warning was there before this wave; I did not address it (out of scope).

## Concerns

- Finding 13: the identity guard covers the failed-send path, which is what the ruling names.
  A result from any turn still clears `compiling`, and the `ponytail:` comment about that stays.
  The result carries no send id, and keying it on the oldest `riding` entry would leave a compile stuck after a run ends mid-turn.
  The worst case is unchanged: a second compile that rewrites the same spec.
- Finding 3: if the state fetch fails, the spec view shows that fetch's error until the next successful load or split status.
- Finding 11: board and doc deletions are reported, but the sidebar only refreshes for unknown names, so a deleted file stays listed until the next refresh.
  This was not part of the ruling and is not addressed.
- The recommended real compile on a scratch repo after `rm -rf .blueprint/export` was not run, per the no-real-session rule.
