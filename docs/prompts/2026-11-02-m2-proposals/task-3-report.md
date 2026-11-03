# Task 3 report: the propose and revise tools

Status: DONE_WITH_CONCERNS (one file outside the brief's list was touched to keep typecheck green; see Concerns).

Commit: `163e0f3 feat(agent): propose and revise tools with a browser round trip`

## What I implemented

- `src/shared/messages.ts`: `ServerMessage` gains `{ type: "request"; id; kind: "proposal.apply"; proposal: Proposal; replace: boolean }`.
  `ws.ts` needed no change; `RequestBody` picks it up through the distributed `Omit`.
- `src/server/agent/tools.ts`: `createBoardTools({ store, hub, proposals })` registers `get_board`, `get_selection`, `propose`, `revise`.
  - `propose` (`Propose.shape`): requires `hub.activeBoard` (else `open a board in the browser first`), checks every `referencedIds(ops)` id against the non-deleted elements of the stored board (else `unknown element id <id>`), mints `proposals.newId()`, `title ?? null`, sends `proposal.apply` with `replace: false` and `timeoutMs: 30_000`, and only after the browser answers calls `proposals.proposed(p)`.
    Returns `{"proposalId":"p_..."}` as text.
  - `revise` (`Revise.shape`): requires an open board, then the pending record (else `NotFoundError("proposal <id> is not pending")`), then that the record's board is the open board (else `proposal <id> belongs to board <board>, which is not open`), then id validation, then `proposal.apply` with `replace: true`, then `proposals.revised(p)`.
    Keeps the record's `id`, `board`, `title`; takes the new `ops` and a fresh `at`.
  - A browser rejection propagates unchanged as the tool error; nothing is logged.
  - `get_board` and `get_selection` drop elements with `customData.ghost === "add"` before `excalidrawToBoardGraph`, and append `\n\nPending proposals: p_1 (2 ops), p_2 (1 op)` when anything is pending.
    In `get_board` the line goes on the Markdown before any `(No PNG: ...)` note; `get_selection` also appends it to `Nothing is selected on the board.`.
- `src/server/agent/events.ts`: `summarizeTool` gives `proposing N change(s)` and `revising <id>`.
- `src/server/agent/index.ts` (outside the brief's list): passes `proposals: new ProposalStore(store)` so the server compiles; it is not `load()`ed yet (marked with a `ponytail:` comment naming Task 4).
  The `canUseTool` comment, which said the board tools "only read", now says they read or draw ghosts the user must accept.

## TDD evidence

RED: `pnpm vitest run test/server/agent/tools.test.ts test/server/agent/events.test.ts`

```
   × summarizeTool names proposals
   × get_board returns markdown and the PNG from the browser, or a note when the browser fails
   × propose validates ids against the stored board and logs nothing on failure
   × propose rejects ids of deleted elements
   × propose round-trips to the browser, logs, and returns the proposal id
   × a browser failure becomes the tool error and leaves nothing pending
   × revise requires a pending proposal and replaces in place
   × revise refuses a proposal whose board is not the open one
   × revise keeps the pending record when the browser fails
   × propose without an open board fails fast
   × board reads hide add ghosts and list pending proposals
AssertionError: expected 'mcp__blueprint__propose' to be 'proposing 3 changes'
AssertionError: expected [ 'get_board', 'get_selection' ] to deeply equal [ 'get_board', 'get_selection', …(2) ]
TypeError: Cannot read properties of undefined (reading 'handler')   (x8, propose/revise not registered)
AssertionError: expected '# Board: ghosted\n\n## Other elements…' not to contain 'Cache'
      Tests  11 failed | 12 passed (23)
```

GREEN: `pnpm vitest run test/server/agent`

```
 Test Files  8 passed (8)
      Tests  62 passed (62)
```

`pnpm check`: both typechecks clean, Biome `Checked 85 files ... No fixes applied.`, Vitest `29 passed (29)` files, `156 passed (156)` tests, no stderr or warnings.
`pnpm build`: only the pre-existing chunk size warning.

## Manual verification

The brief names none.
The browser side of `proposal.apply` lands in Task 8, so an end-to-end check is not possible yet.

## Files changed

- `src/shared/messages.ts`
- `src/server/agent/tools.ts`
- `src/server/agent/events.ts`
- `src/server/agent/index.ts` (not in the brief; see Concerns)
- `test/server/agent/tools.test.ts`
- `test/server/agent/events.test.ts`

## Tests added beyond the brief's list

- `propose rejects ids of deleted elements` (the "non-deleted" clause).
- `revise refuses a proposal whose board is not the open one` (the Task 2 review ruling).
- `revise keeps the pending record when the browser fails`.
- `propose without an open board fails fast` also covers `revise`.
- The round-trip test checks `timeoutMs: 30_000` and that a missing title becomes `null`.
- The ghost test checks both tools and that no pending line appears when nothing is pending.

## Self-review findings

- The brief's sketch uses board `main`; the existing fixtures key boards as `flow`/`zeta`, so the tests use `flow` (and a new `ghosted` fixture) instead of adding a `main` board that would shift `get_board`'s default.
  Same assertion, different literal.
- `revise` looks up the pending record and checks its board before validating ids, because the record decides which board the ids must live on.
  The brief lists id validation as step 2 and the lookup as step 3; the only visible difference is which error wins when both apply.
- `checkIds` reads the board file a second time per call (the graph read is separate); harmless at this scale.
- Ids of add ghosts count as known for `near`/`update`/`delete`, since they are non-deleted elements in the stored file.
  If Claude targets another proposal's ghost, the browser (Task 8) decides what happens.
- The tests reach handlers via `_registeredTools`, per the pre-flight ruling; handlers are called directly, so the SDK's Zod validation of `Propose.shape`/`Revise.shape` is not exercised here.

## Concerns

- Making `proposals` a required dependency of `createBoardTools` breaks `src/server/agent/index.ts` until Task 4 wires it, and `pnpm check` must stay pristine at this commit.
  I added the smallest wiring there: `new ProposalStore(store)` without `load()`, so until Task 4 a restart forgets pending proposals.
  Task 4 should replace it with the loaded store it builds in `createAgent` (and handle a torn log per the Task 1 ruling).
