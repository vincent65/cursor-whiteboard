# Task 5 report: Permission broker and SDK event mapping

Status: DONE

Commit: `cc0a5e6 feat(agent): permission broker and SDK event mapping`

## What I implemented

- `src/shared/panel.ts`: added `PermissionDecision` and `PendingPermission` beside the `PanelEvent` union, with the shapes the brief gives.
- `src/server/agent/events.ts`:
  - `summarizeTool` implements the summary table exactly (Bash command sliced to 60 characters).
  - `SdkEventMapper.map(msg)` and the `sessionId` getter.
  - `system` init records `session_id` and emits nothing.
  - `stream_event`: `message_start` records the message id and resets the per-block state. `content_block_start` resets the text for that index. A `text_delta` adds to the text for its index and emits `assistant_text` with partial true and id `<messageId>:<index>`.
  - `assistant`: emits `assistant_text` with partial false for each text block and `tool_use` for each tool block. The `tool_use` id is the block id and its summary comes from `summarizeTool`. After the message, the mapper clears the per-block state, as the resolutions specify.
  - `user`: emits `tool_result` for each tool_result block. Its id is `<tool_use_id>:result`, `toolUseId` is the tool_use id, and `ok` is `!is_error`. The summary is the text content (array text parts joined with `\n`), cut to 120 characters. A block with no text content gets `(non-text result)`.
  - `result`: a success result emits `result` with `subtype`, `costUsd = total_cost_usd`, and `durationMs = duration_ms`. An error subtype emits `error` with `errors.join("\n")`. Both use the message `uuid` as the id.
  - Every event's `at` is `new Date().toISOString()` taken when the message is mapped.
- `src/server/agent/broker.ts`: `PermissionBroker`.
  - Each pending entry's id is the `toolUseID`, and its `summary` comes from `summarizeTool`.
  - `onChange(pending())` fires whenever the pending list changes.
  - `allow` resolves to `{ behavior: "allow" }`.
  - `always` resolves to `{ behavior: "allow", updatedPermissions: suggestions ?? [] }`.
  - `deny` resolves to `{ behavior: "deny", message }` and falls back to the brief's default message.
  - An abort resolves deny with `interrupted` and removes the entry. A signal that is already aborted resolves at once and never becomes pending.
  - `cancelAll(reason)` resolves every open ask as deny with `reason` and fires `onChange([])` once.
  - `answer` returns false for an unknown id or an id that was already answered.
  - The abort listener is removed when an ask settles.
- Both files are pure (no I/O) and import the SDK types with `import type`.

### Design decision: shared id for streamed and final text

Task 9's reducer replaces a partial `assistant_text` with the item that has the same id, and the final text wins.
For that to work, a block's final `assistant_text` must reuse the id its partials used.
With partial messages on, the SDK sends each finished content block as its own `assistant` message, and that message's `content` holds only that one block.
Because of this, the block's position in `content` is not its stream index.
To handle it, the mapper keeps an ordered list of streamed text block ids that have not been finalized yet.
Each text block in a full `assistant` message takes the next id from that list.
When nothing was streamed, the id is `<message.id>:<position>`.
The tests cover both paths.

## TDD evidence

RED (`pnpm vitest run test/server/agent`, before any implementation):

```
 FAIL  test/server/agent/events.test.ts [ test/server/agent/events.test.ts ]
Error: Cannot find module '../../../src/server/agent/events.js' imported from .../test/server/agent/events.test.ts
 Test Files  2 failed (2)
      Tests  no tests
```

(broker.test.ts failed the same way: module not found.)

GREEN (`pnpm vitest run test/server/agent`):

```
 Test Files  2 passed (2)
      Tests  7 passed (7)
```

`pnpm check` (tsc for both configs, biome, full vitest) before the commit:

```
Checked 61 files in 26ms. No fixes applied.
 Test Files  18 passed (18)
      Tests  83 passed (83)
```

The first `pnpm check` run reported biome formatting errors in the new files only, and typecheck passed.
I fixed them with `biome check --write` on the task's paths.
The second run was clean.

## Tests

- broker: allow, deny with the default message, always with suggestions, and always without suggestions (`[]`).
- broker: pending order and contents with fixed timestamps, `onChange` payloads, unknown-id answer, double answer, deny with a custom message, and `cancelAll` with a reason.
- broker: abort mid-ask, an answer after the abort returns false, and a signal that was already aborted.
- events: one `summarizeTool` assertion per table row, plus the fallback row.
- events: a scripted stream of init, streamed deltas accumulating, the final text sharing the stream id, a per-block tool_use message, tool_results (joined text cut to 120 characters, an error result, a non-text result), and a success result.
- events: an assistant message without streaming gets per-position ids (an extra test beyond the brief's list).
- events: an error result gives one error event with the messages joined.

## Manual verification

The brief names none.
Both units are pure and have no runtime entry point until Tasks 6 and 8 wire them in.

## Files changed

- `src/shared/panel.ts` (modified)
- `src/server/agent/broker.ts` (new)
- `src/server/agent/events.ts` (new)
- `test/server/agent/broker.test.ts` (new)
- `test/server/agent/events.test.ts` (new)

## Self-review findings

- The interfaces match the brief's contracts exactly: constructor options, `ask`/`answer`/`pending`/`cancelAll`, `map`, and the `sessionId` getter.
- `summarizeTool` interpolates a missing `file_path`, `pattern`, or `command` as `undefined`, for example `reading undefined`. This happens only when the SDK sends a malformed input, and the table defines no fallback, so I left it.
- Stream events from subagents (`parent_tool_use_id` set) go through the same accumulation state. The SDK does not normally stream subagent partials, and the brief does not ask for filtering. Task 6 can filter if it becomes an issue.
- `costUsd` is always a number, because the SDK always provides `total_cost_usd`. The type allows `null`, but the mapper never produces it.
- A success result with `is_error: true` (an API error that ends the turn) still emits `result`, because the brief keys the mapping on the subtype. Task 6 or 9 may want to show such a result as an error.

## Concerns

None that block the task.
Task 6 should note one point: the mapper always clears its stream state when a full `assistant` message arrives.
If the SDK ever sent a text block's `assistant` message after the next block had started streaming, that next block's partial id would be lost.
In that case the final text for that block would fall back to `<message.id>:<position>`.
The SDK's documented ordering (each block's message comes after that block's `content_block_stop`) rules this out.
