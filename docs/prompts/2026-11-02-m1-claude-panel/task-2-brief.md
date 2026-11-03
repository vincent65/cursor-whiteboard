### Task 2: Bidirectional WebSocket protocol and hub requests

**Files:**
- Modify: `src/shared/messages.ts`, `src/server/ws.ts`, `src/server/index.ts`
- Test: `test/server/ws.test.ts`

**Interfaces:**
- Produces in `src/shared/messages.ts`:

```ts
export type { PanelEvent } from "./panel.js";
export type AgentStatus = "starting" | "idle" | "working" | "needs_you" | "error" | "stopped";
export type ServerMessage =
  | { type: "file-changed"; kind: "board" | "doc"; name: string }
  | { type: "agent.event"; event: PanelEvent }
  | { type: "agent.status"; status: AgentStatus; message?: string }
  | { type: "request"; id: string; kind: "board.png"; board: string }
  | { type: "request"; id: string; kind: "selection.snapshot" };
export type ClientMessage =
  | { type: "response"; id: string; ok: true; payload: unknown }
  | { type: "response"; id: string; ok: false; error: string }
  | { type: "selection.changed"; board: string; ids: string[] };
```

Create `src/shared/panel.ts` with the panel event union (Task 5 adds the permission types beside it and the code that produces these events):

```ts
export type PanelEvent =
  | { kind: "user"; id: string; text: string; at: string }
  | { kind: "assistant_text"; id: string; text: string; partial: boolean; at: string }
  | { kind: "tool_use"; id: string; tool: string; summary: string; at: string }
  | { kind: "tool_result"; id: string; toolUseId: string; ok: boolean; summary: string; at: string }
  | { kind: "permission"; id: string; tool: string; summary: string; at: string }
  | { kind: "result"; id: string; subtype: string; costUsd: number | null; durationMs: number; at: string }
  | { kind: "error"; id: string; message: string; at: string };
```

- Produces on `WsHub`:

```ts
add(socket: Socket): void; remove(socket: Socket): void; broadcast(msg: ServerMessage): void; get size(): number;
handle(socket: Socket, raw: string): void;          // parses a ClientMessage; resolves pending requests; records the active socket on selection.changed
onClient(fn: (msg: ClientMessage, socket: Socket) => void): () => void;
request<T>(msg: Omit<Extract<ServerMessage, { type: "request" }>, "id" | "type">, opts?: { timeoutMs?: number }): Promise<T>;   // e.g. hub.request({ kind: "board.png", board: "main" })
```

`request` sends to the active socket (the last one that sent `selection.changed`, else the most recently added), resolves with the response payload, rejects with `Error("no browser tab is connected")` when there is no socket, with `Error("the browser did not answer in time")` after `timeoutMs` (default 10000), and with the response's `error` when `ok` is false. A removed socket rejects its pending requests immediately.

- [ ] **Step 1: Write the failing tests** (fake sockets `{ send: vi.fn() }`, fake timers for the timeout)

```ts
test("request goes to the active socket and resolves with the response payload", async () => {
  const a = { send: vi.fn() }, b = { send: vi.fn() };
  hub.add(a); hub.add(b);
  hub.handle(b, JSON.stringify({ type: "selection.changed", board: "main", ids: [] }));
  const p = hub.request<{ png: string }>({ kind: "board.png", board: "main" });
  const sent = JSON.parse(b.send.mock.calls.at(-1)[0]);
  expect(sent).toMatchObject({ type: "request", kind: "board.png", board: "main" });
  expect(a.send).not.toHaveBeenCalledWith(expect.stringContaining('"request"'));
  hub.handle(b, JSON.stringify({ type: "response", id: sent.id, ok: true, payload: { png: "x" } }));
  await expect(p).resolves.toEqual({ png: "x" });
});
test("request rejects when no socket, on timeout, on an error response, and when the socket leaves", ...);
test("onClient receives parsed messages and malformed JSON is ignored", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/server/ws.test.ts`
Expected: FAIL, `hub.handle is not a function`.

- [ ] **Step 3: Implement the protocol and the hub**

Request ids come from `crypto.randomUUID()`. In `src/server/index.ts`, the `/ws` handler passes `onMessage` events to `hub.handle(ws, String(ev.data))`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/server/ws.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/messages.ts src/shared/panel.ts src/server/ws.ts src/server/index.ts test/server/ws.test.ts
git commit -m "feat(server): bidirectional websocket protocol with hub requests"
```

---

