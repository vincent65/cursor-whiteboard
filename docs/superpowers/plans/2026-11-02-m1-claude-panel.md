# Milestone 1: Claude Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Claude panel inside the whiteboard that runs a plan session on the Claude Agent SDK with the user's own Claude Code login: streaming text, tool activity rows, permission dialogs, two board-reading tools, stop, and resume across server restarts, so "describe what I selected" comes back as text.

**Architecture:** The server gains an `agent` module: a `PlanSession` that drives `query()` with streaming input and maps SDK messages to panel events, a `PermissionBroker` that turns the SDK's permission callback into a dialog in the browser, in-process MCP tools that read the board, and a system prompt append with Blueprint's conventions. The WebSocket becomes bidirectional with a request-response channel so tools can ask the open tab for PNG snapshots and the current selection. The UI gains a server-events context, the panel, and selection reporting from the board view. Claude Code runs as a subprocess the SDK spawns with the repository as its working directory, loading the user's and the repository's settings as the CLI would.

**Tech Stack:** `@anthropic-ai/claude-agent-sdk` 0.3.x (bundles the Claude Code binary), Zod 4 for tool schemas, the milestone 0 stack (Hono, `@hono/node-ws`, React 19, Vite, Excalidraw, CodeMirror, Vitest, Testing Library, Biome), `mermaid` as a dev dependency for a parser test.

**Spec:** `docs/build-plan.md` (sections 4, 5, 6.1, 6.4, 6.5 read tools only, 6.8, 8 row 1, 9, 10). Milestone 0 is on `main`; this plan builds on its interfaces.

## Global Constraints

- Node 22.1 or later; TypeScript strict; ESM; server code uses NodeNext resolution with explicit `.js` extensions on relative imports.
- No API key anywhere. The SDK runs on the user's Claude Code login; Blueprint never reads, stores, or forwards credentials. The init message's `apiKeySource` is reported but never acted on.
- The plan session's working directory is the repository root, and `settingSources` is left at its default so the user's and the repository's CLAUDE.md, skills, hooks, and MCP servers load as in the CLI.
- Claude never edits board files directly: a `PreToolUse` hook denies `Write`, `Edit`, `MultiEdit`, and `NotebookEdit` on paths under `.blueprint/boards/` and `.blueprint/assets/`.
- All agent output reaches the browser as typed WebSocket messages; commands go through HTTP routes so they are testable with `app.request()`.
- The panel is titled `Claude`; no "Claude Code" branding anywhere in UI copy.
- Every UI test file that renders components or hooks starts with `// @vitest-environment jsdom`.
- Commit messages use conventional commits and carry no co-author trailer.
- `pnpm check` (both typechecks, Biome, Vitest) stays pristine; `pnpm build` warns only about the pre-existing chunk size.

## Review Focus

1. Claude Code is not installed or not logged in: the panel must show a readable error naming the fix (run `claude` once and log in) instead of hanging. Pinned in Task 6 (query throws) and Task 9 (error status renders).
2. A permission request arrives while no tab is connected: it must wait, show when a tab connects, and be cancelled by Stop. Pinned in Task 5 and Task 8.
3. The user sends a second message while a turn is running: it must queue, show as pending, and be processed after the turn. Pinned in Task 6.
4. A tool asks the browser for a snapshot and the tab is closed: the tool must return a clear error to Claude within seconds, never hang the turn. Pinned in Task 2 and Task 7.
5. The server restarts with a saved session id: the transcript must be restored and the session resumed; if the SDK cannot find the session, start fresh and say so in the panel. Pinned in Task 6 and Task 8.

---

### Task 1: SDK dependency, sessions file, and the login spike

**Files:**
- Modify: `package.json` (dependency), `src/shared/types.ts`, `src/server/files.ts`
- Create: `scripts/sdk-check.mjs`
- Test: `test/server/files.test.ts`

**Interfaces:**
- Produces in `src/shared/types.ts`:

```ts
export type RunStatus = "working" | "needs_you" | "idle" | "done" | "failed" | "interrupted";
export type RunRecord = {
  id: string; taskSlug: string; sessionId: string; worktree: string; branch: string;
  status: RunStatus; prUrl: string | null; costUsd: number; startedAt: string; endedAt: string | null;
};
export type SessionsFile = { plan: { sessionId: string; updatedAt: string } | null; runs: RunRecord[] };
```

- Produces on `FileStore`: `readSessions(): Promise<SessionsFile>` (a missing file is `{ plan: null, runs: [] }`) and `writeSessions(s: SessionsFile): Promise<void>` (atomic, pretty JSON at `.blueprint/sessions.json`).

- [ ] **Step 1: Add the dependency**

Run: `pnpm add @anthropic-ai/claude-agent-sdk@^0.3.316`
Expected: the package and its platform binary optional dependency install; `node -e "import('@anthropic-ai/claude-agent-sdk').then(m => console.log(typeof m.query))"` prints `function`.

- [ ] **Step 2: Write the failing tests**

```ts
test("sessions file round-trips and defaults when missing", async () => {
  expect(await store.readSessions()).toEqual({ plan: null, runs: [] });
  const s = { plan: { sessionId: "abc", updatedAt: "2026-11-02T00:00:00.000Z" }, runs: [] };
  await store.writeSessions(s);
  expect(await store.readSessions()).toEqual(s);
  expect(JSON.parse(await readFile(join(store.dir, "sessions.json"), "utf8"))).toEqual(s);
});
test("a corrupt sessions file is reported, not silently replaced", async () => {
  await writeFile(join(store.dir, "sessions.json"), "{not json");
  await expect(store.readSessions()).rejects.toThrow();
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm vitest run test/server/files.test.ts -t sessions`
Expected: FAIL, `readSessions is not a function`.

- [ ] **Step 4: Implement the types and the two methods**

Add the types to `src/shared/types.ts`; implement the methods in `src/server/files.ts` using the existing atomic `write` helper and a Zod schema for `SessionsFile` so a wrong shape throws.

- [ ] **Step 5: Write the spike script**

`scripts/sdk-check.mjs` runs one query from the current directory with `maxTurns: 1`, `allowedTools: []`, and the prompt `Reply with the single word ready.`, prints the init message's `apiKeySource`, `claude_code_version`, and `model`, prints the result text, and exits 1 if no result message arrives within 120 seconds. It is run by hand, never by tests.

- [ ] **Step 6: Run the tests and the spike**

Run: `pnpm vitest run test/server/files.test.ts && node scripts/sdk-check.mjs`
Expected: tests PASS; the spike prints `apiKeySource: none` (the claude.ai login), a version, a model, and a result containing `ready`. Record the exact output in the report; if it fails with an authentication error, report BLOCKED with the output.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/shared/types.ts src/server/files.ts scripts/sdk-check.mjs test/server/files.test.ts
git commit -m "feat(agent): add the Agent SDK, the sessions file, and a login spike"
```

---

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

### Task 3: Server events context in the UI and sidebar refresh

**Files:**
- Create: `src/ui/server-events.tsx`
- Modify: `src/ui/api.ts`, `src/ui/App.tsx`, `src/ui/board/BoardView.tsx`, `src/ui/docs/DocView.tsx`
- Test: `test/ui/server-events.test.tsx`

**Interfaces:**
- Produces in `src/ui/server-events.tsx`:

```ts
export function ServerEventsProvider({ children }: { children: ReactNode }): JSX.Element;
export function useServerEvent(handler: (m: ServerMessage) => void): void;   // subscribes for the component's lifetime
export function useSendToServer(): (m: ClientMessage) => void;              // queued until the socket is open
```

- `api.ts` keeps `connectWs` but it now accepts and returns the typed messages: `connectWs(onMessage: (m: ServerMessage) => void): { send(m: ClientMessage): void; close(): void }`.
- `App.tsx` wraps the shell in the provider, and refreshes the sidebar lists when a `file-changed` arrives for a board or doc name it does not know.
- `BoardView` and `DocView` subscribe with `useServerEvent` instead of opening their own sockets.

- [ ] **Step 1: Write the failing tests** (file starts with the jsdom pragma; a fake `WebSocket` class installed on `window`)

```tsx
test("subscribers receive parsed messages and sends queue until open", async () => {
  // render a probe component inside the provider; fake socket records sends
  // after the fake socket fires onopen, a queued selection.changed is sent once
  // a file-changed message dispatched through onmessage reaches the subscriber
});
test("a file-changed for an unknown doc refreshes the sidebar lists", ...);  // App with mocked api: listDocs called again after the message
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/ui/server-events.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the provider and rewire the views**

The provider owns one socket per tab, dispatches each message to every subscriber, and keeps a send queue while the socket is connecting or reconnecting. The views' existing message filters stay the same.

- [ ] **Step 4: Run the UI tests and verify by hand**

Run: `pnpm vitest run test/ui && pnpm dev`
Then: with the app open, create a doc file on disk by hand and confirm it appears in the sidebar without a reload; confirm the board and doc external-change behavior from milestone 0 still works.
Expected: tests PASS and both checks hold.

- [ ] **Step 5: Commit**

```bash
git add src/ui/server-events.tsx src/ui/api.ts src/ui/App.tsx src/ui/board/BoardView.tsx src/ui/docs/DocView.tsx test/ui/server-events.test.tsx
git commit -m "feat(ui): one server-events socket per tab and live sidebar refresh"
```

---

### Task 4: Selection reporting and browser responders

**Files:**
- Create: `src/ui/board/snapshot.ts`
- Modify: `src/ui/board/BoardView.tsx`
- Test: `test/ui/snapshot.test.ts`

**Interfaces:**
- Produces in `src/ui/board/snapshot.ts`:

```ts
export function selectedIds(appState: { selectedElementIds: Record<string, boolean> }, elements: readonly { id: string; isDeleted?: boolean }[]): string[];  // ids in element order, non-deleted only
export function blobToDataUrl(blob: Blob): Promise<string>;   // arrayBuffer + btoa, never FileReader
export function sameIds(a: string[], b: string[]): boolean;
```

- `BoardView` sends `selection.changed` (debounced 150 ms, only when the id list changed) and answers server requests: `board.png` with `{ png: dataUrl }` of the whole board, `selection.snapshot` with `{ ids, png: dataUrl | null }` where the PNG covers only the selected elements (export padding 16) and is null when nothing is selected.

- [ ] **Step 1: Write the failing tests**

```ts
test("selectedIds keeps element order and drops deleted elements", () => {
  expect(selectedIds({ selectedElementIds: { b: true, a: true, z: true } }, [{ id: "a" }, { id: "b" }, { id: "z", isDeleted: true }])).toEqual(["a", "b"]);
});
test("blobToDataUrl encodes bytes", async () => {
  expect(await blobToDataUrl(new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }))).toBe("data:image/png;base64,AQID");
});
test("sameIds compares as ordered lists", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/ui/snapshot.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the helpers and wire the board view**

The responders live in a `useServerEvent` handler in `BoardView` that answers only requests for its own board (`board.png` with a different board name is answered with `ok: false` and the error `board <name> is not open`); `selection.snapshot` uses the latest scene from the `latest` ref.

- [ ] **Step 4: Run the tests and verify by hand**

Run: `pnpm vitest run test/ui/snapshot.test.ts && pnpm dev`
Then: select shapes and confirm in the browser devtools network tab (WS frames) that `selection.changed` is sent once per change.
Expected: tests PASS and the check holds.

- [ ] **Step 5: Commit**

```bash
git add src/ui/board/snapshot.ts src/ui/board/BoardView.tsx test/ui/snapshot.test.ts
git commit -m "feat(ui): report the board selection and answer snapshot requests"
```

---

### Task 5: Permission broker and SDK event mapping

**Files:**
- Create: `src/server/agent/broker.ts`, `src/server/agent/events.ts`
- Modify: `src/shared/panel.ts`
- Test: `test/server/agent/broker.test.ts`, `test/server/agent/events.test.ts`

**Interfaces:**
- Consumes: `PanelEvent` from `src/shared/panel.ts` (Task 2).
- Produces in `src/shared/panel.ts`, beside the union:

```ts
export type PermissionDecision = { behavior: "allow" | "deny" | "always"; message?: string };
export type PendingPermission = { id: string; tool: string; summary: string; at: string };
```

- Produces in `src/server/agent/broker.ts`:

```ts
export class PermissionBroker {
  constructor(opts: { onChange(pending: PendingPermission[]): void });
  ask(req: { toolUseID: string; tool: string; input: Record<string, unknown>; suggestions?: PermissionUpdate[]; signal: AbortSignal }): Promise<PermissionResult>;
  answer(id: string, decision: PermissionDecision): boolean;   // false when unknown id
  pending(): PendingPermission[];
  cancelAll(reason: string): void;                             // resolves every pending ask as deny with that message
}
```

`always` resolves `{ behavior: "allow", updatedPermissions: suggestions ?? [] }`; `allow` resolves `{ behavior: "allow" }`; `deny` resolves `{ behavior: "deny", message }` with the default message `The user denied this action in Blueprint.`; an aborted signal resolves deny with `interrupted` and drops the pending entry.

- Produces in `src/server/agent/events.ts`:

```ts
export function summarizeTool(name: string, input: Record<string, unknown>): string;
export class SdkEventMapper { map(msg: SDKMessage): PanelEvent[]; get sessionId(): string | undefined; }
```

Summaries: `Read` → `reading <file_path>`; `Edit`, `Write`, `MultiEdit` → `editing <file_path>`; `Bash` → `` running `<command truncated to 60 chars>` ``; `Grep`, `Glob` → `searching <pattern>`; `mcp__blueprint__get_board` → `reading the board`; `mcp__blueprint__get_selection` → `reading the selection`; anything else → the tool name. Mapping: `system` init records the session id and emits nothing; `assistant` emits `assistant_text` (partial false) per text block and `tool_use` per tool block; `user` emits `tool_result` per tool_result block (ok is `!is_error`, summary is the first 120 characters of the text); `stream_event` with a `content_block_delta` text delta emits `assistant_text` partial true with the text accumulated for that block index since the block started; `result` emits `result` on success and `error` on error subtypes with the joined `errors`.

- [ ] **Step 1: Write the failing tests**

```ts
test("ask resolves allow, deny with default message, and always with the suggestions", async () => { ... });
test("pending lists open asks, answer with an unknown id is false, cancelAll denies with the reason", ...);
test("an aborted signal denies as interrupted and clears the entry", ...);
test("summarizeTool follows the table", ...);   // one assertion per row
test("mapper turns a scripted SDK stream into panel events in order", ...);   // init, assistant text+tool_use, user tool_result, stream deltas accumulating, result success
test("an error result becomes an error event with the joined messages", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/server/agent`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the broker and the mapper**

Import `SDKMessage`, `PermissionResult`, and `PermissionUpdate` types from the SDK; keep both files free of I/O.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/server/agent`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/panel.ts src/server/agent/broker.ts src/server/agent/events.ts test/server/agent
git commit -m "feat(agent): permission broker and SDK event mapping"
```

---

### Task 6: PlanSession on the Agent SDK

**Files:**
- Create: `src/server/agent/session.ts`
- Test: `test/server/agent/session.test.ts`

**Interfaces:**
- Consumes: `SdkEventMapper` and `PermissionBroker` from Task 5; `PanelEvent`, `AgentStatus` from `src/shared`.
- Produces:

```ts
export type SessionDeps = {
  query: typeof import("@anthropic-ai/claude-agent-sdk").query;
  getSessionMessages: typeof import("@anthropic-ai/claude-agent-sdk").getSessionMessages;
  cwd: string;
  options: Partial<Options>;                       // mcpServers, hooks, canUseTool, systemPrompt come from Task 8
  onEvent(e: PanelEvent): void;
  onStatus(s: AgentStatus, message?: string): void;
  onSessionId(id: string): void;
};
export class PlanSession {
  constructor(deps: SessionDeps, resumeId?: string);
  async restore(): Promise<void>;                  // seeds the transcript from getSessionMessages(resumeId); a failure emits an error event "previous session could not be loaded; starting fresh" and clears resumeId
  send(text: string): string;                      // enqueues a user message, returns its event id, starts the query on first call
  async interrupt(): Promise<void>;
  get status(): AgentStatus;
  get sessionId(): string | undefined;
  transcript(): PanelEvent[];                      // last 500 events
  async close(): Promise<void>;
}
```

Status rules: `starting` from the first send until the init message, then `idle`; `working` while a user message is being processed until its `result`; `needs_you` is set by Task 8 when the broker has pending asks; an error result or a thrown query sets `error` with the message, and the next `send` starts a fresh query (with `resume` when a session id is known); `stopped` after `close`. Messages sent while `working` are queued in order and each emits its `user` event immediately. The query receives an async generator that yields queued `SDKUserMessage`s and stays open until `close`. `includePartialMessages` is true.

- [ ] **Step 1: Write the failing tests** (a fake `query` that reads the prompt iterable and yields scripted messages per user message; a fake `getSessionMessages`)

```ts
test("send starts the query, streams events, and goes idle on result", ...);        // events: user, assistant_text partial, assistant_text, result; status starting→working→idle
test("a second send during a turn queues and is processed after the first result", ...);
test("a thrown query becomes an error event and status error, and the next send starts a new query with resume", ...);
test("restore seeds the transcript from the saved session and a failure starts fresh with an error event", ...);
test("interrupt calls query.interrupt and close ends the input stream", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/server/agent/session.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `PlanSession`**

The user message pushed to the SDK is `{ type: "user", message: { role: "user", content: text }, parent_tool_use_id: null }`. The generator is a simple promise-based queue. Event ids come from `crypto.randomUUID()`; timestamps are ISO strings.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/server/agent/session.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/agent/session.ts test/server/agent/session.test.ts
git commit -m "feat(agent): plan session with streaming input, status, and resume"
```

---

### Task 7: Board tools, system prompt, and the board-write hook

**Files:**
- Create: `src/server/agent/tools.ts`, `src/server/agent/prompt.ts`, `src/server/agent/hooks.ts`
- Test: `test/server/agent/tools.test.ts`, `test/server/agent/prompt.test.ts`, `test/server/agent/hooks.test.ts`

**Interfaces:**
- Consumes: `FileStore`, `WsHub.request` (Task 2), the export module.
- Produces:

```ts
// tools.ts
export function createBoardTools(deps: { store: FileStore; hub: Pick<WsHub, "request"> }): McpSdkServerConfigWithInstance;  // server name "blueprint", tools get_board and get_selection
export function selectionGraph(graph: BoardGraph, ids: string[]): BoardGraph;   // nodes, edges, loose filtered to ids; edges keep ends only if both are in ids
// prompt.ts
export const SYSTEM_PROMPT_APPEND: string;
export function selectionHeader(board: string, graph: BoardGraph, ids: string[]): string;   // "" when ids is empty
export function composeUserMessage(text: string, header: string): string;              // header + blank line + text, or text alone
// hooks.ts
export function denyBoardWrites(root: string): HookCallback;   // PreToolUse for Write|Edit|MultiEdit|NotebookEdit; root is the fixed repository root, hook cwd only resolves relative paths
export function isProtectedPath(cwd: string, filePath: string): boolean;
```

- `get_board({ board?: string })`: the board's Markdown export as a text block, then the PNG from `hub.request({ kind: "board.png", board })` as an image block; when the request fails, the text block ends with `(No PNG: <error>)`. With no `board`, the first board by name.
- `get_selection({})`: `hub.request({ kind: "selection.snapshot" })`; with no ids returns the text `Nothing is selected on the board.`; otherwise the Markdown of `selectionGraph` plus the PNG crop when present. The board name comes from the hub's last `selection.changed`, exposed as `hub.activeBoard`.
- `SYSTEM_PROMPT_APPEND` covers, in this order: where the plan files live (`.blueprint/` with boards, docs, spec, tasks); that boards are read with the two tools and never edited directly; that a selection header in a user message means "this" refers to those elements; that diagrams must be flowchart, sequence, class, ER, or state Mermaid (for milestone 2's proposals); that long descriptions go in a doc under `.blueprint/docs/` with a short note on the board; and that the user sees tool calls as short rows, so answers should be in the text.
- `selectionHeader` renders `[Selection on board "<board>": <id> <kind> "<label>"; ...; <edgeId> arrow "<label>" (<from>→<to>)]`.
- `isProtectedPath(root, filePath)` resolves `filePath` against `root` and returns true under `root/.blueprint/boards/` or `root/.blueprint/assets/`; the guard anchors on the repository root, never on the hook's drifting `cwd`.

- [ ] **Step 1: Write the failing tests**

```ts
test("get_board returns markdown and the PNG from the browser, or a note when the browser fails", ...);
test("get_selection returns nothing-selected text, or the filtered graph markdown with the crop", ...);
test("selectionGraph keeps only selected nodes, edges between them, and selected loose items", ...);
test("selectionHeader renders ids, kinds, labels, and arrow ends; empty ids give empty string", ...);
test("denyBoardWrites denies a Write under .blueprint/boards and allows src/x.ts", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/server/agent/tools.test.ts test/server/agent/prompt.test.ts test/server/agent/hooks.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the three modules**

Tools use `tool(name, description, zodShape, handler)` and `createSdkMcpServer({ name: "blueprint", tools })` from the SDK; the PNG data URL from the browser is split into media type and base64 for the image block. The hub gains `activeBoard: string | null` in `src/server/ws.ts`, set by `selection.changed`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/server/agent`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/agent/tools.ts src/server/agent/prompt.ts src/server/agent/hooks.ts src/server/ws.ts test/server/agent
git commit -m "feat(agent): board tools, system prompt, and the board-write guard"
```

---

### Task 8: Agent routes and server wiring

**Files:**
- Create: `src/server/agent/index.ts`, `src/server/agentRoutes.ts`
- Modify: `src/server/app.ts`, `src/server/index.ts`
- Test: `test/server/agentRoutes.test.ts`

**Interfaces:**
- Produces in `src/server/agent/index.ts`:

```ts
export type Agent = {
  send(text: string, selection?: { board: string; ids: string[] }): Promise<string>;  // composes the header from the stored board, returns the user event id
  interrupt(): Promise<void>;                                                            // cancels pending permissions, then interrupts the session
  answerPermission(id: string, d: PermissionDecision): boolean;
  state(): { status: AgentStatus; message?: string; sessionId?: string; transcript: PanelEvent[]; pending: PendingPermission[] };
  close(): Promise<void>;
};
export async function createAgent(deps: { store: FileStore; hub: WsHub; cwd: string; sdk?: Pick<typeof import("@anthropic-ai/claude-agent-sdk"), "query" | "getSessionMessages"> }): Promise<Agent>;
```

`createAgent` reads `sessions.json`, builds the broker (whose `onChange` broadcasts `agent.status` as `needs_you` while asks are pending, and emits a `permission` event per new ask), the tools, the hooks, the system prompt (`{ type: "preset", preset: "claude_code", append: SYSTEM_PROMPT_APPEND }`), `permissionMode: "default"`, `canUseTool` bound to the broker, and the `PlanSession` with `resume` when a plan session id is saved; `onSessionId` writes `sessions.json`; every event and status change is broadcast through the hub.

- Produces in `src/server/agentRoutes.ts`: `agentRoutes(agent: Agent): Hono` with `POST /send` `{ text, selection? }` → 202 `{ id }` (400 on empty text); `POST /interrupt` → 204; `POST /permission` `{ id, behavior, message? }` → 204 or 404; `GET /state` → the state object. `createApp(store, agent?)` mounts them under `/api/agent` when an agent is given.

- [ ] **Step 1: Write the failing tests** (a fake `Agent` object)

```ts
test("send returns 202 with the id and rejects empty text with 400", ...);
test("permission answers map to the broker and unknown ids are 404", ...);
test("state is returned as JSON and interrupt returns 204", ...);
test("without an agent the routes are absent (404 JSON)", ...);
test("createAgent: interrupt cancels pending permission asks before interrupting the session", ...);   // fake sdk whose query awaits canUseTool; after interrupt the ask resolved as deny and query.interrupt was called
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/server/agentRoutes.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the module, the routes, and the wiring**

`startServer` creates the hub before the app, then the agent, passes both to `createApp`, and closes the agent in `close()`. The agent's `send` reads the board named in the selection, builds the `BoardGraph`, and prefixes the header; a selection for a board that does not exist is ignored with a logged warning.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/server`
Expected: PASS for all server tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/agent/index.ts src/server/agentRoutes.ts src/server/app.ts src/server/index.ts test/server/agentRoutes.test.ts
git commit -m "feat(server): agent routes and wiring of the plan session"
```

---

### Task 9: The Claude panel UI

**Files:**
- Create: `src/ui/panel/ClaudePanel.tsx`, `src/ui/panel/transcript.ts`, `src/ui/panel/PermissionDialog.tsx`, `src/ui/selection.tsx`
- Modify: `src/ui/api.ts`, `src/ui/App.tsx`, `src/ui/board/BoardView.tsx`, `src/ui/styles.css`
- Test: `test/ui/transcript.test.ts`, `test/ui/ClaudePanel.test.tsx`

**Interfaces:**
- Produces in `src/ui/panel/transcript.ts`:

```ts
export type TranscriptItem = PanelEvent;   // partial assistant_text events replace the item with the same id
export function reduceTranscript(items: TranscriptItem[], event: PanelEvent): TranscriptItem[];
```

- Produces in `src/ui/api.ts`: `agentSend(text, selection?)`, `agentInterrupt()`, `agentPermission(id, decision)`, `agentState()`.
- Produces in `src/ui/selection.tsx`: `SelectionProvider`, `useSelection(): { board: string; ids: string[]; labels: string[] } | null`, `useSetSelection()`; `BoardView` publishes its selection (ids plus the labels of the selected elements) through it in the same debounced handler as Task 4.
- `ClaudePanel` renders: a header `Claude` with the status strip (`Idle`, `Working`, `Needs you`, `Error: <message>`, `Starting`) and a `Stop` button enabled while working; the transcript (user items right-aligned, assistant text as paragraphs preserving line breaks, tool rows muted as `<summary>`, tool results muted with a failure mark when not ok, result rows as `Done · $<cost>` when cost is known); the inline `PermissionDialog` for the oldest pending ask with `Allow once`, `Allow always`, `Deny`; selection chips above the input showing `<n> selected: <labels>` or nothing; a textarea where Enter sends and Shift+Enter inserts a newline, disabled while the status is `starting`.
- On mount the panel loads `agentState()` and then applies `agent.event` and `agent.status` messages from `useServerEvent`.

- [ ] **Step 1: Write the failing tests**

```ts
test("reduceTranscript appends events and replaces a partial text by id, final text wins", ...);
test("panel renders restored transcript, sends on Enter with the current selection, shows Stop while working", ...);   // api mocked
test("a pending permission renders the dialog and Allow always calls agentPermission with behavior always", ...);
test("an error status shows the message", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/ui/transcript.test.ts test/ui/ClaudePanel.test.tsx`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the panel**

Styles in `styles.css` with the existing tokens: `.panel`, `.panel-header`, `.status`, `.transcript`, `.msg-user`, `.msg-assistant`, `.msg-tool`, `.msg-result`, `.chips`, `.composer`; the dialog uses `.notice` and `.button`. The transcript auto-scrolls to the bottom when a new item arrives and the user is already at the bottom.

- [ ] **Step 4: Run the tests, the build, and verify by hand**

Run: `pnpm vitest run test/ui && pnpm build && pnpm dev`
Then: with a board open and shapes selected, ask `Describe what I selected`; confirm a `reading the selection` row, streaming text, an `Idle` status with cost, and that the chips showed the selection.
Expected: tests PASS, build succeeds, the check holds.

- [ ] **Step 5: Commit**

```bash
git add src/ui/panel src/ui/selection.tsx src/ui/api.ts src/ui/App.tsx src/ui/board/BoardView.tsx src/ui/styles.css test/ui/transcript.test.ts test/ui/ClaudePanel.test.tsx
git commit -m "feat(ui): the Claude panel with streaming transcript, permissions, and selection chips"
```

---

### Task 10: Robustness carried from milestone 0

**Files:**
- Modify: `src/ui/board/BoardView.tsx`, `src/ui/docs/DocView.tsx`
- Test: `test/ui/docReload.test.ts`

**Interfaces:**
- Produces in `src/ui/docs/DocView.tsx` (exported for the test): `replaceFromDisk(view: EditorView, text: string): void` which replaces the document without adding to undo history (`Transaction.addToHistory.of(false)` plus the remote annotation) and keeps the cursor at the same offset clamped to the new length.
- `BoardView`: a `file-changed` for the open board that arrives while a save is in flight is handled after the save queue settles, so the comparison uses the settled state.

- [ ] **Step 1: Write the failing test** (jsdom)

```ts
test("replaceFromDisk keeps the cursor, adds no undo step, and does not mark the doc dirty", () => {
  // build an EditorView with history(); place cursor at 3; replaceFromDisk with longer text; undoDepth(state) stays 0; selection.main.head is 3
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run test/ui/docReload.test.ts`
Expected: FAIL, `replaceFromDisk` not exported.

- [ ] **Step 3: Implement both changes**

For the board, wrap the watcher handler body in `queue.current.then(...)` so it runs after pending saves.

- [ ] **Step 4: Run the tests and verify by hand**

Run: `pnpm vitest run test/ui && pnpm dev`
Then: edit a doc externally while clean and confirm Ctrl+Z does not resurrect the old text; edit the board file externally right after a stroke and confirm no spurious conflict banner.
Expected: tests PASS and both checks hold.

- [ ] **Step 5: Commit**

```bash
git add src/ui/board/BoardView.tsx src/ui/docs/DocView.tsx test/ui/docReload.test.ts
git commit -m "fix(ui): settle saves before comparing disk changes and reload docs without undo steps"
```

---

### Task 11: Mermaid parser test over the golden blocks

**Files:**
- Modify: `package.json` (dev dependency `mermaid`)
- Test: `test/export/mermaid.test.ts`

- [ ] **Step 1: Write the failing test** (jsdom pragma)

```ts
test("every mermaid block the renderer produces parses with the real Mermaid parser", async () => {
  // basic.md's block, plus boardGraphToMarkdown over graphs that exercise: a label with quotes, pipes and brackets; both arrowheads; none; start-only; a diamond; a subgraph
  for (const block of blocks) await expect(mermaid.parse(block)).resolves.toBeTruthy();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm add -D mermaid && pnpm vitest run test/export/mermaid.test.ts`
Expected: the test file runs; any block that does not parse fails the test. If all parse on the first run, the step still proves the harness works (temporarily break a label in the test input to see a failure, then restore it, and note that in the report).

- [ ] **Step 3: Fix the renderer only if a block fails to parse**

Any fix goes in `src/export/markdown.ts` with the golden fixture updated.

- [ ] **Step 4: Run the full check**

Run: `pnpm check`
Expected: PASS, pristine.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml test/export/mermaid.test.ts src/export/markdown.ts test/export/fixtures
git commit -m "test(export): parse the golden Mermaid blocks with the real parser"
```

---

### Task 12: Milestone acceptance

**Files:** none expected.

- [ ] **Step 1: Full check and build**

Run: `pnpm check && pnpm build`
Expected: pristine apart from the chunk-size warning.

- [ ] **Step 2: Acceptance on a scratch repository with the real login**

Run `node dist/cli/index.js --no-open` in a fresh git repository, open the app, draw two labeled boxes and an arrow, select them, and in the panel ask `Describe what I selected`. Expected: a `reading the selection` row, streaming text that names both boxes and the arrow, then `Idle` with a cost. Ask `List the files in this repository` and expect a permission dialog for Bash; choose `Allow once` and see the result. Click `Stop` during a long answer and see status return to `Idle`. Restart the server, reload, and ask `What was my first question?`; expect the restored transcript and a correct answer. Record every observation in the report and fix only what the run reveals, with `pnpm check` green and conventional commits.

- [ ] **Step 3: Commit any fixes**

Only if Step 2 required changes.
