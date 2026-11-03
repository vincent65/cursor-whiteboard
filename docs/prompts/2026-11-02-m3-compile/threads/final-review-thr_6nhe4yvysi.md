I have everything I need. Here is the review.

## Milestone 3 review: compile and tasks (6dc5d50..45b3c1e)

### Strengths

- **Split path is well guarded.** `orderTasks` rejects duplicates, unknown dependencies, and cycles with exact messages before a file is touched, and `replaceTasks` writes the new set before unlinking the old one. Review Focus 1 and 2 are pinned by real file-system tests in `test/server/files.test.ts` and `test/server/agentRoutes.test.ts`, and the acceptance run confirmed a real five-task split.
- **Spec served clean, disk untouched.** `GET /api/spec` drops unknown citations and reports them without rewriting `spec.md`, exactly as section 6.3 and the Global Constraints require, with a route test that checks the file afterwards.
- **Frontmatter round trip is sound.** JSON literals per key are valid YAML, every value is one line, and the tests cover quotes, colons, ampersands, a body with its own headings, and CRLF. The real split's files parsed back.
- **Fakes match the SDK.** The fake result messages carry `subtype`, `structured_output`, `errors`, and `total_cost_usd` in the shapes `sdk.d.ts` declares, and the draft-7 workaround for the CLI's schema validator is documented and tested.
- **Reconcile moved to the right place.** Task 0's two-strike server-owned reconcile with an injected clock is simpler and more robust than the browser timer it replaced, and the tools reconciling on every read keeps Claude's pending list honest.
- **Focus is careful.** Centering without zooming in, offsetting the properties panel, and skipping dead ids all have unit tests and a browser check.

### Issues

#### Critical (Must Fix)

None.

#### Important (Should Fix)

1. **Compile reads exports that only a board save regenerates.** `src/server/agent/prompt.ts:16` tells Claude to read `.blueprint/export/boards/*.md`, but `writeExport` is called only from `PUT /api/boards/:name` (`src/server/routes.ts:49`). `export/` is gitignored by design, so on a fresh clone, after a `git pull` that changes a board, or after an external board edit the watcher reloads, the exports are missing or stale until the user edits every board. A reasonable person who opens Blueprint on an existing plan and presses Compile gets a spec that cites nothing or a Claude that improvises by reading the raw scene JSON. Fix: regenerate `boards/<name>.md` for every board in `compile()` before the send (a few lines over `listBoards` and `writeExport`), or at `store.init()`. The PNG is not needed for the instruction.
2. **The heading-slug rule in the instruction does not match the index.** `src/export/citations.ts:30` strips everything but letters, digits, spaces, and hyphens before replacing spaces, so `## API & Auth` indexes as `api--auth` and `## Goals (v1)` as `goals-v1`. `COMPILE_INSTRUCTION` says only "lowercased with spaces as hyphens", so a model following it literally writes `api-&-auth` and the citation is silently dropped on serve. Fix: add "punctuation removed" to the sentence, or list each doc's heading slugs in the instruction the way the exports list element ids.
3. **A split is never visible to a view that mounts after it starts.** `split.status running` is a one-shot broadcast (`src/server/agent/index.ts:267`), and `agent.state()` carries nothing about a split. A reload or a second tab during a split shows an enabled button whose press is refused with the server's 409 text. The acceptance report saw this. Fix: include `splitting` in the `/api/agent/state` response and seed `SpecView` from it, or mirror it in the existing `agent.status` broadcast.
4. **A failed reconcile fails a read-only tool.** `src/server/agent/tools.ts` `read()` awaits `proposals.reconcile`, which appends to `proposals.jsonl`; a full disk or a locked file turns `get_board` into a tool error, while the save route in `routes.ts` already wraps the same call in a warn-and-continue. This was deferred from Task 0; I am promoting it because Claude losing its only read of the board mid-turn is worse than one stale pending proposal.

#### Minor (Nice to Have)

5. `src/server/agent/index.ts:159` and `:254`: any result clears `compiling`, and a failed send clears a newer promise. Both are acknowledged; the worst case is a second compile that rewrites the same spec. Fine for now, but clear only when `compiling === p` so the comment can go.
6. `src/ui/plan/SpecView.tsx:115`: the dropped list repeats a citation once per occurrence and says "1 citations". Dedupe by `raw` and pluralize.
7. `src/ui/plan/TasksView.tsx:69` and `:76`: `key={a}` and `key={s}` collide when Claude repeats an acceptance line or a source; React warns in the console. Use the index.
8. `src/server/watch.ts:54`: `unlink` is not watched, so a task file deleted by hand, or a `git checkout` that removes `spec.md`, leaves the view showing stale content until the next broadcast. One more `.on("unlink", onEvent)` covers it; both views already reload on any event.
9. `src/server/agent/split.ts:36`: an `error_max_turns` result has an empty `errors` array, so the user sees "split failed: error_max_turns". A short map from the four error subtypes to a sentence would read better.
10. The split is fed the raw spec, so task `sources` carry citations to deleted elements (seen in the acceptance run). Feeding `dropUnknownCitations(...).text` into `SPLIT_PROMPT` fixes it in one line and keeps the served and split views consistent.
11. `src/server/agent/session.ts:154`: a restored transcript shows the full `COMPILE_INSTRUCTION` as the user bubble. Map a saved prompt equal to the instruction back to "Compile the plan into spec.md".
12. `test/server/agent/split.test.ts`: no case where `query` itself throws (Review Focus 2's "fails to start"). The `catch` in `split()` handles it, but one assertion that the error broadcast arrives and the old files survive would pin it.

### Deferred-list triage

Fix before merge:

- **A tool's reconcile that cannot log fails the read-only tool** (Task 0). Promoted to Important 4 above.
- **The compile instruction should tell Claude to read with Read/Glob, not Bash** (Task 8). The extra Bash prompt was seen on the only real run, and the `find` that cats files exited 1. One sentence in the instruction. Folds in with Important 1 and 2 since all three are edits to the same constant.
- **Dedupe the dropped-citations line** (Task 8). Visible on the first deleted element; trivial.
- **Task sources keep citations to deleted elements** (Task 8). One-line fix, Minor 10.
- **Index-based keys for acceptance and source lists** (Task 7). A console warning on real Claude output is a real defect in a tool whose users watch the console.

Can wait:

- Everything else on the list: broadcast on reconcile, minted `at` in `proposal.apply`, unknown frontmatter keys stripped, duplicate slugs across hand-edited files, concurrent `replaceTasks` (the single-flight guard covers it), the `readSpec` ENOENT repetition, `sceneReady` rename, `headingLine` extraction, the `loaded` ref guard, the shared editor theme module, the phone-layout offset, the `SplitBusyError` class, aborting a split in `close()`, carrying cost on the error broadcast, the restored compile bubble, a jsdom click test for citations, and the "N tasks written" feedback. These are polish or latent; none blocks milestone 4.

Rulings that look wrong: none. Two I checked specifically: reusing `ExistsError` for the 409 is pragmatic and the app's status map already handles it; `split()` resolving once started and reporting through `split.status` is the right shape for a background job. The ruling that "one corrupt board makes `GET /api/spec` a 500" can wait is sound, since the board view already fails loudly on the same file.

### Declined to judge

- `spec.md` is never validated for the six sections after Claude writes it: the design makes the sections an instruction to Claude, not a server contract; set aside.
- Claude can write under `.blueprint/docs/` or `.blueprint/tasks/` during a compile, and Bash can write anywhere: milestone 1's hook scope, unchanged here; set aside.
- A second browser tab that loaded a board before a proposal was drawn can autosave without the ghosts and trigger a reconcile: multi-tab editing is outside the design; set aside.
- The split query's cost is not persisted, so a reload loses the "Split cost" line: the plan's own wording accepts this; set aside.
- Markdown rendering of the spec instead of a CodeMirror source view: the plan assigns it to the milestone 5 design pass; set aside.
- The compile and split both prompt for permission on every run (Bash, Write): a consequence of `permissionMode: "default"` chosen in milestone 1; set aside.
- A hand-edited task file with plain YAML (`title: Auth`) makes `GET /api/tasks` a 500 that names the file: the plan chose JSON-literal frontmatter and the error is specific; set aside.

### Recommendations

- Bundle Important 1, 2, and the Read-tool sentence into one commit on the instruction and `compile()`, then verify with a single real compile on the acceptance scratch repo after `rm -rf .blueprint/export`.
- Expose `splitting` through the state route now; milestone 4's run cards will need the same "is this running" question answered on mount, so the pattern is worth setting here.
- Keep the agent-behaviour tests in `agentRoutes.test.ts` for now; splitting them is churn with no bug behind it.

### Assessment

Ready to merge? **With fixes**

Reasoning: the branch implements milestone 3's done-when row and every listed design section, with real-behaviour tests and a confirmed end-to-end run, but Compile silently reads exports that do not exist on a fresh checkout and the slug rule it gives Claude disagrees with the index, both of which a user hits in the first hour and both of which are small edits to one constant and one function.
