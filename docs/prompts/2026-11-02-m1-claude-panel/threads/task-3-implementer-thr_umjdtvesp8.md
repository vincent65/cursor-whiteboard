### Spec Compliance
- Spec compliant. All Interfaces-block contracts match.
  - `ServerEventsProvider({ children })` is at `src/ui/server-events.tsx:23`. Its inferred return type is `JSX.Element`.
  - `useServerEvent(handler: Handler): void` is at `src/ui/server-events.tsx:68`. `useSendToServer(): (m: ClientMessage) => void` is at `src/ui/server-events.tsx:76`.
  - `connectWs(onMessage): { send(m: ClientMessage): void; close(): void }` is at `src/ui/api.ts:71-74`.
- `App` wraps the shell in the provider (`src/ui/App.tsx:10-16`). It refreshes the sidebar only for unknown names (`src/ui/App.tsx:40-44`).
- `BoardView` (`src/ui/board/BoardView.tsx:170`) and `DocView` (`src/ui/docs/DocView.tsx:120`) now use `useServerEvent`. Their filters and handler bodies are unchanged apart from indentation.
- Both tests the brief lists exist and assert what the brief says:
  - Test 1 (`test/ui/server-events.test.tsx:62-94`): no send before `onopen` and exactly one after. The `file-changed` reaches the subscriber. It also covers the reconnect queue.
  - Test 2 (`test/ui/server-events.test.tsx:96-112`): `listDocs` is called a second time after an unknown-doc `file-changed`. It also asserts that a second message for the now-known name does not refresh.
- The file starts with the jsdom pragma (`test/ui/server-events.test.tsx:1`), and the fake `WebSocket` is stubbed on the global.
- The commit message matches the brief and the diff header shows no co-author trailer.
- Check I ran: `src/shared/messages.ts:14` limits `file-changed.kind` to `"board" | "doc"`. So the `m.kind === "board" ? boards : docs` branch at `src/ui/App.tsx:42` cannot send some other kind to the docs list.
- Cannot verify from the diff:
  - The manual `pnpm dev` checks: a hand-made doc or board appears in the sidebar without a reload, and the board and doc external-change behavior from milestone 0 still works. They are reported in detail but I did not reproduce them.
  - That `pnpm check` is clean and `pnpm build` warns only about the chunk size. The report shows `pnpm check` output but no `pnpm build` output.

### Strengths
- The handler-ref pattern (`src/ui/server-events.tsx:70-74`) subscribes once per mount and always calls the latest closure. This removes the old `[name, apply]` dependency risk in the views instead of just moving it.
- There are two queues, each with a clear reason. The pending list in the provider covers sends from children's mount effects, which run before the provider's effect. The `connectWs` queue covers reconnects. Test 1 exercises both: the Probe's mount-time send hits the pending path.
- In test 2, the negative assertion (`test/ui/server-events.test.tsx:111`) is valid even though it runs synchronously. `refresh` calls `listDocs` synchronously inside `Promise.all`, so an unwanted refresh would show up immediately.
- Under StrictMode, the provider closes on cleanup and reconnects on remount, and remounted children re-send. The report's description of this matches the code at `src/ui/server-events.tsx:41-52`.
- The diff is small, focused, and stays within the files the brief named.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
1. **Frames sent in the closing window are lost (`src/ui/api.ts:101-103`).** `send` checks the `isOpen` flag, not `ws.readyState === WebSocket.OPEN`. Between a server-initiated close starting (readyState CLOSING) and `onclose` firing, `isOpen` is still true. Per the WebSocket spec, `ws.send` then drops the frame silently instead of queueing it. The report says the flag was chosen to avoid relying on `readyState`, which looks like a concession to the `FakeSocket` (it has no `readyState`). The fix is to check `socket?.readyState === WebSocket.OPEN` and give `FakeSocket` a `readyState`.
2. **One throwing subscriber stops the fan-out (`src/ui/server-events.tsx:43-45`).** The bare `for (const h of handlers) h(m)` means a subscriber that throws synchronously stops delivery to every later subscriber, inside `ws.onmessage`. The implementer flagged this. Since this socket will also carry Task 4's request/response traffic, wrapping each call in try/catch with `console.error` would contain one bad subscriber.
3. **The reconnect queue is unbounded and replays stale frames (`src/ui/api.ts:77,103`).** This is plan-mandated: the brief requires a queue while reconnecting. During a long outage, every intermediate `selection.changed` accumulates and is replayed. Any queued `response` frames would also go to a server connection that never asked for them. The implementer flagged this for Task 4. The fix belongs there (drop responses on reconnect, keep only the latest selection).
4. **Overlapping sidebar refreshes can apply out of order (`src/ui/App.tsx:30-34,43`).** Several `file-changed` messages for unknown names in quick succession each start a `refresh()`, because the handler's `boards`/`docs` stay stale until the first one resolves. Nothing orders their resolutions, so an earlier, staler response can land last and overwrite a newer list. An in-flight guard, or a sequence counter that ignores old responses, would close this.
5. **Deleted files stay in the sidebar (`src/ui/App.tsx:43`).** A `file-changed` for a listed name never refreshes, so a file deleted by hand stays listed until the next refresh. This follows the brief's wording ("a name it does not know"), and the implementer flagged it. Note it for the later whole-branch review.
6. **One browser console warning on every dev load (report, Manual verification).** The warning is `WebSocket connection to 'ws://localhost:5173/ws' failed: WebSocket is closed before the connection is established.` It comes from StrictMode's mount-unmount-mount closing a socket that is still connecting. It is not new, but it is console noise. It can be removed: in `close()`, if `socket.readyState === WebSocket.CONNECTING`, set `socket.onopen = () => socket.close()` instead of calling `close()` right away.
7. **Test 2's call counts depend on test order (`test/ui/server-events.test.tsx:98-111`).** It asserts absolute counts on a module-level mock, and no `clearMocks` or `restoreMocks` is set. I grepped the vitest/vite config and found none. It passes today only because test 1 never renders `App`. A `beforeEach(() => vi.clearAllMocks())` would make it independent of order.

### Assessment
Task quality: Approved.
Reasoning: The contracts match the brief exactly, both required tests exist and assert real behavior through a fake socket, and the views' behavior is unchanged. What remains is robustness polish, mainly the CLOSING-window frame loss and the subscriber error isolation, which Task 4 should pick up before it adds responders on this socket.
