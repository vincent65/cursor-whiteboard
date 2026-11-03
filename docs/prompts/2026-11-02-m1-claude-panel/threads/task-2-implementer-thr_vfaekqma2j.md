### Spec Compliance
- Spec compliant, with one justified deviation.
- `src/shared/panel.ts` and `src/shared/messages.ts` match the brief's `PanelEvent`, `AgentStatus`, `ServerMessage` and `ClientMessage` exactly, including the type re-export from `./panel.js` with the `.js` extension.
- `WsHub` has `add`, `remove`, `broadcast`, `size`, `handle`, `onClient` and `request` (`src/server/ws.ts:24-98`). It routes to the active socket, falls back to the newest socket, uses `randomUUID` ids, has a 10000 ms default timeout, and uses the exact error strings the brief gives.
- `src/server/index.ts:43` passes `onMessage` to `hub.handle(ws, String(ev.data))`, as the brief asks.
- Deviation: `request` takes `RequestBody` (`src/server/ws.ts:6-11`) instead of the brief's `Omit<Extract<ServerMessage, {type:"request"}>, "id"|"type">`.
  - I checked the implementer's reasoning: `Omit` over a union only keeps the keys every member shares, so the brief's type reduces to `{kind}`.
  - With that type, the brief's own example call `hub.request({ kind: "board.png", board: "main" })` fails with an excess-property error.
  - The distributive version keeps the call sites later tasks will use, so this is a correct fix to the plan, not drift.
- Extra files: `src/ui/board/BoardView.tsx:172` and `src/ui/docs/DocView.tsx:123` now check `m.type !== "file-changed"` first.
  - This is needed because `ServerMessage` is now a union, it is minimal, and it keeps the old behaviour.
- All three tests the brief lists exist with the same assertions, and there is one extra fallback test.
- Cannot verify from the diff: the RED and GREEN output and the clean `pnpm check` are as reported. I did not re-run them.

### Strengths
- `request` clears its timer and deletes the pending entry in one place (`settle`), so it never settles twice and a late answer is ignored.
- `remove` rejects pending requests while iterating the Map. Deleting entries from a Map during iteration is safe in JS.
- In `request`, `body` is spread before `type` and `id` (`ws.ts:96`), so a caller cannot override either field.
- Risk checked: can a listener that throws inside `handle` crash the server? No. I read `node_modules/@hono/node-ws/dist/index.js:117-121`, and it wraps `onMessage` in try/catch and sends errors to `console.error`.
- Risk checked: can another website open the now two-way socket, become the active tab and feed fake payloads to the agent? No. `src/server/app.ts:28-44` rejects WebSocket upgrades with a foreign `Origin` or a non-loopback `Host`.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
- **No shape check before calling listeners** (`src/server/ws.ts:51-66`). The only check is on `type`.
  - A message `{type:"selection.changed"}` with no `board` or `ids` still reaches `onClient` listeners, typed as a valid `ClientMessage`.
  - A `response` with no `ok` and no `error` rejects with an empty message (`new Error(undefined)`).
  - The only sender is this app, because of the Origin guard. Still, a small type guard would make the "parses a ClientMessage" contract true.
- **One throwing listener blocks the rest** (`ws.ts:66`). The listener loop has no try/catch, so if one listener throws, the listeners after it never run. This does not affect anything yet, because only later tasks add listeners.
- **The pending-request timer is not unref'd** (`ws.ts:83-87`). An outstanding request can keep Node running for up to 10 s on shutdown. `timer.unref?.()` would fix that.
- **The default 10000 ms timeout is only checked from above** (`test/server/ws.test.ts` timeout block). The test advances 9999 ms, then 1 ms, but never checks that the request is still pending at 9999 ms.
  - A default of 5000 would still pass, so the report's claim that the test proves it "is still pending at 9999 ms" is not true.
  - A fix: attach a `settled` flag before advancing and assert it is still false after 9999 ms.
- **The fallback test leaves a real 10 s timer running** after it ends: the `void hub.request(...).catch(() => {})` request is never settled. Answering or removing `b` at the end of the test would clean it up.
- **A response from any socket can settle any request** (`ws.ts:58`). The implementer flagged this. The ids are random UUIDs and only the target socket sees them, so this is acceptable. Checking `p.socket === socket` would cost one line.
- **`RequestBody` is harder to read than it needs to be** (`ws.ts:6-11`). The `extends infer R` wrapper adds nothing. `type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;` says the same thing more plainly.

### Assessment
Task quality: Approved

Reasoning: The protocol types and the hub contract match the brief. The one signature change fixes a type in the brief that does not compile, and the edits to the two UI files are the minimum needed to keep `pnpm check` clean. The remaining items are small robustness and test-precision issues that do not block this task.
