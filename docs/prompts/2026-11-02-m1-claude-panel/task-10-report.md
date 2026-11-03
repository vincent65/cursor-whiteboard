# Task 10 report: Robustness carried from milestone 0

Status: DONE_WITH_CONCERNS

Commit: `85fe24d fix(ui): settle saves before comparing disk changes and reload docs without undo steps`

## History

The first pass stopped with NEEDS_CONTEXT, because `@codemirror/commands` was only a transitive dependency that pnpm does not hoist.
The controller chose option 1: add `"@codemirror/commands": "^6.11.1"` as a direct dependency.
I ran `pnpm add @codemirror/commands@^6.11.1`.
It resolved to 6.11.1, the copy that `codemirror` already installed, so no new code ships.
The command needed to run outside the sandbox: inside it, pnpm cannot reach the global store and tried to switch to a project-local `.pnpm-store`.
I deleted the empty `.pnpm-store/` left by that failed attempt.

## What I implemented

- `src/ui/docs/DocView.tsx`: renamed `replace` to the exported `replaceFromDisk(view, text)`.
  It dispatches one transaction with `Transaction.remote.of(true)` and `Transaction.addToHistory.of(false)`.
  It also sets `selection: { anchor: min(main.head, text.length) }`, so the cursor keeps its offset, clamped to the new length.
  Silent reloads and Take theirs both use it.
- `src/ui/board/BoardView.tsx`: the `file-changed` handler for the open board now runs `await queue.current` before it fetches the board and compares.
  So a change that arrives during a save is judged against the settled state.
  `queue.current` never rejects, because `persist` catches save errors, so the await cannot throw.
- `test/ui/docReload.test.ts` (jsdom): builds an `EditorView` with `history()` and a dirty listener that mirrors DocView's rule, then places the cursor at 3.
  After `replaceFromDisk` with longer text, it asserts:
  - the new text
  - head = 3
  - `undoDepth(state) === 0`
  - `undo(view) === false` (the one-line Ctrl+Z check the controller allowed)
  - the doc is not dirty

  It then replaces with shorter text and asserts the head clamps to 2.

## TDD evidence

RED: `pnpm vitest run test/ui/docReload.test.ts`

```
FAIL  test/ui/docReload.test.ts > replaceFromDisk keeps the cursor, adds no undo step, and does not mark the doc dirty
TypeError: replaceFromDisk is not a function
Test Files  1 failed (1)
```

The first draft of the test treated any non-remote transaction as dirty, which would also have flagged the selection-only dispatch.
Before implementing, I changed it to DocView's real rule (`docChanged && !remote`).

GREEN: `pnpm vitest run test/ui/docReload.test.ts`

```
Test Files  1 passed (1)
Tests  1 passed (1)
```

`pnpm vitest run test/ui`: 10 files, 26 tests passed.
`pnpm check` (tsc for both configs, biome, vitest): clean, 26 files and 120 tests passed, with no warnings.

I also ran a throwaway probe (not committed).
It made a user edit, ran `replaceFromDisk`, then called `undo`.
The result was `undoDepth` 0 and the text stayed the disk version: CodeMirror drops history events that the whole-document replace maps to empty.
So even after real typing, undo cannot bring back pre-reload text.

## Manual verification (`pnpm dev`, gstack browse headless Chromium)

The Playwright MCP browser was locked by another session, so I used gstack browse.
`pnpm dev` had to run outside the sandbox, because tsx watch's IPC pipe gets EPERM inside it.

Doc check:

- I opened a probe doc and typed " typed". Autosave wrote it to disk, so the editor was clean.
- I rewrote the file externally to "external version from disk". The editor reloaded silently, with no banner.
- Cmd+Z twice: the text stayed "external version from disk". The old text did not come back.
- Control: I typed "ZZ" and pressed Cmd+Z, which removed it. So the shortcut does reach CodeMirror.
- The cursor stayed at the same offset, as specified.

Board check:

- I couldn't draw shapes in headless Excalidraw with synthetic pointer drags: they created zero-size rectangles, which Excalidraw then drops on restore.
  Instead, I seeded a 160x90 rectangle by editing the file externally. It reloaded cleanly with no banner.
  For the user edit, I used Cmd+A plus arrow-key nudges, which change element versions and trigger saves.
- I patched `fetch` in the page to hold board-save responses for 3 s.
  That keeps the save in flight while the server has already written the file.
  Then I nudged, waited 2 s, and wrote the file externally to add a red rectangle.
- Result: no banner while the save was in flight, and none after it settled.
  The red rectangle appeared in the editor, and the editor matched the disk.

I deleted the probe doc and board, their exports, and the `.gstack/` logs.
I also reverted a `.gitignore` line that gstack browse added on its own.

## Files changed

- `package.json`, `pnpm-lock.yaml` (`@codemirror/commands` ^6.11.1)
- `src/ui/docs/DocView.tsx`
- `src/ui/board/BoardView.tsx`
- `test/ui/docReload.test.ts` (new)

## Self-review

- The diff stays within the brief plus the files the controller ruling added.
- The commit has no trailers.
- `replaceFromDisk` collapses any selection to a cursor.
  The brief asks to keep "the cursor", so I accepted that.
- The test's dirty listener copies DocView's rule rather than running DocView itself.
  It proves the remote annotation is present, which is what DocView keys on.

## Concerns (pre-existing, outside this task's files)

1. **External board edits within 1 s of a save are silently lost.**
   `src/server/watch.ts` skips any change when `store.wasWrittenRecently(path, 1000)`, and that check is per path, not per write.
   Reproduced: I nudged, and about 250 ms after the save landed I added a red rectangle externally.
   The client got no `file-changed` event, so the editor never showed it.
   The next nudge's save then overwrote the file, and the red rectangle was gone from disk.
   This is data loss, and the client-side fix in this task cannot reach it.
   A likely fix: skip only events whose file content matches what the store wrote (a hash or mtime comparison), not every event within a time window.
   The same window applies to docs.
2. Copy: while a doc is open, the Claude panel placeholder still reads "Ask Claude about this board".
