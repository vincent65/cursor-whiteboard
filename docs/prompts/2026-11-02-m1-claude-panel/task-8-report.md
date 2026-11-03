# Task 8 report: Agent routes and server wiring

Status: DONE_WITH_CONCERNS (one deliberate addition beyond the brief, see Concerns).

Commit: `3800404 feat(server): agent routes and wiring of the plan session`

## What I implemented

### `src/server/agent/index.ts`

- `Agent` type exactly as the brief specifies.
- `createAgent({ store, hub, cwd, sdk? })`:
  - Reads `sessions.json` and builds the `PlanSession` with the saved plan session id, which `restore()` loads eagerly (it reads JSONL and spawns nothing).
  - The SDK is lazy: `query` is first called on the first `send`. Before that, `state()` reports `idle` with the restored transcript, or an empty one.
  - Session options: `systemPrompt: { type: "preset", preset: "claude_code", append: SYSTEM_PROMPT_APPEND }`, `permissionMode: "default"`, `mcpServers: { blueprint: createBoardTools({ store, hub }) }`, `hooks: { PreToolUse: [{ matcher: "Write|Edit|MultiEdit|NotebookEdit", hooks: [denyBoardWrites(cwd)] }] }`, and `canUseTool` bound to `broker.ask({ toolUseID, tool, input, suggestions, signal })`.
  - Broker `onChange`: broadcasts one `agent.event` of kind `permission` for each new ask (tracked by id), then broadcasts `agent.status`. The status is `needs_you` while asks are pending and the session's own status and message otherwise.
  - Session `onEvent` and `onStatus` broadcast through the hub. `onSessionId` re-reads `sessions.json` and writes `plan: { sessionId, updatedAt }`, keeping `runs`. Write errors are logged.
  - `send` reads the board named in the selection, builds the `BoardGraph`, and prefixes `selectionHeader` through `composeUserMessage`. If the board read fails (missing, invalid name, or corrupt), the selection is dropped with `console.warn` and the text still goes. An empty `ids` list skips the read.
  - `interrupt` calls `broker.cancelAll("interrupted")` first, then `session.interrupt()`. `close` cancels pending asks, then closes the session.
  - `state()` returns `{ status, message?, sessionId?, transcript, pending }`.

### `src/server/agentRoutes.ts`

- `POST /send` with `{ text, selection? }` returns 202 `{ id }`.
  It returns 400 `{ error }` when the text is empty or whitespace, the body is not JSON, or the selection is malformed.
- `POST /interrupt` returns 204.
- `POST /permission` with `{ id, behavior, message? }` returns 204.
  It returns 404 `{ error }` for an unknown id and 400 for a bad body, such as an unknown behavior.
- `GET /state` returns the state object.
- Bodies are validated with Zod, which is already a dependency. Error text comes from `z.prettifyError`. The raw `error.message` was a JSON dump of the issues, which I saw in the manual run and replaced.

### Wiring

- `createApp(store, agent?)` mounts `agentRoutes` under `/api/agent` when an agent is given.
- I moved the `/api/*` JSON 404 from `startServer` into `createApp`. This makes the test "without an agent the routes are absent (404 JSON)" hold for `createApp` alone, and every API 404 is now JSON in both places. `ws.test.ts` still covers the server-level 404.
- `startServer` creates the hub, then the agent (`cwd: opts.root`), passes both to `createApp`, and calls `agent.close()` in `close()`.

## TDD evidence

RED, before any implementation:

```
$ pnpm vitest run test/server/agentRoutes.test.ts
     10| import { type Agent, createAgent } from "../../src/server/agent/index.…
       | ^
 Test Files  1 failed (1)
      Tests  no tests
```

First GREEN attempt: 2 failures, both caused by my test assumptions.

- I expected the rectangle's header kind to be `rectangle`, but the exporter reports it as `box`. The test now asserts the exact header `[Selection on board "main": r1 box ""]\n\ndescribe this`.
- The fake logged the settled ask on a later microtask, so the order read `interrupt, ask:deny` even though `cancelAll` had already run.
  The fake's `interrupt` now records `agent.state().pending.length` at the moment it is called.
  Mutation check: with the two lines of `interrupt` swapped, the test fails with `expected [ 'interrupt pending=1' ] to deeply equal [ 'interrupt pending=0' ]`.
  With the correct order it passes.

GREEN:

```
$ pnpm vitest run test/server
 Test Files  11 passed (11)
      Tests  67 passed (67)

$ pnpm check   (exit 0; tsc x2 clean, "Checked 72 files ... No fixes applied.", no stderr in vitest)
 Test Files  23 passed (23)
      Tests  110 passed (110)
```

Tests in `test/server/agentRoutes.test.ts`:
1. send returns 202 with the id and rejects empty text with 400 (also rejects non-string text and a malformed selection).
2. permission answers map to the broker and unknown ids are 404 (also rejects a bad behavior with 400).
3. state is returned as JSON and interrupt returns 204.
4. without an agent the routes are absent (404 JSON).
5. createAgent: interrupt cancels pending permission asks before interrupting the session. The fake SDK's `query` awaits `options.canUseTool` for a scripted `Bash` call. The test also checks:
   - Nothing is spawned before the first send.
   - A selection on a missing board is dropped with a warning.
   - The options are correct.
   - Blueprint's own tools are auto-allowed while a look-alike from config still asks.
   - `needs_you` status and the `permission` event are broadcast, and the session id is written to `sessions.json`.
   - The ask resolves `{ behavior: "deny", message: "interrupted" }` and `query.interrupt` is called after that.
   - Status returns to `working`.
   - `close()` leaves the agent `stopped`.
6. createAgent resumes the saved plan session and composes the selection header. This is an extra test.
   It checks that the restored transcript shows before any spawn, that `resume: "old"` is passed, and the exact header text.

## Manual observations

I ran `startServer` with `node --import tsx` against a fresh temp repository.

- `GET /api/agent/state` returned 200 `{"status":"idle","transcript":[],"pending":[]}`.
- `POST /api/agent/send` with `{ text: " " }` returned 400 `{"error":"✖ text must not be empty\n  → at text"}`.
- `POST /api/agent/permission` with an unknown id returned 404 `{"error":"permission x not found"}`.
- `POST /api/agent/interrupt` while idle returned 204.
- `GET /api/agent/nope` returned 404 `{"error":"not found"}`.
- `close()` completed.

Real SDK round trip, using the user's Claude Code login with `api.anthropic.com` allowed through the sandbox:

- `POST /send` "Reply with the single word ready." returned 202.
- `/state` reached `idle`, with transcript `user`, then `assistant_text "ready"`, then `result` (cost 0.128).
- `sessions.json` held `plan.sessionId` and `runs: []`.
- `close()` was clean.

The first real run used `allowedTools` for the two board tools. The SDK then printed `[CLAUDE_SDK_CAN_USE_TOOL_SHADOWED] Warning: canUseTool will not be invoked for: mcp__blueprint__get_board, ...` on every query start.
I replaced it with the `canUseTool` short-circuit described under Concerns, and the warning is gone.

Restart on the same repository: `/state` showed `idle` with the error event "previous session could not be loaded; starting fresh", which is the Review Focus 5 fallback working.
The cause is this environment: the sandbox denies writes to `~/.claude/projects`, so the spawned CLI never saved the session JSONL.
`find ~/.claude/projects -name <id>*` found nothing, and `getSessionMessages` returned 0 messages for both the symlinked and the real path.
I could not observe a successful resume after restart here. The Task 6 tests and test 6 above cover it, and the Task 10 E2E should confirm it outside the sandbox.

When the network was denied (first run), the status stayed `working` for the whole 90 s poll while the CLI retried. That is Task 6 and CLI behavior, noted only.

## Files changed

- Created: `src/server/agent/index.ts`, `src/server/agentRoutes.ts`, `test/server/agentRoutes.test.ts`
- Modified: `src/server/app.ts`, `src/server/index.ts`

## Self-review findings

- Interfaces match the brief, including routes, status codes, the `createApp(store, agent?)` signature, and the `createAgent` deps.
- The `onChange` closure references `session` before its `const` declaration. This is safe because the broker can only fire after a query exists, which comes after construction.
- The `onSessionId` writes are not serialized. Two session ids arriving back to back could interleave read-modify-write, but each write is atomic and both carry the newest `runs`.
  `// ponytail`-level risk only; serialize the writes if runs start changing concurrently in M2.
- `permission` events are broadcast but not stored in the session transcript. A reloaded tab gets pending asks from `state().pending`, which is what the panel should render from.
- While asks are pending, the status message is omitted (`needs_you` carries none).

## Concerns

1. Deliberate addition beyond the brief: `canUseTool` auto-allows tools whose `mcpServer` is `{ source: "sdk", name: "blueprint" }` and passes everything else to `broker.ask` exactly as specified.
   Without it, every `get_board` and `get_selection` call opens a permission dialog. That contradicts the Task 10 E2E expectation, where "Describe what I selected" shows a `reading the selection` row with no dialog.
   I first tried `allowedTools`, but the SDK emits a shadowing warning on every start.
   The check is keyed on `source` as the SDK docs recommend, so a configured MCP server named `blueprint` still asks, and the test covers that.
   If the controller wants the literal binding, revert the ternary in `src/server/agent/index.ts`.
2. The `/api/*` JSON 404 moved from `startServer` into `createApp`. This is needed for the brief's "404 JSON" test against `createApp`, and the behavior is unchanged at the server level.
3. A real resume after restart was not observable in this sandbox (session JSONL writes to `~/.claude/projects` are denied). See Manual observations.
