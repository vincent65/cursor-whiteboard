# Task 2 report: Bidirectional WebSocket protocol and hub requests

Status: DONE_WITH_CONCERNS

Commit: `dd5bf74 feat(server): bidirectional websocket protocol with hub requests`

## What I implemented

- `src/shared/panel.ts` (new): the `PanelEvent` union, verbatim from the brief.
- `src/shared/messages.ts`: `AgentStatus`, `ServerMessage`, `ClientMessage`, and the `PanelEvent` re-export from `./panel.js`, verbatim from the brief.
- `src/server/ws.ts` (`WsHub`):
  - `add`, `remove`, `broadcast`, and `size` keep their old behavior.
  - `remove` also clears the active socket if that socket was the one removed.
    It also rejects that socket's pending requests at once with `Error("the browser tab disconnected")`.
  - `handle(socket, raw)` parses JSON.
    It ignores malformed JSON, non-objects, and messages without a recognized `type`.
    A `response` settles its pending request: it resolves with `payload` when `ok` is true and rejects with `Error(error)` when `ok` is false.
    A `response` with an unknown id is ignored, and the listeners do not receive it.
    A `selection.changed` makes the sending socket the active socket.
    Every recognized message then goes to the `onClient` listeners.
  - `onClient(fn)` returns an unsubscribe function.
  - `request<T>(body, { timeoutMs })` sends to the active socket.
    If there is none, it sends to the most recently added socket.
    Ids come from `crypto.randomUUID()`.
    It rejects with `"no browser tab is connected"` when no socket is connected.
    It rejects with `"the browser did not answer in time"` after `timeoutMs` (default 10000).
    Settling clears the timer and removes the pending entry, so a late answer is ignored.
- `src/server/index.ts`: the `/ws` handler adds `onMessage: (ev, ws) => hub.handle(ws, String(ev.data))`.
  I checked `@hono/node-ws`: it passes the same `ctx` object to `onOpen`, `onMessage`, and `onClose`.
  The hub tracks sockets by object identity, so this works.

## TDD evidence

RED: `pnpm vitest run test/server/ws.test.ts`

```
 FAIL  test/server/ws.test.ts > hub requests > request goes to the active socket and resolves with the response payload
TypeError: hub.handle is not a function
 FAIL  test/server/ws.test.ts > hub requests > request falls back to the most recently added socket
TypeError: hub.handle is not a function
 FAIL  test/server/ws.test.ts > hub requests > request rejects when no socket, on timeout, on an error response, and when the socket leaves
TypeError: hub.request is not a function
 FAIL  test/server/ws.test.ts > hub requests > onClient receives parsed messages and malformed JSON is ignored
TypeError: hub.onClient is not a function
      Tests  4 failed | 5 passed (9)
```

During the first GREEN run, the onClient test failed (`expected 2 calls, got 1`).
My test had expected a response with an unknown id to reach `onClient`.
The resolution says such a response is ignored, so I corrected the test, not the implementation.

GREEN: `pnpm vitest run test/server/ws.test.ts`

```
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

`pnpm check` (tsc for the UI and the server, biome, and the full vitest run):

```
Checked 53 files in 26ms. No fixes applied.
 Test Files  14 passed (14)
      Tests  68 passed (68)
```

I searched the output for warnings, stderr, unhandled rejections, and errors, and found none.

## Tests added (`test/server/ws.test.ts`, `describe("hub requests")`)

1. The request goes to the active socket and resolves with the payload, and the other socket gets no request (the brief's test, verbatim in substance).
2. The fallback: after the active socket is removed, the request goes to the most recently added remaining socket.
3. The rejections:
   - no socket;
   - the default 10 s timeout, using fake timers (the request is still pending at 9999 ms, and malformed JSON arriving in between changes nothing);
   - a late answer after the timeout, which is ignored;
   - a custom `timeoutMs`;
   - an `ok: false` response, which rejects with its error;
   - a socket removed while its request is pending.
4. `onClient`: it ignores malformed JSON, objects without a `type`, `null`, and unknown response ids, and it delivers `selection.changed` with the socket.
   After unsubscribing, the listener gets nothing more.

## Files changed

- `src/shared/panel.ts` (new)
- `src/shared/messages.ts`
- `src/server/ws.ts`
- `src/server/index.ts`
- `test/server/ws.test.ts`
- `src/ui/board/BoardView.tsx` (not in the brief's list; see concern 1)
- `src/ui/docs/DocView.tsx` (not in the brief's list; see concern 1)

## Self-review findings

- **Deviation from the brief's verbatim signature:** the brief types the `request` parameter as `Omit<Extract<ServerMessage, { type: "request" }>, "id" | "type">`.
  `Omit` over a union keeps only the keys that every member shares, which here is only `kind`.
  With that type, the brief's own example `hub.request({ kind: "board.png", board: "main" })` fails to compile with an excess-property error on `board`.
  I used an `Omit` that is applied to each member of the union separately (`RequestBody` in `ws.ts`).
  It accepts exactly `{ kind: "board.png"; board: string } | { kind: "selection.snapshot" }`.
- The brief does not give the error message for a removed socket.
  I chose `"the browser tab disconnected"` so that it is different from the "no tab" error.
- The hub accepts a `response` from any socket, not only from the socket that received the request.
  The ids are random UUIDs and all clients are same-origin loopback tabs, so I did not add a check.
- If `socket.send` throws, the promise rejects with that error.
  The pending entry stays until the timeout clears it.
  This is harmless.
- Binary WebSocket frames turn into `"[object ArrayBuffer]"` and are ignored as malformed JSON.

## Concerns

1. **Two files outside the brief's list.** `ServerMessage` is now a union, so `m.kind` and `m.name` no longer type-check in `BoardView.tsx:172` and `DocView.tsx:123`.
   I confirmed this: when I temporarily reverted those two files, `tsc` failed with TS2339.
   `pnpm check` must be clean, so I added `m.type !== "file-changed" ||` to each guard.
   This is the smallest change that keeps the old behavior.
   Task 3 replaces both subscriptions with `useServerEvent` anyway.
2. **No end-to-end test of the `onMessage` wiring.** `startServer` does not expose the hub, so a real-socket test cannot call `hub.request`.
   The wiring is one line, and I checked the context identity in the `@hono/node-ws` source.
   Task 7, which connects the board tools to the hub, should add a real-socket round-trip test.
