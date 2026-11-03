# Task 3 report: server events context in the UI and sidebar refresh

Status: DONE_WITH_CONCERNS (concerns are notes for Task 4, not defects in this task).

Commit: `1c9d033 feat(ui): one server-events socket per tab and live sidebar refresh`

## What I implemented

- `src/ui/api.ts`: `connectWs(onMessage)` now returns `{ send(m: ClientMessage), close() }`.
  It keeps the same reconnect backoff (500 ms doubling to 10 s, reset on open).
  Frames sent while the socket is connecting or reconnecting go into a queue that is flushed on `onopen`.
  Open state is tracked with a flag set in `onopen` and cleared in `onclose`, so it does not depend on `readyState`.
- `src/ui/server-events.tsx` (new):
  - `ServerEventsProvider` opens one `connectWs` per mount in an effect and fans each message out to every subscriber.
    Children's mount effects run before the provider's, so sends made before the socket exists wait in a small pending list and move into the `connectWs` queue when it connects.
  - `useServerEvent(handler)` subscribes once per mount; the handler lives in a ref updated in a layout effect, so re-renders do not resubscribe.
  - `useSendToServer()` returns the provider's stable `send`.
  - Both hooks throw a clear error if the provider is missing.
- `src/ui/App.tsx`: `App` now renders `<ServerEventsProvider><Shell /></ServerEventsProvider>`; the old body became `Shell`.
  `Shell` subscribes and calls `refresh()` when a `file-changed` names a board or doc absent from the current list.
  Known names do nothing at the App level.
  A failed background refresh logs to the console instead of alerting.
- `BoardView` and `DocView`: the per-view `api.connectWs` effects are replaced by `useServerEvent` with the same handler bodies and filters.

## TDD evidence

RED (before any implementation):

```
$ pnpm vitest run test/ui/server-events.test.tsx
 FAIL  test/ui/server-events.test.tsx [ test/ui/server-events.test.tsx ]
Error: Failed to resolve import "../../src/ui/server-events" from "test/ui/server-events.test.tsx". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

First GREEN attempt failed on an unrelated import: `App` imports `BoardView`, and Excalidraw does not load under vitest (`Cannot find module .../roughjs/bin/rough`).
The App test never opens a board, so the test mocks `src/ui/board/BoardView` to a null component.

GREEN:

```
$ pnpm vitest run test/ui
 Test Files  6 passed (6)
      Tests  11 passed (11)

$ pnpm check
Checked 55 files in 52ms. No fixes applied.
 Test Files  15 passed (15)
      Tests  70 passed (70)
```

No warnings or `act(...)` messages in the test output.

Tests in `test/ui/server-events.test.tsx` (jsdom pragma, a fake `WebSocket` class stubbed on the global with `send`, `close`, settable handlers, recorded frames, and `FakeSocket.last`):

1. "subscribers receive parsed messages and sends queue until open": a probe sends `selection.changed` on mount; nothing is sent before `onopen`, exactly one frame after.
   A `file-changed` through `onmessage` reaches the subscriber.
   Then the socket closes, a second send is made while reconnecting, fake timers advance 500 ms, a new socket is created, and the frame goes out on the new socket only after its `onopen`.
2. "a file-changed for an unknown doc refreshes the sidebar lists": `App` with `listBoards`/`listDocs` mocked; a `file-changed` for doc `fresh` makes `listDocs` run again and the `fresh` link appear.
   A second `file-changed` for the now-known `fresh` does not refresh again.

## Manual verification (`pnpm dev`, headless Chromium at http://localhost:5173)

`pnpm dev` had to run outside the command sandbox: inside it, `tsx watch` fails with `EPERM` on `listen` for its IPC pipe under `/tmp`.

Started from an empty `.blueprint/` (no boards, no docs).

- Wrote `.blueprint/docs/hand-made.md` by hand: the `hand-made` link appeared in the sidebar within about 1.5 s with no reload.
- Wrote `.blueprint/boards/by-hand.excalidraw.json` by hand: the `by-hand` link appeared in the boards list with no reload.
- Doc external change (milestone 0): opened `hand-made`, rewrote the file on disk, and the editor showed the new text in place.
- Doc conflict (milestone 0): typed into the editor, then rewrote the file before the autosave; the "This doc changed on disk while you had unsaved edits." banner with "Keep mine" and "Take theirs" appeared, and "Take theirs" loaded the disk text.
- Board external change (milestone 0): created board `sketch` through "New board", then wrote a rectangle into its file on disk; the open canvas showed the rectangle (screenshot checked), with no conflict banner.
- Console: the only entry was one warning, `WebSocket connection to 'ws://localhost:5173/ws' failed: WebSocket is closed before the connection is established.`
  That is React StrictMode's dev-only mount, unmount, mount closing the first socket before it connected; the second socket served all the events above.
  Every view did the same before this task, so it is not a regression.

Cleanup: removed the three scratch files from `.blueprint/`.
The browse tool had appended `.gstack/` to `.gitignore` and written logs to `.gstack/`; I reverted the `.gitignore` change and deleted `.gstack/`, so the working tree is clean.

## Files changed

- `src/ui/server-events.tsx` (new)
- `src/ui/api.ts`
- `src/ui/App.tsx`
- `src/ui/board/BoardView.tsx`
- `src/ui/docs/DocView.tsx`
- `test/ui/server-events.test.tsx` (new)

## Self-review

- Hook names, signatures, and semantics match the brief: `ServerEventsProvider`, `useServerEvent` (subscribe for the component's lifetime), `useSendToServer` (queued until open).
- Exactly one socket per tab: only the provider calls `connectWs`; `grep connectWs src` shows `api.ts` and `server-events.tsx` only.
- The views' message filters and handler bodies are unchanged, only re-indented.
  The views are keyed by name in `App`, and the handler ref always holds the latest closure, so dropping the `[name, apply]` deps loses nothing.
- StrictMode: the provider's effect closes its connection in cleanup and reconnects on remount; messages still pending in the first connection's queue at that moment are dropped, and the remounted children send again.
- There are two queues (provider pending list before the first connect, `connectWs` queue while connecting or reconnecting).
  Both are needed: the first covers sends from children's mount effects, which run before the provider's effect; the second covers reconnects.

## Concerns (for Task 4 and later)

1. The reconnect queue has no size limit and replays everything after an outage.
   For `selection.changed` that means stale intermediate selections are sent, and for `response` frames it means answers to requests the server's previous connection made.
   If the server drops pending requests when a connection closes, Task 4 may want to drop queued responses on reconnect or keep only the newest `selection.changed`.
2. A handler that throws synchronously stops dispatch to later subscribers for that message.
   Today's handlers are async, so they cannot do that; worth keeping in mind for Task 4's responders.
3. A `file-changed` for a deleted file whose name is still listed does nothing, per the stated resolution, so a deleted file stays in the sidebar until the next refresh.
