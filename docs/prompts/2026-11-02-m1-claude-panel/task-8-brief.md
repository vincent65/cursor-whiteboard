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

