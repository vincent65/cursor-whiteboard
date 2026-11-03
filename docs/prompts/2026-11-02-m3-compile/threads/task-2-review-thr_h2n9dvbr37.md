### Spec Compliance
- Spec compliant. Every interface in the brief is present.
  - `readSpec`: `src/server/files.ts:296-303`.
  - `listTasks`: `files.ts:305-321`.
  - `replaceTasks`: `files.ts:325-340`.
  - `citationIndex`: `files.ts:343-351`.
  - `GET /api/spec` and `GET /api/tasks`: `src/server/routes.ts:84-90`.
- Every test the brief lists exists and asserts what the brief says:
  - spec null then read back (`test/server/files.test.ts:398`)
  - numbered files in dependency order with old ones removed (`:405`)
  - a cycle changes nothing and rejects with "depend on each other" (`:421`)
  - the citation index covers board elements and doc headings (`:449`)
  - `/api/spec` keeps `e1`, drops `gone` and returns one `dropped` entry with id `gone`, without changing the file on disk (`test/server/routes.test.ts:411`)
  - `/api/tasks` lists parsed task files (`routes.test.ts:442`)
- Extra but justified: `src/shared/tasks.ts:67-69` (a clear message when a task depends on itself) and `:92` (CRLF files now parse), with tests in `test/shared/tasks.test.ts`.
  These are Task 1 review follow-ups and fall outside the brief's file list.
  The brief's `git add` line omits them, but they went into the same commit.
- `replaceTasks` writes the new files and then deletes the old `*.md` files.
  The brief says delete first, then write.
  The end state is the same, a partial failure is safer this way, and non-`.md` files survive (tested at `files.test.ts:407,413-417`).
  I count this as compliant.
- Cannot verify from the diff: the spec says unknown citations are "dropped with a warning when the spec is served".
  The server returns them in `dropped` (`routes.ts:87`) and does not log anything.
  Whether the user ever sees a warning depends on a later UI task.

### Strengths
- `replaceTasks` checks everything before it touches the disk.
  `orderTasks` runs first, then `assertSlug` checks every slug, because each slug becomes a path.
  Tests confirm that both a cycle and a `../x` slug leave the directory unchanged (`files.test.ts:421-436`).
- Task files are written through the private atomic `write`, so watcher echo suppression and temp-file handling work as before.
  `listTasks` reads only `*.md`, so `*.md.tmp-*` files are skipped.
- `listTasks` checks that each file name matches its frontmatter slug and names the bad file in the error.
  The tests use anchored regexes for both failure messages (`files.test.ts:438-447`).
- The test sorts the `readdir` result instead of relying on directory order as the brief's sample did, which removes a source of flakiness (`files.test.ts:413`).
- The route test checks that `spec.md` on disk is unchanged after serving (`routes.test.ts:434`), which tests the "never rewritten" constraint directly.
- Checks I ran:
  - Do `unlink` calls in `replaceTasks` cause false watcher reloads? No: `src/server/watch.ts:25` watches only `boards/` and `docs/`.
  - Does `tasks/` exist for projects created before M3? Yes: `SUBDIRS` includes `tasks` (`files.ts:74`), and `init()` runs on every server start (`src/server/index.ts:33`).

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
- **One bad board breaks `GET /api/spec`.** `citationIndex` (`files.ts:345-346`) throws if any single board fails to parse, so the spec view returns a 500 instead of degrading.
  This is acceptable while boards are server-written, but worth revisiting if spec viewing should survive a corrupt board.
- **`listTasks` does not check the task set as a whole** (`files.ts:305-321`).
  It does not detect duplicate slugs across files (for example `01-a.md` and `03-a.md`) or `00-` prefixes.
  The only way the store itself can produce duplicates is a `replaceTasks` that fails part way and leaves stale extras.
  A hand-edited directory could also hit this.
- **Two concurrent `replaceTasks` calls can leave a mix of both sets.** Each call takes its `old` snapshot before it writes (`files.ts:330`).
  This only matters if a later task does not run splits one at a time; consider a `ponytail:` note or a single-flight guard where the split is triggered.
- **No route-level test for a bad task file.** The 500 path for `GET /api/tasks` relies on the existing `onError`.
  The report says it was checked manually, but no test covers it.
- **The served spec keeps stray punctuation.** The test enshrines `"Ship [[board:main#e1]] and .\n"` (`routes.test.ts:429`).
  The cause is upstream in `dropUnknownCitations`, as the report notes, but the spec viewer will show `and .` / `, ,` to users.
  This needs a follow-up.
- **Commit hygiene.** The `fix(tasks)` changes to `src/shared/tasks.ts` ride along in a `feat(server)` commit.
- **Small duplication.** `readSpec` (`files.ts:296-303`) repeats the ENOENT-to-null catch used by `readSessions` and `readProposals`.

### Assessment
Task quality: Approved
Reasoning: Every brief interface and test is implemented and correct, and `replaceTasks` checks its input before it writes and uses atomic writes for a safe failure mode. The remaining items are hardening and polish that do not block this task.
