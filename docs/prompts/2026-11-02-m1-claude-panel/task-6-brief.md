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

