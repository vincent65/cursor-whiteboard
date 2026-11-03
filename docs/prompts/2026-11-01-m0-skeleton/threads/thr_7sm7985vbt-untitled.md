# untitled (thr_7sm7985vbt)

### Spec Compliance
- Issues found: one requirement is only partly met.
  - The brief says "base64 is validated with a strict regex before decoding". The regex at `src/server/files.ts:48` (`[A-Za-z0-9+/]+=*`) is not strict, so malformed base64 gets through (see Important #1).
  - Everything else matches the brief:
    - Every signature in the Interfaces block matches exactly (`src/server/files.ts:34-37,53,78-221`).
    - `IncomingFile` and `IncomingScene` match the brief (`src/shared/types.ts:270-281`).
    - Board path, serialization, empty scene, MIME map, zero-byte rejection, the `<path>.tmp-<random>` then `rename` pattern, the `Map`-backed `wasWrittenRecently`, and both gitignore lines all match.
  - All 10 test names from the brief exist (`test/server/files.test.ts:335-536`). The four tests the brief spelled out assert what it asks for. The six it elided are filled in to match their comments.
- Cannot verify from the diff:
  - The 10 passing tests and the clean `pnpm check` come only from the report. I did not re-run them.
  - Whether Task 6 maps a corrupt board file's `ZodError`/`SyntaxError` from `readBoard` (`src/server/files.ts:129`) to a sensible HTTP status.

### Strengths
- `writeBoard` validates the whole scene before writing anything (`src/server/files.ts:137-169`).
  - The test proves it: a valid image sits before the bad one in the same scene, and `assets/` stays empty while the board bytes stay unchanged (`test/server/files.test.ts:427-463`).
- No `dataURL` reaches disk. Stored entries are rebuilt from scratch as `{id, mimeType, created, asset}` (`src/server/files.ts:146,158`).
- Asset writes are content-addressed and skip files that already exist, so re-saving a board that already holds its images is cheap and idempotent.
- `readAsset` uses a whitelist regex (`:49-51,201`). `writeExport` blocks paths that escape `export/` (`:211-213`). Both have traversal tests.
- Every write, including `.gitignore`, goes through one atomic `write` that cleans up its temp file on failure (`:251-261`).
- The element schema is loose (`src/export/schema.ts`, checked to make sure parsing does not strip or default element fields). Ids and extra fields such as `seed` survive, and a test asserts it (`test/server/files.test.ts:417-422`).

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
1. **The base64 check is not strict, so a truncated or corrupt image is stored silently** (`src/server/files.ts:48,153`).
   - The regex accepts any number of characters and any number of `=` signs, and `Buffer.from(..., "base64")` silently drops the leftovers.
   - I checked this with node against the same regex. `AAAAA` passes and decodes to 3 bytes, `AAAA=====` passes and decodes to 3 bytes, and `AB` passes and decodes to 1 byte.
   - So a dataURL cut off in transit gets stored as `assets/<sha>.png`. The hash looks valid but the image is broken, and the user gets no error. That breaks the brief's "strict regex" rule.
   - Fix: use a canonical base64 regex such as `(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?`, and add `AAAAA` and `AAAA==` cases to the malformed-dataURL test.

#### Minor (Nice to Have)
1. **`writeBoard` does not check the shape of `asset` on entries that arrive without a `dataURL`** (`src/server/files.ts:144-147`).
   - Any string is accepted, for example `"../../x"` or `"assets/abc.png"` (which the test itself uses at `test/server/files.test.ts:408`).
   - The spec rule "referenced by relative path to `.blueprint/assets/<sha256>.<ext>`" is enforced only when reading. Reusing `ASSET_FILE` on the write side would keep board files valid by construction.
2. **The write timestamp is recorded before `rename` succeeds** (`src/server/files.ts:255`). If `rename` fails, `wasWrittenRecently` still returns true for a write that never happened. Move the `set` after the `rename`.
3. **`init` replaces the user's `.gitignore` through temp file plus rename** (`src/server/files.ts:102`).
   - A `.gitignore` that is a symlink becomes a regular file, and the original file mode is lost.
   - An in-place `appendFile` is the safer choice for a file the user owns.
   - No test covers an existing `.gitignore` with content or without a trailing newline.
4. **`list` returns any file with the right suffix, even when the name is not a slug** (`src/server/files.ts:238-241`).
   - A hand-placed `docs/Notes.md` or `docs/.md` is listed under a name that `readDoc` then rejects with `InvalidNameError`.
   - Fix: filter the results through the slug regex.
5. **`readBoard` on a corrupt file throws a raw `SyntaxError` or `ZodError`** instead of a typed error (`src/server/files.ts:129`). This is acceptable if Task 6 treats it as a 500, but there is no test for it.
6. **No fsync before `rename`** (`src/server/files.ts:254-256`). The write is atomic, but after a power loss some filesystems can leave a zero-length file. The brief only asks for atomic, so this is optional hardening.
7. **The existence checks are check-then-act races.** `createBoard`/`createDoc` (`:111,186`) and `writeBoard`/`writeDoc` (`:134,196`) check first and write second. The report already notes this and it is harmless here. Using `writeFile(..., { flag: "wx" })` for create would remove the race without a `link` dance.

### Assessment
Task quality: Needs fixes

Reasoning: The FileStore is clean, matches its contract, and validates everything before it writes. The one problem is the loose base64 regex: it breaks the brief's "strict regex" requirement and lets a truncated image be stored silently, and it is a one-line fix plus a test case.
