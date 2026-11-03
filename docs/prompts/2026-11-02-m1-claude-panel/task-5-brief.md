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

