# Task 5 report: FileStore

Status: DONE_WITH_CONCERNS (the concerns are minor and listed at the end).

Commit: `85b0856 feat(server): FileStore for .blueprint with asset extraction and atomic writes` (no trailers).

## What I implemented

`src/shared/types.ts` now also exports `IncomingFile` and `IncomingScene`, matching the brief exactly.

`src/server/files.ts` exports `InvalidNameError`, `NotFoundError`, `ExistsError`, `InvalidSceneError`, `assertSlug`, and `FileStore` with every method from the Interfaces block and no other public members.

- `assertSlug`: `^[a-z0-9][a-z0-9-]*$`, so it rejects uppercase, spaces, `/`, `..`, a leading `-`, and the empty string.
- `dir` is `resolve(root)/.blueprint`, so the paths `wasWrittenRecently` checks are absolute.
- `init`: creates `boards`, `docs`, `assets`, `tasks`, `export`, `worktrees` with `mkdir -p`. It adds `.blueprint/export/` and `.blueprint/worktrees/` to `<root>/.gitignore` only when an exact trimmed line is missing. It creates the file if it is absent and adds a newline first if the file does not end with one. It is idempotent.
- Boards are stored at `boards/<name>.excalidraw.json` as `JSON.stringify(board, null, 2) + "\n"`. `createBoard` writes the empty scene from the brief and throws `ExistsError` on a duplicate.
- `readBoard` parses with `BoardFile`. ENOENT becomes `NotFoundError`.
- `writeBoard` throws `NotFoundError` if the board does not exist (this matches the PUT 404 in Task 6). It validates everything before it writes anything:
  - each file is an object;
  - a `dataURL` must match the given regex;
  - its MIME type must be in the extension map and must equal `file.mimeType`;
  - the base64 must decode to more than zero bytes;
  - the final `{ type, version: 2, source: "blueprint", elements, appState, files }` must pass `BoardFile.safeParse`.

  Any failure throws `InvalidSceneError`. Only after validation passes does it write the assets (`assets/<sha256>.<ext>`, skipped when the content-addressed file already exists) and then the board. Stored file entries are exactly `{ id, mimeType, created, asset }`, so no `dataURL` reaches disk. When an entry has only `asset`, that reference is kept unchanged. Element objects pass through the loose schema, so ids and extra fields such as `seed` are preserved.
- Docs are stored at `docs/<name>.md`. `createDoc` writes an empty file and throws `ExistsError` on a duplicate. `readDoc` throws `NotFoundError` if the doc is missing, and so does `writeDoc` (this matches the PUT 404 in Task 6).
- `listBoards` and `listDocs` filter by suffix, sort by name, and return `updatedAt` as the file mtime in ISO format. Temp files are excluded by the suffix filter.
- `readAsset(file)` accepts only `^[0-9a-f]{64}\.(png|jpg|gif|svg|webp)$` and throws `NotFoundError` for anything else, including traversal attempts. ENOENT also becomes `NotFoundError`.
- `writeExport(relPath, data)` resolves the path under `export/`. It rejects paths that escape that directory with `InvalidNameError`, creates parent directories, and writes atomically.
- All writes, including `.gitignore`, go through one private `write`. It writes `<path>.tmp-<12 hex>`, records `Date.now()` in the `Map` that `wasWrittenRecently` reads, then calls `rename`. On failure it removes the temp file.
- `wasWrittenRecently(absPath, withinMs)` returns true only when the path has a recorded write no more than `withinMs` ago.

## TDD evidence

RED: `pnpm vitest run test/server/files.test.ts`

```
 FAIL  test/server/files.test.ts [ test/server/files.test.ts ]
Error: Cannot find module '../../src/server/files.js' imported from /Users/vincentyip/programming/cursor-whiteboard/test/server/files.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

GREEN: `pnpm vitest run test/server/files.test.ts`

```
 Test Files  1 passed (1)
      Tests  10 passed (10)
```

Full gate: `pnpm check`

```
> tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.server.json && biome check . && vitest run
Checked 18 files in 13ms. No fixes applied.
 Test Files  5 passed (5)
      Tests  33 passed (33)
```

## Files changed

- `src/server/files.ts` (new)
- `src/shared/types.ts` (added the two types)
- `test/server/files.test.ts` (new, the 10 tests named in the brief, each with a fresh `mkdtemp` dir under `os.tmpdir()`, removed in `afterEach`)

## Self-review

- Completeness: all 10 tests from the brief exist with their exact names and pass. The tests the brief elided (`...`) are filled in according to their comments. Every Interfaces signature matches.
- The malformed-dataURL test puts a valid image before the bad one in the same scene. This proves validation finishes before any asset is written: `assets/` stays empty and the board bytes are unchanged. It also covers zero-byte decode, an unsupported MIME type, a MIME mismatch, and an element that fails the schema.
- Atomicity test: 10 concurrent board writes, 10 concurrent 1 MB doc writes, and an export write. It checks for no leftover `.tmp-` files, complete parseable content, and that export path traversal is rejected.
- `NotFoundError` test: also covers `writeBoard`/`writeDoc` on missing targets, `readAsset` on a missing file and on traversal, and `InvalidNameError` on a bad board name.
- Discipline: no extra public methods. The helpers (`exists`, `orNotFound`, `serialize`, and the private `boardPath`/`docPath`/`list`/`write`) are module-private or `private`. No new dependencies. Only `node:fs/promises`, `node:path`, and `node:crypto` are used in `files.ts`.
- Output: `pnpm check` is pristine (no warnings, no fixes).

## Concerns

1. Key order: `writeBoard` stores the zod-parsed object, so element keys are reordered to schema-declared fields first, then the rest. The order is stable from one write to the next, so diffs do not churn. However, the first save of a hand-written Excalidraw file reorders its keys. Ids and values are untouched.
2. `createBoard`/`createDoc` check that the file does not exist, then write. Two concurrent creates of the same name could both succeed. Both would write the same empty content, so this is harmless. Making it strictly exclusive would need `link`-based creation.
3. Writes to `.gitignore` are also recorded in `wasWrittenRecently`. This is harmless because the watcher only watches `boards/` and `docs/`.
4. Asset entries that come in with only `asset` (no `dataURL`) are not checked against the `assets/<sha>.<ext>` shape. The schema accepts any string, and `readAsset` validates on the read side.

## Fix round 1

Finding: the base64 check was not strict (Important #1).
`[A-Za-z0-9+/]+=*` accepted any length and any amount of padding, and `Buffer.from(..., "base64")` silently dropped the leftover characters, so corrupt payloads were stored without an error.

What I changed:
- `src/server/files.ts`: the payload group of `DATA_URL` is now the anchored canonical base64 pattern `(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?`.
An empty payload still matches the regex, but the existing zero-byte check rejects it.
- `test/server/files.test.ts`: the malformed-dataURL test now loops over the payloads `A`, `AAAAA`, `AAAA==`, `AAAA=====`, and `AB`.
Each one must reject with `InvalidSceneError`.
The test's existing assertions still pass: the board bytes are unchanged and `assets/` is empty.

RED, before the fix: `pnpm vitest run test/server/files.test.ts`

```
   × writeBoard rejects a malformed dataURL and writes nothing
AssertionError: promise resolved "{ type: 'excalidraw', version: 2, …(4) }" instead of rejecting
      Tests  1 failed | 9 passed (10)
```

GREEN, after the fix: `pnpm vitest run test/server/files.test.ts`

```
      Tests  10 passed (10)
```

`pnpm check` output:

```
Checked 18 files in 13ms. No fixes applied.
 Test Files  5 passed (5)
      Tests  33 passed (33)
```

Commit: `fix(server): validate base64 strictly before extracting assets` (no trailers).

## Fix round 2

Finding: Important #1 was still open.
On payloads of about 4 MB and up, the round-1 repeated-group regex overflowed V8's stack (`RangeError: Maximum call stack size exceeded`), so large images could not be saved and the error was not an `InvalidSceneError`.

What I changed:
- `src/server/files.ts`: the payload pattern in `DATA_URL` is now the linear character-class `[A-Za-z0-9+/]+={0,2}`.
After `Buffer.from(payload, "base64")`, a payload is accepted only if `bytes.toString("base64") === payload`; otherwise `InvalidSceneError` is thrown before anything is written.
This equality check also rejects payloads that decode to zero bytes, so I removed the separate zero-byte check.
- `test/server/files.test.ts`: added `writeBoard extracts a large image whose payload exceeds 5 MB`.
It writes 4 MiB of random bytes, which is 5,592,408 base64 characters (at least 5 MiB, asserted), and expects success.
It also checks that the stored reference is `assets/<sha>.png` and that the written asset's sha256 matches.
The malformed-dataURL test still rejects `***`, `A`, `AAAAA`, `AAAA==`, `AAAA=====`, and `AB`, and still asserts that the board bytes are unchanged and `assets/` is empty.

RED, before the fix: `pnpm vitest run test/server/files.test.ts`

```
   × writeBoard extracts a large image whose payload exceeds 5 MB
RangeError: Maximum call stack size exceeded
      Tests  1 failed | 10 passed (11)
```

GREEN, after the fix: `pnpm vitest run test/server/files.test.ts`

```
      Tests  11 passed (11)
```

`pnpm check` output:

```
Checked 18 files in 34ms. No fixes applied.
 Test Files  5 passed (5)
      Tests  34 passed (34)
```

Commit: `fix(server): strict base64 check that scales to large images` (no trailers).
Note: the file now has 11 tests; the 11th is the large-image test this round asked for.
