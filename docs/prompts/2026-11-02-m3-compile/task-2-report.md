# Task 2 report: spec and task files in the store, served with cleaned citations

Status: DONE_WITH_CONCERNS (one cosmetic concern, outside this task's files; see Concerns).

Commit: `796fff6 feat(server): spec and task files, served with unknown citations dropped`

## What I implemented

### `src/server/files.ts` (`FileStore`)
- `readSpec(): Promise<string | null>` reads `.blueprint/spec.md` and returns null on ENOENT (same pattern as `readProposals`).
- `listTasks(): Promise<TaskFile[]>` lists `*.md` in `tasks/`, sorted by name, and parses each with `taskFromMarkdown`.
  A parse failure throws `task file <file>: <reason>`.
  A file whose name is not `<nn>-<slug>.md` for its frontmatter slug throws `task file <file> has slug <slug>`.
- `replaceTasks(tasks: Task[]): Promise<TaskFile[]>` orders with `orderTasks` (so a cycle throws before anything is touched), runs `assertSlug` on every slug (the slug becomes a path), writes each `<nn>-<slug>.md` through the private atomic `write`, then deletes the old `*.md` files that are not in the new set.
  Files that do not end in `.md` stay.
  The writes happen before the deletes, so a failure part way leaves stale extras, not missing tasks.
  The end state is the same as "delete every `*.md`, then write".
- `citationIndex(): Promise<Set<string>>` reads every board (`listBoards` + `readBoard` + `excalidrawToBoardGraph`) and every doc (`listDocs` + `readDoc`, keyed as `<name>.md` to match `[[doc:<file>#...]]` and the existing `api.md` citation tests), and returns `buildCitationIndex`.
  A board that fails to parse makes it throw.

### `src/server/routes.ts`
- `GET /api/spec` returns `{ text: null, dropped: [] }` (200) when there is no spec.
  Otherwise it returns `dropUnknownCitations(text, await store.citationIndex())`, which is `{ text, dropped: Citation[] }`.
  The file on disk is not changed.
  The `dropped` list is the warning the UI shows.
  I did not add a server `console.warn`, because the UI may fetch the spec many times and the log would repeat.
- `GET /api/tasks` returns `store.listTasks()`.
  A bad task file goes to the existing `onError` and gives a 500 with `{ error }`.

### `src/shared/tasks.ts` (fixes from the Task 1 review)
- `orderTasks`: a task that depends on itself now gives `task <s> depends on itself`.
  Before, the message was `tasks b and b depend on each other`.
- `taskFromMarkdown`: changes `\r\n` to `\n` before it parses, so CRLF files parse.

## TDD evidence

RED: `pnpm vitest run test/server/files.test.ts test/server/routes.test.ts test/shared/tasks.test.ts`
```
   × orderTasks rejects cycles, duplicates, and unknown dependencies by name
   × taskFromMarkdown reads a file with CRLF line endings
   × spec is null until written, then read back
   × replaceTasks writes numbered files in dependency order and removes old ones
   × replaceTasks with a cycle changes nothing
   × replaceTasks refuses a slug that is not a safe file name
   × listTasks names a bad file and a file whose slug does not match its name
   × citationIndex covers board elements and doc headings
   × GET /api/spec drops unknown citations and reports them
   × GET /api/spec without a spec returns null text
   × GET /api/tasks lists parsed task files
TypeError: store.readSpec is not a function            (and likewise for replaceTasks/listTasks/citationIndex)
AssertionError: expected 404 to be 200                 (routes)
AssertionError: ... matching /^task b depends on itself$/ but got 'tasks b and b depend on each other'
Error: task frontmatter: expected a block between --- lines   (CRLF)
      Tests  11 failed | 32 passed (43)
```

GREEN: `pnpm vitest run test/server test/shared/tasks.test.ts`
```
 Test Files  13 passed (13)
      Tests  146 passed (146)
```

`pnpm check` (tsc for both configs, biome, full vitest): 36 files and 254 tests passed, with no warnings, errors, or stderr output.

The cycle tests use anchored regexes, so they check the exact message.
The cases are `tasks a and b depend on each other`, `x→a→b→c→a` → `tasks a and c depend on each other` (x is not named), and `task b depends on itself`.

## Manual verification

I ran the real server in a new temp git repo with `node --import tsx/dist/esm/index.mjs src/cli/index.ts --no-open --port 4391`.
The `tsx` CLI shim does not work here, because it opens an IPC pipe in `/tmp` that the sandbox blocks.
Then I sent these requests with curl:
- Before any spec: `GET /api/spec` → `{"text":null,"dropped":[]}`, and `GET /api/tasks` → `[]`.
- I created board `main` with element `e1` and doc `api` with `# Auth Flow`, then wrote a spec citing `board:main#e1`, `doc:api.md#auth-flow`, `board:main#gone`, and `doc:api.md#nope`.
  `GET /api/spec` kept the first two citations, removed the last two, and listed both removed citations in `dropped` with the correct kind, page, and id.
  `spec.md` on disk had not changed.
- I wrote `tasks/01-db.md` by hand.
  `GET /api/tasks` → `[{"file":"01-db.md","task":{...}}]`.
- I changed its slug to `other`.
  The response was `{"error":"task file 01-db.md has slug other"}` with 500, and the stack trace went to the server log.

## Files changed
- `src/server/files.ts`
- `src/server/routes.ts`
- `src/shared/tasks.ts`
- `test/server/files.test.ts`
- `test/server/routes.test.ts`
- `test/shared/tasks.test.ts`

## Self-review
- `replaceTasks` validates before it writes: a cycle, duplicate, or unknown dependency (`orderTasks`) or an unsafe slug (`assertSlug`) rejects with the directory unchanged. Tests cover both.
- Task file writes go through `write`, so they are atomic and `isOwnWrite` knows about them (watcher echo suppression).
- `listTasks` reads only `*.md` files.
  It ignores temp files (`*.md.tmp-*`) and other files.
- `listTasks` and `replaceTasks` expect `tasks/` to exist, like `listBoards` and `listDocs` do; `init()` creates it.
- `citationIndex` rereads every board and doc each time `GET /api/spec` runs.
  This is acceptable for a local project with a few boards.
  If it becomes slow, a cache that file-watcher events invalidate would fix it.

## Concerns
- The spec text has leftover punctuation when a citation is removed.
  `dropUnknownCitations` (in `src/export/citations.ts`, from milestone 0 and outside this task's files) replaces a citation with an empty string.
  So `See A, B, [[board:main#gone]], [[doc:api.md#nope]].` is served as `See A, B, , .`.
  The spec viewer will show this.
  A follow-up could also remove the separator or whitespace in front of a removed citation, or the UI could show a marker in its place.
