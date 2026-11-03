# Task 10 report: Milestone acceptance

Status: DONE_WITH_CONCERNS

Commits: none.
The run did not prove that any file must change, so per the brief and the dispatch nothing was edited or committed.

## What I implemented

Nothing.
This task is the end-to-end acceptance of milestone 2.
Step 1 (check and build) and Step 2 (the five acceptance steps with the real login) ran once each on one board.
Step 3 (commit fixes) did not apply.

## TDD evidence

No code changed, so there is no RED/GREEN pair.
Step 1 of the brief:

```
$ pnpm check
tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.server.json && biome check . && vitest run
Checked 94 files in 72ms. No fixes applied.
 Test Files  34 passed (34)
      Tests  203 passed (203)

$ pnpm build 2>&1 | grep -iE 'warn|\(!\)|error'
(!) Some chunks are larger than 500 kB after minification. Consider:
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

Pristine apart from the pre-existing chunk-size warning.

## Setup

- Scratch repository: `$TMPDIR/bp-t10` (`git init`, one commit with a README).
- Server: `node dist/cli/index.js --no-open --port 4317` from the scratch repository, run outside the sandbox so the SDK can reach the login.
- Browser: the Playwright MCP tools could not start (`Browser is already in use for .../mcp-chrome-e220b27`); another session's Chrome, started at 19:53, holds that profile, and I did not kill it.
  I used gstack browse instead (headless Chromium at 1440x900, run from the scratch repository so `.gstack/` landed there and not in this repository).
- Drawing: gstack has no drag command, so I drew with synthetic `PointerEvent`s on `canvas.interactive`, spaced 40 to 50 ms apart (Excalidraw applies moves per animation frame; a synchronous burst made a zero-size rectangle, which I then deleted).
- Board `main`: box `API` (`4sRW-kfg…`, x 160, y 300, 160x80), box `Database` (`M3Do3gun…`, x 520), and a bound arrow `SUQqmnJQ…` from API to Database.
- Ghost timing: a `MutationObserver` recorded `performance.now()` when `.proposals-bar` first appeared, and a capture-phase `keydown` listener recorded the Enter on the composer.

## Timings: send to first ghost

| Step | Request | First ghost after send |
|---|---|---|
| 1 | Add a cache between these two | 11.7 s (cold session: Claude loaded tools with ToolSearch and called get_board first) |
| 2 | Draw the login flow as a flowchart | 4.8 s |
| 3 | Rename this to Dashboard and make it green | 1.8 s |
| 3 | Refine: keep the old color | about 3.1 s from Enter to the `revised` log line (shell clock) |
| 5 | Add a note saying Rate limiting TODO (to set up the pending proposal) | 4.9 s |

## Manual observations

### Acceptance step 1: "Add a cache between these two", all three selected

- The chip read `3 selected: API, Database, arrow`.
  The message Claude received began with `[Selection on board "main": 4sRW-kfg_6MtZDz5bxO7S box "API"; M3Do3gunb_Aa6HnVRPVHe box "Database"; SUQqmnJQ7uJtapPvxAOQa arrow "" (4sRW-kfg_6MtZDz5bxO7S→M3Do3gunb_Aa6HnVRPVHe)]`.
- Panel rows: `ToolSearch`, `(non-text result)`, `reading the board`, the board Markdown, `proposing 4 changes`, `{"proposalId":"p_8a5ccb7d"}`.
- **The arrow id fix from Task 8b works.** Claude found the arrow's id, and the arrow turned red dashed (`#e03131`, dashed, opacity 40).
- **The boxes did not stay.** Claude proposed `delete` on the arrow and on both boxes, plus an `add_diagram` of API → Cache → Database with `near: [API]`.
  Its text explained why: "Blueprint can't add a single box or reconnect arrows to boxes that are already there. So the proposal removes the current API, Database and arrow and redraws all three with the Cache in the middle."
  That is accurate: no op connects a new shape to an existing one, so Claude cannot insert a box between two existing boxes without redrawing them.
  This is a capability gap in the op set, not a bug the brief's files can fix (see Concerns).
  The brief says counts are "as Claude chose", and the bar read `Claude proposed Insert Cache between API and Database · 5 added, 3 removed`.
- Ghost styling matched the constraints:
  - The three deletes were dashed, opacity 40, `#e03131`.
    The bound labels went to opacity 40.
  - The additions were dashed, opacity 40, `groupIds: ["p_8a5ccb7d"]`, not locked.
  - Every ghost carried `customData.origin: "ai"`, `proposalId`, `ghost` and `before`.
- Placement followed the rule for the anchor Claude chose: the diagram started at x 400 (API's right edge 320 + 80), top-aligned at y 300.
  Because the anchor was API only, the new diagram sat over the Database box that was being deleted until a decision.
- **Reject** restored all five originals to solid `#1e1e1e`, opacity 100, `customData` null.
  The added ghosts were removed and the bar disappeared.
- `proposals.jsonl`: `proposed` then `rejected`.

### Acceptance step 2: "Draw the login flow as a flowchart", nothing selected

- There was no chip, and `proposing 1 change` appeared.
- Claude chose `near: [Database]`, which is the rightmost content.
  The diagram's bounding box started at x 760 (Database's right edge 680 + 80) and y 300, so it was right of all content and top-aligned.
- The bar read `Claude proposed Login flow · 23 added` (40 elements; the count is shapes only, as ruled in Task 5).
- **Accept**: all 40 elements became solid, opacity 100, `groupIds: ["p_4b5c6d63"]`, `customData {origin: "ai", proposalId: "p_4b5c6d63"}` in the board file.
  The log got an `accepted` line and the bar disappeared.
- The acceptance note is confirmed in the SDK transcript (`~/.claude/projects/-private-tmp-claude-501-bp-t10/<session>.jsonl`): the next user message was `[Proposal p_4b5c6d63 "Login flow" was accepted.]` followed by the selection header and the text.
  The step 2 message itself began with `[Proposal p_8a5ccb7d "Insert Cache between API and Database" was rejected.]`.

### Acceptance step 3: "Rename this to Dashboard and make it green", API selected

- The chip read `1 selected: API`.
- The proposal was one `update` with `label: "Dashboard"`, `strokeColor: "#2f9e44"`, `backgroundColor: "#b2f2bb"`.
- The box became dashed and green, the label read Dashboard, and the bar read `Claude proposed Rename API to Dashboard, green · 1 changed`.
- **Refine**: the chip read `Refining p_93c9be0f · Rename API to Dashboard, green ×`, and the textarea had focus.
  I typed `keep the old color` and pressed Enter.
- Panel rows: `ToolSearch`, `(non-text result)`, `revising p_93c9be0f`, `{"proposalId":"p_93c9be0f"}`.
- The log got a `revised` line with ops `[{op: "update", label: "Dashboard"}]`.
  The ghost was replaced in place: dashed, `#1e1e1e`, transparent, label Dashboard.
  There was one bar and one pending proposal (`GET /api/agent/proposals` returned only `p_93c9be0f`).
- The bar title stayed `Rename API to Dashboard, green`, because `revise` takes no title (as designed), so the title no longer describes the proposal.
- **Accept**: the box became solid with its original colors and `customData {origin: "ai", proposalId}`.
  The log got `accepted`, and the refine chip was cleared.

### Acceptance step 4: a pie chart

- I asked `Draw a pie chart of browser market share` with nothing selected.
- **Claude never called `propose`.**
  It answered in text that only flowchart, sequence, class, ER and state diagrams import as shapes, and it offered a note or a doc instead.
  There was no `proposing` row, no failed row, and no line in `proposals.jsonl`.
- So the brief's expected "failed `proposing` row with the supported-kinds message" was not exercised end to end.
  The system prompt names the five kinds, so Claude refuses before trying.
  This is the better outcome for the user, and I did not repeat the step (one run per step).
  The importer's rejection message is covered by `test/ui/mermaid.test.ts:44` (`renderMermaid('pie …')` rejects with the five-kinds message).

### Acceptance step 5: restart with a proposal pending

- To make a pending proposal, I asked `Add a note saying Rate limiting TODO`.
  Claude anchored it on the "Too many attempts?" diamond, and the bar read `Claude proposed Rate limiting TODO note · 1 added`.
- I stopped the server, started it again from the scratch repository, and reloaded the page.
  `GET /api/agent/proposals` returned `p_24886708` (reloaded from the log).
  The bar reappeared with its title, and the transcript was restored in the panel.
- **Accept**: the log got `accepted`, and the note became solid with `customData {origin: "ai", proposalId}`.
  The pending set was empty and the bar disappeared.
- Browser console: only three `ERR_CONNECTION_REFUSED` WebSocket errors while the server was down; no app errors.
- Server log for both runs: only `Blueprint running at http://localhost:4317`.

### Other things seen on screen

- On a cold session, each turn shows `ToolSearch` and `(non-text result)` rows before the real work, because the SDK defers MCP tools.
  The rows are noise for the user, and the lookup adds latency to the first send (step 1's 11.7 s).
- The Mermaid importer routed the `Show error → Submit email + password` edge around the right side and through the `Redirect to app` box.
  Claude pointed this out itself in step 5's reply.
  That is upstream layout (`@excalidraw/mermaid-to-excalidraw`), not Blueprint code.
- When an update or delete ghost stays selected, Excalidraw's properties panel covers the left part of the canvas, including the ghost.
  This is stock Excalidraw behavior.

## Files changed

None in the repository.
The browse tool's `.gstack/` went into the scratch repository, and `git status` here is clean.
Both servers I started and the gstack browse server are stopped.

## Self-review findings

- Every step ran once on one board (`main`), and one extra turn set up step 5's pending proposal, as the brief requires.
- Each expectation was checked against the board file and `proposals.jsonl`, not only against the screen.
- Steps 2, 3 and 5 match the brief exactly.
- Step 1 matches on styling, placement rule, Reject and logging, but not on "boxes stay" (Claude's choice, forced by the op set).
- Step 4's failure row was not reached because Claude declined first.
- I made no fix: neither deviation is a defect in the files this plan owns, and a change to the system prompt or the op set would be a design decision, not a fix the run proves.

## Concerns

1. **No op connects to existing shapes.**
   "Insert X between A and B" forces Claude to delete and redraw A and B, which loses their styling and position, and Claude warns the user about this.
   The arrow-id fix works, but the expected "only the arrow is removed" outcome needs a new capability, for example `add_diagram` nodes that reuse existing ids, or an `add_arrow {from, to}` op.
   This is a candidate for a later milestone.
2. **Step 4's failure path has no end-to-end check.**
   Claude does not try an unsupported diagram, because the prompt tells it not to.
   The browser-side rejection and its tool error only have unit coverage.
3. **`revise` keeps the original title.**
   After "keep the old color", the bar still says "…, green".
   An optional `title` on `revise` would fix this.
4. **Cold-session ToolSearch rows.**
   `ToolSearch` and `(non-text result)` rows appear in the panel, and the lookup adds a few seconds to the first ghost.
   Hiding the SDK's ToolSearch rows, or loading Blueprint's MCP tools up front, would help.
5. **Playwright MCP was unavailable** because another session holds its profile, so the run used gstack browse with synthetic pointer events.
