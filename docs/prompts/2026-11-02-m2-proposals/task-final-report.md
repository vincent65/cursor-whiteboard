# Milestone 2 final-review fix report

Branch `m2-proposals`, from `9dac292` to `dceb14a`.
All ten findings in final-findings.md are fixed as ruled, with one commit per finding.
Nothing from the deferred list was touched.
No Claude session was started.
The verification is the unit tests, `pnpm check`, and `pnpm build`.

## Commits

| Finding | Commit | Subject |
|---|---|---|
| 1 | 5a92a2e | fix(export): board reads leave out add ghosts and show update ghosts as before |
| 3 | 79fafab | fix(ui): disable a proposal's buttons while its decision is in flight |
| 2 | c28fd2a | fix(ui): reject a proposal whose ghosts were removed by hand |
| 6 | 2fc8685 | fix(ui): clear the refine target only if it still names the one sent or decided |
| 8 | 882150d | fix(ui): accepting a delete unbinds the live arrows that end on it |
| 4 | 8a6e7d7 | test(ui): pin the applyProposal to restoreElements seam |
| 7 | 33e3069 | fix(ui): an empty files object from the Mermaid importer is not an image |
| 9 | a7c678d | fix(agent): the refine note carries the proposal's current ops |
| 10 | 680a296 | refactor(export): rename the loop-local arrow string to link |
| 5 | dceb14a | fix(agent): decision notes on a send that never runs ride on the next one |

No commit has a co-author or generated-with trailer.

## 1. Board reads show update ghosts as fact

Changed:
- `src/export/boardGraph.ts`: `excalidrawToBoardGraph` now normalizes pending proposals.
  Elements tagged `ghost: "add"` are dropped, and so is any text whose `containerId` is an add ghost.
  Elements tagged `ghost: "update"` with a string `before.label` use that label (trimmed) as the node or edge label.
  Delete ghosts stay.
- `src/server/agent/tools.ts`: `withoutAddGhosts` is removed.
  The board reads now get the normalized graph from the export module.
  `checkIds` filters `ghost !== "add"` inline, so ops still cannot reference add ghosts.
  The `PUT /boards/:name` export route and the selection header in `createAgent` get the same normalization from the export module.

Tests (red first: the two new tests failed before the change):
- `test/export/boardGraph.test.ts`: "add ghosts and their labels are not on the board yet", "update ghosts read with their labels from before the proposal" (bound text, own text, and arrow label; an update with no `before.label` keeps its current label), and "delete ghosts stay on the board until accepted".
- The existing `test/server/agent/tools.test.ts` tests "board reads hide add ghosts…" and "propose treats add ghosts as unknown ids…" still pass.
- The goldens are unchanged (`git diff 9dac292 --stat -- test/export/fixtures` is empty).

## 2. A pending proposal is orphaned when its ghosts are removed by hand

Changed:
- `src/ui/board/ghosts.ts`: a new pure function `droppedProposals(prev, next)` returns the ids in `prev` that are not in `next`.
- `src/ui/board/BoardView.tsx`:
  - `onChange` keeps the last pending list in the `seen` ref.
    For each dropped id that has no decision in flight, it calls `reconcileDrop(id)`.
  - `reconcileDrop` waits 1 s.
    It then re-reads the scene's ghosts, and if the id is still absent and still not being decided, it posts `rejected`.
  - The server call and its 404 tolerance are factored into `tellServer`, which `decide` shares.
  - `decide` removes its own id from `seen` just before its local scene update, so a decision's own removal is never treated as a drop.
  - The timers are cleared on unmount.
    A ref mirrors the `deciding` state so that a timer sees the current set.

Tests (red first: `droppedProposals is not a function`):
- `test/ui/ghosts.test.ts`: "droppedProposals lists ids the previous pending list had and the next one lacks".

## 3. No in-flight guard on Accept and Reject

Changed:
- `src/ui/board/ProposalsBar.tsx`: items gain `busy: boolean`, and a busy row's Accept, Reject, and Refine buttons are `disabled`.
- `src/ui/board/BoardView.tsx`: a `deciding` state set.
  `decide` adds the id before the request and removes it in `finally` when the request settles.
  The bar gets `busy: deciding.has(p.id)`.

Tests (red first):
- `test/ui/ProposalsBar.test.tsx`: "a row whose decision is in flight disables its buttons".
  The existing items gained `busy: false`.

## 4. The applyProposal to restoreElements seam has no persistent test

Changed:
- A new file, `test/ui/restoreSeam.test.ts` (jsdom, with the same canvas and FontFace stubs as `mermaid.test.ts`).
  It runs the `between` fixture (boxes a and b joined by arrow ab; delete ab, add_node Cache, an arrow a to $1, and an arrow $1 to b labelled "reads").
  The Cache node comes from the real `renderNode`.
  The test runs the result through `applyProposal`, `listBoundArrows`, and the real `restoreElements(…, { refreshDimensions: true, repairBindings: true })`.
  It asserts that the "reads" label survives as text bound to its arrow, that both new arrows keep their start and end bindings, and that a, b, and the new node list the arrows in `boundElements`.

Tests:
- The test passes against the current code.
  This is expected, because it is a regression guard for bugs that are already fixed.
- To confirm that it bites, I reverted each earlier fix temporarily and restored it afterwards:
  - With `listBoundArrows` removed from the call, it fails: `expected [ 'ab' ] to include '<new arrow id>'`.
  - With the arrow label's `height: LABEL_LINE` set to `0` in ghosts.ts, it fails: `expected undefined to match object { text: 'reads' }`.

## 5. Decision notes are lost when their send never runs

Changed:
- `src/server/agent/session.ts`:
  - `SessionDeps` gains optional `onNotSent(sendId: string)`.
  - Held sends are now `{ id, text }`, and the `InputQueue` keeps each queued message's send id.
    `drain()` and `#stopRun()` return the dropped ids, oldest first.
  - `#notSent(ids, message)` emits the existing "Message not sent" error for each id and calls `onNotSent(id)`.
    This covers Stop on held sends, Stop while the CLI is still starting, and a run that ends with sends held or queued.
- `src/server/agent/proposals.ts`: a new `requeueNotes(notes)`.
  Requeued notes go into a separate list, and `takeNotes()` returns them before the fresh notes.
  Every requeued note was taken at or before the last take, so it is older than any fresh note.
  The order therefore stays chronological across several drops.
- `src/server/agent/index.ts` (`createAgent`):
  - A `riding` map stores send id to the decision notes taken for that send.
    Every send gets an entry, including an empty one, so that the entries line up with results.
  - Each `result` event retires the oldest entry (one result per send, in send order).
    `onNotSent` re-queues and deletes the entry for its id.
  - If `session.send` throws synchronously, the notes are re-queued and the error is re-thrown.
  - The refine note is not re-queued.
    It belongs to the refine request, not to the decision log.
  - Of the ruling's two retirement options ("until its turn's result arrives (or until the next send succeeds)"), I implemented the first.
    Retiring on "next send succeeds" would lose the notes of a send that is still held when Stop drops it.
  - A turn that is cut off with no result leaves its entry until the next result, so from then on entries retire one turn late.
    This is harmless, because notes are only handed back for ids the session reports as dropped.
    It is marked with a `ponytail:` comment.

Tests (red first: three session tests, two agent tests, and one store test failed):
- `test/server/agent/session.test.ts`: the three existing drop tests now also assert that `onNotSent` receives the exact user-event ids returned by `send`, oldest first:
  - "messages still queued when a run throws…"
  - "interrupt drops the messages still queued…"
  - "interrupt while the CLI is still starting…" (a queued message the SDK never took)
- `test/server/agentRoutes.test.ts`, using a new `stallingSdk` whose first turn waits for the interrupt:
  - "decision notes on a send that Stop drops ride on the next send instead".
    The first send stalls, then p_1 is accepted, then "second" is held and dropped by Stop, then p_2 is rejected.
    "third" carries both notes in order.
  - "decision notes on a send the session throws on ride on the next send": the fake `query` throws once ("spawn failed").
    `echoSdk` now also returns its `query` mock.
- `test/server/agent/proposals.test.ts`: "requeued notes come back before newer ones, in the order they were requeued".

## 6. Stale target closures after an await

Changed:
- `src/ui/panel/refine.tsx`: `setTarget` is now typed `Dispatch<SetStateAction<RefineTarget | null>>`, so it accepts an updater.
  The underlying `useState` setter already supported updaters.
- `src/ui/board/BoardView.tsx` (`decide`) uses `setTarget((t) => (t?.id === id ? null : t))`.
  `target` is no longer read there.
- `src/ui/panel/ClaudePanel.tsx` (`send`) captures `refining = target?.id` before the await and clears with `setTarget((t) => (t?.id === refining ? null : t))`.

Tests (red first, as a typecheck error: TS2345, an updater was not assignable to `RefineTarget`):
- `test/ui/refine.test.tsx`: "setTarget takes an updater, so a late clear leaves a newer target alone".
- The existing `ClaudePanel.test.tsx` refine chip tests still pass.

## 7. renderMermaid treats an empty files object as unsupported

Changed:
- `src/ui/board/mermaid.ts`: the check is now `Object.keys(files ?? {}).length > 0 || elements.some(image)`.

Tests (red first: the test threw the SUPPORTED error):
- `test/ui/mermaid.test.ts`: "an empty files object is not an image diagram".
  The file now wraps the real `parseMermaidToExcalidraw` in `vi.fn` through `vi.mock`, so one call can return `files: {}`.
  All other tests still use the real importer.

## 8. Accepting a delete leaves live arrows bound to a soft-deleted element

Changed:
- `src/ui/board/ghosts.ts` (`decideProposal`, accept branch for a `delete` ghost): after soft-deleting the element and its label, every live arrow whose `startBinding` or `endBinding` points at it gets only that binding set to `null`.
  Nothing else on the arrow changes, and deleted arrows are left alone.

Tests (red first):
- `test/ui/ghosts.test.ts`: "accepting a delete unbinds the live arrows that end on it".
  It covers an arrow ending on the element, an arrow starting on it, an already-deleted arrow (unchanged by identity), and a reject (the binding is kept).

## 9. The refine note gives Claude nothing to start from

Changed:
- `src/server/agent/index.ts`: `send` looks up the pending record once, and the refine note now ends with ` Its current ops are: <JSON.stringify(p.ops)>`.

Tests (red first):
- `test/server/agentRoutes.test.ts`: the expectation in "createAgent prefixes decision notes and refine requests to the next message" was updated.

## 10. The loop-local `arrow` shadows the `arrow` helper

Changed:
- `src/export/markdown.ts`: the loop-local string is renamed to `link`.

Tests:
- `test/export/markdown.test.ts` passes, including the unchanged `basic.md` golden.

## Per-finding test runs

The commands below map to findings as follows:
- 1: boardGraph and tools
- 3: ProposalsBar
- 2: droppedProposals
- 4: restoreSeam
- 5: session, proposals, and agentRoutes, filtered to the notes and not-sent tests
- 6: refine and ClaudePanel
- 7: mermaid
- 8: ghosts, filtered to unbinds
- 10: markdown

Finding 9's test is "createAgent prefixes decision notes…" inside the finding 5 run.

```
$ pnpm vitest run test/export/boardGraph.test.ts test/server/agent/tools.test.ts
 ✓ test/export/boardGraph.test.ts > rectangle with bound text becomes a box node with the text as label
 ✓ test/export/boardGraph.test.ts > text with a live containerId labels the container even without boundElements
 ✓ test/export/boardGraph.test.ts > text listed in boundElements but with no containerId stays a standalone node
 ✓ test/export/boardGraph.test.ts > a stale boundElements entry does not borrow another container's text
 ✓ test/export/boardGraph.test.ts > text whose container is deleted or missing stays a standalone node
 ✓ test/export/boardGraph.test.ts > arrow bound at both ends becomes an edge with label and arrowheads
 ✓ test/export/boardGraph.test.ts > arrow bound to a deleted or missing element has a free end
 ✓ test/export/boardGraph.test.ts > deleted elements are skipped entirely
 ✓ test/export/boardGraph.test.ts > frames become frame nodes and children carry frameId
 ✓ test/export/boardGraph.test.ts > unbound text, images, freedraw and line are classified
 ✓ test/export/boardGraph.test.ts > customData origin ai is carried through
 ✓ test/export/boardGraph.test.ts > node order follows element order
 ✓ test/export/boardGraph.test.ts > add ghosts and their labels are not on the board yet
 ✓ test/export/boardGraph.test.ts > update ghosts read with their labels from before the proposal
 ✓ test/export/boardGraph.test.ts > delete ghosts stay on the board until accepted
 ✓ test/server/agent/tools.test.ts > get_board returns markdown and the PNG from the browser, or a note when the browser fails
 ✓ test/server/agent/tools.test.ts > get_board asks for a PNG only when the board is the one open in the tab
 ✓ test/server/agent/tools.test.ts > get_board fails clearly when there are no boards or the board is unknown
 ✓ test/server/agent/tools.test.ts > get_board notes a malformed PNG data URL instead of sending a broken image
 ✓ test/server/agent/tools.test.ts > get_selection returns nothing-selected text, or the filtered graph markdown with the crop
 ✓ test/server/agent/tools.test.ts > get_selection answers nothing-selected without asking the browser when no board is open
 ✓ test/server/agent/tools.test.ts > propose validates ids against the stored board and logs nothing on failure
 ✓ test/server/agent/tools.test.ts > propose treats add ghosts as unknown ids, as the board reads do
 ✓ test/server/agent/tools.test.ts > a revise in flight holds off decisions on its proposal, and releases them on failure too
 ✓ test/server/agent/tools.test.ts > revise holds off decisions from before it reads the board for id checks
 ✓ test/server/agent/tools.test.ts > propose rejects ids of deleted elements
 ✓ test/server/agent/tools.test.ts > propose round-trips to the browser, logs, and returns the proposal id
 ✓ test/server/agent/tools.test.ts > a browser failure becomes the tool error and leaves nothing pending
 ✓ test/server/agent/tools.test.ts > revise requires a pending proposal and replaces in place
 ✓ test/server/agent/tools.test.ts > revise refuses a proposal whose board is not the open one
 ✓ test/server/agent/tools.test.ts > revise keeps the pending record when the browser fails
 ✓ test/server/agent/tools.test.ts > propose without an open board fails fast
 ✓ test/server/agent/tools.test.ts > board reads hide add ghosts and list pending proposals
 ✓ test/server/agent/tools.test.ts > selectionGraph keeps only selected nodes, edges between them, and selected loose items
 ✓ test/server/agent/tools.test.ts > revise can retitle, and keeps the title when none is given
 ✓ test/server/agent/tools.test.ts > propose and revise refuse a bad $ reference before checking ids or drawing
 Test Files  2 passed (2)
      Tests  36 passed (36)

$ pnpm vitest run test/ui/ProposalsBar.test.tsx
 ✓ test/ui/ProposalsBar.test.tsx > renders a row per proposal with counts and wires the buttons
 ✓ test/ui/ProposalsBar.test.tsx > a row whose decision is in flight disables its buttons
 ✓ test/ui/ProposalsBar.test.tsx > renders nothing without proposals
 Test Files  1 passed (1)
      Tests  3 passed (3)

$ pnpm vitest run test/ui/ghosts.test.ts test/ui/BoardView.test.tsx -t droppedProposals
 ✓ test/ui/ghosts.test.ts > droppedProposals lists ids the previous pending list had and the next one lacks
 Test Files  1 passed (1)
      Tests  1 passed | 29 skipped (30)

$ pnpm vitest run test/ui/restoreSeam.test.ts
 ✓ test/ui/restoreSeam.test.ts > a between proposal survives the real restore with its label and bindings
 Test Files  1 passed (1)
      Tests  1 passed (1)

$ pnpm vitest run test/server/agent/session.test.ts test/server/agent/proposals.test.ts test/server/agentRoutes.test.ts -t not sent|still starting|requeued|decision notes|prefixes
 ✓ test/server/agent/proposals.test.ts > requeued notes come back before newer ones, in the order they were requeued
 ✓ test/server/agent/session.test.ts > messages still queued when a run throws are each reported as not sent
 ✓ test/server/agent/session.test.ts > interrupt drops the messages still queued, so the SDK never gets them, and reports each as not sent
 ✓ test/server/agent/session.test.ts > interrupt while the CLI is still starting closes the run instead of interrupting it
 ✓ test/server/agentRoutes.test.ts > createAgent prefixes decision notes and refine requests to the next message
 ✓ test/server/agentRoutes.test.ts > decision notes on a send that Stop drops ride on the next send instead
 ✓ test/server/agentRoutes.test.ts > decision notes on a send the session throws on ride on the next send
 Test Files  3 passed (3)
      Tests  7 passed | 36 skipped (43)

$ pnpm vitest run test/ui/refine.test.tsx test/ui/ClaudePanel.test.tsx
 ✓ test/ui/refine.test.tsx > useRefine starts null and setTarget updates consumers
 ✓ test/ui/refine.test.tsx > setTarget takes an updater, so a late clear leaves a newer target alone
 ✓ test/ui/ClaudePanel.test.tsx > panel renders restored transcript, sends on Enter with the current selection, shows Stop while working
 ✓ test/ui/ClaudePanel.test.tsx > a pending permission renders the dialog and Allow always calls agentPermission with behavior always
 ✓ test/ui/ClaudePanel.test.tsx > a permission ask keeps a transcript that was at the bottom pinned there
 ✓ test/ui/ClaudePanel.test.tsx > an error status shows the message
 ✓ test/ui/ClaudePanel.test.tsx > a refine target shows a chip, sends the proposal id, and clears
 ✓ test/ui/ClaudePanel.test.tsx > the chip's × clears the target without sending
 ✓ test/ui/ClaudePanel.test.tsx > selection labels come from bound text, own text, then the element type
 Test Files  2 passed (2)
      Tests  9 passed (9)

$ pnpm vitest run test/ui/mermaid.test.ts
 ✓ test/ui/mermaid.test.ts > a flowchart becomes shapes, labels, and bound arrows with fresh ids
 ✓ test/ui/mermaid.test.ts > a parse error propagates with the importer's message
 ✓ test/ui/mermaid.test.ts > a diagram the importer draws as an image is rejected
 ✓ test/ui/mermaid.test.ts > an empty files object is not an image diagram
 ✓ test/ui/mermaid.test.ts > a note is one measured text element
 ✓ test/ui/mermaid.test.ts > renderNode makes a shape with a bound label
 Test Files  1 passed (1)
      Tests  6 passed (6)

$ pnpm vitest run test/ui/ghosts.test.ts -t unbinds
 ✓ test/ui/ghosts.test.ts > accepting a delete unbinds the live arrows that end on it
 Test Files  1 passed (1)
      Tests  1 passed | 29 skipped (30)

$ pnpm vitest run test/export/markdown.test.ts
 ✓ test/export/markdown.test.ts > golden: basic board renders exactly
 ✓ test/export/markdown.test.ts > connected arrows are listed with their ids after the diagram
 ✓ test/export/markdown.test.ts > labels are escaped for Mermaid
 ✓ test/export/markdown.test.ts > both arrowheads render <-->, none renders ---, start-only is reversed
 ✓ test/export/markdown.test.ts > a frame with no connected children is not a subgraph; its nodes list under Other elements with (in <frame>)
 ✓ test/export/markdown.test.ts > diamond renders n{"label"}
 ✓ test/export/markdown.test.ts > a board with no edges has no Diagram section and no ids comment
 Test Files  1 passed (1)
      Tests  7 passed (7)

```

## Final `pnpm check`

The command exited with code 0.

```
> blueprint@ check /Users/vincentyip/programming/cursor-whiteboard
> tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.server.json && biome check . && vitest run
Checked 96 files in 66ms. No fixes applied.
 RUN  v5.0.5 /Users/vincentyip/programming/cursor-whiteboard
 Test Files  35 passed (35)
      Tests  234 passed (234)
   Start at  20:55:57
   Duration  4.89s (tests 32%, environment 28%, setup 18%, import 15%, transform 5%, worker 1%)
    Isolate  35 workers spawned · ~343ms startup each (spawn + environment, per file)
             at least ~992ms faster with isolate: false — reuses workers across files instead of one per file
```

## Final `pnpm build`

The command exited with code 0.
The chunk-size warning is Vite's standard notice for the Excalidraw and Mermaid bundles.
It is not from this change, and it was left alone per the rules.

```
> blueprint@ build /Users/vincentyip/programming/cursor-whiteboard
> tsc -p tsconfig.server.json && node scripts/copy-excalidraw-assets.mjs && vite build
vite v8.3.5 building client environment for production...
transforming...
✓ 2456 modules transformed.
rendering chunks...
computing gzip size...
dist/ui/index.html                                           0.74 kB │ gzip:   0.44 kB
dist/ui/assets/Assistant-SemiBold-SCI4bEL9.woff2            20.21 kB
dist/ui/assets/Assistant-Regular-DVxZuzxb.woff2             20.23 kB
dist/ui/assets/Assistant-Medium-DrcxCXg3.woff2              20.32 kB
dist/ui/assets/Assistant-Bold-gm-uSS1B.woff2                20.38 kB
dist/ui/assets/index-BhsIncpm.css                          147.98 kB │ gzip:  23.58 kB
dist/ui/assets/JZOYTAAL-Dlo7hLcQ.js                          0.05 kB │ gzip:   0.07 kB
dist/ui/assets/percentages-BXMCSKIN-DAe4hRTC.js              0.06 kB │ gzip:   0.07 kB
dist/ui/assets/image-GAAHSSAO-BaduPvWw.js                    0.08 kB │ gzip:   0.08 kB
dist/ui/assets/array-BifhSqXX.js                             0.10 kB │ gzip:   0.11 kB
dist/ui/assets/pie-WAS4IAKB-rbLltb3S.js                      0.10 kB │ gzip:   0.12 kB
dist/ui/assets/info-A6RAGUB7-BUQdSyy8.js                     0.10 kB │ gzip:   0.12 kB
dist/ui/assets/radar-RG4KPBEZ-DlJh2y63.js                    0.10 kB │ gzip:   0.12 kB
dist/ui/assets/packet-AYTQ26CC-CG03W5gZ.js                   0.11 kB │ gzip:   0.12 kB
dist/ui/assets/cynefin-OW5HDTMX-DAOv7cJ6.js                  0.11 kB │ gzip:   0.12 kB
dist/ui/assets/treemap-WGGIJYW6-B8_PzjPP.js                  0.11 kB │ gzip:   0.12 kB
dist/ui/assets/wardley-WFR3VGLG-CRQg_Pw_.js                  0.11 kB │ gzip:   0.12 kB
dist/ui/assets/gitGraph-4MIJSDKK-CV_AbzkH.js                 0.11 kB │ gzip:   0.12 kB
dist/ui/assets/railroad-74A4TZTK-RC58mFqm.js                 0.11 kB │ gzip:   0.12 kB
dist/ui/assets/treeView-Q6P3EWNA-JIg44uPC.js                 0.11 kB │ gzip:   0.12 kB
dist/ui/assets/channel-Cxd0yCH8.js                           0.11 kB │ gzip:   0.12 kB
dist/ui/assets/railroad-peg-WCYAUIDC-Bc0xnaSF.js             0.11 kB │ gzip:   0.13 kB
dist/ui/assets/architecture-7GRP2DOG-DV5MBuww.js             0.11 kB │ gzip:   0.12 kB
dist/ui/assets/railroad-abnf-HS5TGJTU-DAHpSSyM.js            0.11 kB │ gzip:   0.13 kB
dist/ui/assets/railroad-ebnf-LZEXJU2U-zF8QWR3k.js            0.11 kB │ gzip:   0.13 kB
dist/ui/assets/eventmodeling-NTZA5JFV-DstZBoVC.js            0.11 kB │ gzip:   0.13 kB
dist/ui/assets/subset-shared.chunk-q-QdCdvJ.js               0.13 kB │ gzip:   0.13 kB
dist/ui/assets/init-C-OQMol4.js                              0.14 kB │ gzip:   0.12 kB
dist/ui/assets/chunk-Y2CYZVJY-DsF7k-Jl.js                    0.15 kB │ gzip:   0.14 kB
dist/ui/assets/RVARI57O-CgA1WoRv.js                          0.15 kB │ gzip:   0.14 kB
dist/ui/assets/chunk-2Q5K7J3B-C1jixKkw.js                    0.19 kB │ gzip:   0.16 kB
dist/ui/assets/chunk-JWPE2WC7-DVXcaiue.js                    0.22 kB │ gzip:   0.17 kB
dist/ui/assets/chunk-XXDRQBXY-CnbRkih_.js                    0.26 kB │ gzip:   0.22 kB
dist/ui/assets/subset-worker.chunk-DKG-mzho.js               0.35 kB │ gzip:   0.27 kB
dist/ui/assets/chunk-5VM5RSS4-ZNzvKenW.js                    0.36 kB │ gzip:   0.27 kB
dist/ui/assets/K3MD6TGW-DoZsgo2A.js                          0.37 kB │ gzip:   0.28 kB
dist/ui/assets/file-open-7c801643-DZtJT5zp.js                0.44 kB │ gzip:   0.31 kB
dist/ui/assets/5THPTBWS-Ce_hS451.js                          0.47 kB │ gzip:   0.29 kB
dist/ui/assets/TSHNXIZL-BdUfgVGd.js                          0.49 kB │ gzip:   0.34 kB
dist/ui/assets/file-open-002ab408-BHUWm0Sh.js                0.52 kB │ gzip:   0.32 kB
dist/ui/assets/flowDiagram-HODETNUW-CPzIROUZ.js              0.55 kB │ gzip:   0.30 kB
dist/ui/assets/G3MDBVQH-BZmnMkFw.js                          0.55 kB │ gzip:   0.33 kB
dist/ui/assets/chunk-POPQ4Y6H-Bh0S8sXl.js                    0.56 kB │ gzip:   0.39 kB
dist/ui/assets/directory-open-01563666-D4xXyWb_.js           0.58 kB │ gzip:   0.36 kB
dist/ui/assets/5GK6JWQ2-CAFCJre4.js                          0.60 kB │ gzip:   0.42 kB
dist/ui/assets/en-B4ZKOASM-CIZXjWOP.js                       0.60 kB │ gzip:   0.34 kB
dist/ui/assets/infoDiagram-27XIBGKW-DKe6Z3XR.js              0.64 kB │ gzip:   0.42 kB
dist/ui/assets/file-save-3189631c-CO9S4HFW.js                0.69 kB │ gzip:   0.44 kB
dist/ui/assets/classDiagram-ZZMXUADV-4maSZ6MO.js             0.78 kB │ gzip:   0.44 kB
dist/ui/assets/classDiagram-v2-VYDZK3BY-4maSZ6MO.js          0.78 kB │ gzip:   0.44 kB
dist/ui/assets/stateDiagram-v2-MP3YSRHH-CedY4uqt.js          0.78 kB │ gzip:   0.45 kB
dist/ui/assets/swimlanesDiagram-VR7AAH4N-Syi35feB.js         0.81 kB │ gzip:   0.47 kB
dist/ui/assets/DKTLEL5E-DciMwFJ1.js                          0.82 kB │ gzip:   0.39 kB
dist/ui/assets/file-save-745eba88-Bwdfz6OZ.js                0.85 kB │ gzip:   0.49 kB
dist/ui/assets/sizeCapture-INFHLROL-3uHXrFqA.js              0.87 kB │ gzip:   0.51 kB
dist/ui/assets/line-C0KLtU_x.js                              0.94 kB │ gzip:   0.46 kB
dist/ui/assets/74OO7NKP-Bb7PxGxY.js                          0.97 kB │ gzip:   0.57 kB
dist/ui/assets/WEVWDWVA-btygu_Et.js                          1.02 kB │ gzip:   0.52 kB
dist/ui/assets/rolldown-runtime-COiEfhsA.js                  1.11 kB │ gzip:   0.62 kB
dist/ui/assets/ordinal-BDEzSJ7C.js                           1.17 kB │ gzip:   0.56 kB
dist/ui/assets/6IMQ5BUJ-D8RtTQZf.js                          1.39 kB │ gzip:   0.75 kB
dist/ui/assets/chunk-GVQU2GXP-CK3wAo79.js                    1.41 kB │ gzip:   0.79 kB
dist/ui/assets/directory-open-4ed118d0-1i309Asm.js           1.51 kB │ gzip:   0.76 kB
dist/ui/assets/5N7A7DKN-DEmddbMa.js                          1.63 kB │ gzip:   0.91 kB
dist/ui/assets/railroadDiagram-O6MQD6OU-sHY5bLEs.js          1.66 kB │ gzip:   0.77 kB
dist/ui/assets/abnfDiagram-VCTEODGH-CmnEX-o3.js              1.84 kB │ gzip:   0.89 kB
dist/ui/assets/7WLXJQOR-D6QVYUu9.js                          1.94 kB │ gzip:   0.94 kB
dist/ui/assets/chunk-P2QGCYS3-DDUHqkJz.js                    1.94 kB │ gzip:   0.96 kB
dist/ui/assets/chunk-F27PBJKO-BQIuWFRQ.js                    1.97 kB │ gzip:   0.89 kB
dist/ui/assets/pegDiagram-XKGWAZYB-CBkmOpFB.js               2.00 kB │ gzip:   0.93 kB
dist/ui/assets/ebnfDiagram-PWID7BFC-BPkexDtD.js              2.06 kB │ gzip:   0.89 kB
dist/ui/assets/5B3SVYGG-5T4NE8CT.js                          2.13 kB │ gzip:   1.05 kB
dist/ui/assets/dist-CumnGVmJ.js                              2.17 kB │ gzip:   0.97 kB
dist/ui/assets/path-fybaL0A-.js                              2.27 kB │ gzip:   0.98 kB
dist/ui/assets/FTXIJQGB-CggtIYAM.js                          2.54 kB │ gzip:   1.10 kB
dist/ui/assets/roundRect-D01gJrlt.js                         2.87 kB │ gzip:   0.99 kB
dist/ui/assets/6OLKWJ4F-Dnvl7b5d.js                          3.42 kB │ gzip:   1.60 kB
dist/ui/assets/arc-Y1ARJVZ4.js                               3.47 kB │ gzip:   1.46 kB
dist/ui/assets/CXAC5362-DCPHOw8o.js                          4.12 kB │ gzip:   1.92 kB
dist/ui/assets/diagram-Z3DM3KII-DAgossI8.js                  4.27 kB │ gzip:   1.85 kB
dist/ui/assets/defaultLocale-BFoDCU3G.js                     4.63 kB │ gzip:   2.12 kB
dist/ui/assets/HDGCDEEZ-DddO1Pya.js                          5.11 kB │ gzip:   2.43 kB
dist/ui/assets/5S6HY5KT-BjiyESIq.js                          5.29 kB │ gzip:   2.62 kB
dist/ui/assets/linear-DYsT-3Lb.js                            5.51 kB │ gzip:   2.25 kB
dist/ui/assets/UQJE5E4I-DH4qiIHp.js                          5.72 kB │ gzip:   2.81 kB
dist/ui/assets/chunk-PWAF6VOD-BI5ER1Ez.js                    5.83 kB │ gzip:   2.68 kB
dist/ui/assets/diagram-UQ7AKVKN-CfSWvWO6.js                  6.06 kB │ gzip:   2.57 kB
dist/ui/assets/pieDiagram-E7YTZNPT-Gy0VnBor.js               6.21 kB │ gzip:   2.59 kB
dist/ui/assets/DYY6UVD2-CZNeuhH9.js                          6.39 kB │ gzip:   2.98 kB
dist/ui/assets/4UO7MD6I-Bu9Eitfn.js                          7.04 kB │ gzip:   3.17 kB
dist/ui/assets/O7XIQ6OM-zjRw2UmY.js                          7.21 kB │ gzip:   3.24 kB
dist/ui/assets/YVG2LODB-CksKxaqk.js                          7.28 kB │ gzip:   3.30 kB
dist/ui/assets/CEQABKGZ-wp1XkcHv.js                          7.55 kB │ gzip:   3.48 kB
dist/ui/assets/diagram-S7CK7UJ4-Bve_TfQd.js                  8.10 kB │ gzip:   3.63 kB
dist/ui/assets/LUXOKEGN-Dm-07b2J.js                          8.20 kB │ gzip:   3.68 kB
dist/ui/assets/si-LK-N5RQ5JYF-D-HhLp3f.js                    8.57 kB │ gzip:   3.35 kB
dist/ui/assets/az-AZ-76LH7QW2-DxOiMfgA.js                    8.60 kB │ gzip:   3.58 kB
dist/ui/assets/zh-HK-E62DVLB3-BFYpzqcD.js                    9.07 kB │ gzip:   4.08 kB
dist/ui/assets/2NI2N5EU-BtzvZetk.js                          9.27 kB │ gzip:   4.14 kB
dist/ui/assets/XBNEOJTC-W2XWM4Mq.js                          9.38 kB │ gzip:   4.17 kB
dist/ui/assets/chunk-L3NEJ4N5-DrvhB2-d.js                    9.68 kB │ gzip:   3.04 kB
dist/ui/assets/cynefinDiagram-5FMLGOSQ-gexUGC1V.js           9.93 kB │ gzip:   3.51 kB
dist/ui/assets/kk-KZ-P5N5QNE5-A_LxKiz1.js                   10.11 kB │ gzip:   4.18 kB
dist/ui/assets/kaa-6HZHGXH3-DAMl7niJ.js                     10.16 kB │ gzip:   4.17 kB
dist/ui/assets/YURCZMG2-C6kVoSkj.js                         10.43 kB │ gzip:   4.51 kB
dist/ui/assets/stateDiagram-D77RDMKH-DyNr-JXJ.js            10.63 kB │ gzip:   3.72 kB
dist/ui/assets/diagram-VSXAHHWV-D5VVZ4bO.js                 10.66 kB │ gzip:   4.10 kB
dist/ui/assets/dagre-GXQ25YYZ-DN6CM4bp.js                   10.96 kB │ gzip:   4.14 kB
dist/ui/assets/K7RP3OMA-BmMFUFPv.js                         11.12 kB │ gzip:   4.95 kB
dist/ui/assets/77XECAW3-BeVftrt7.js                         11.49 kB │ gzip:   5.30 kB
dist/ui/assets/YHV2MVVZ-pado1Hyb.js                         12.04 kB │ gzip:   5.05 kB
dist/ui/assets/ABYRPUBD-DlZrO5kJ.js                         12.06 kB │ gzip:   3.20 kB
dist/ui/assets/lt-LT-XHIRWOB4-CCvLgY0n.js                   12.49 kB │ gzip:   5.35 kB
dist/ui/assets/NUIALGQ3-De_wmx-4.js                         13.20 kB │ gzip:   5.57 kB
dist/ui/assets/OFQON5FD-DsntYwIC.js                         13.41 kB │ gzip:   5.45 kB
dist/ui/assets/vi-VN-M7AON7JQ-CbWAKpPy.js                   13.85 kB │ gzip:   5.78 kB
dist/ui/assets/PJQHF43J-Cyxl1OGv.js                         14.07 kB │ gzip:   5.81 kB
dist/ui/assets/da-DK-5WZEPLOC-DZfQI3Wp.js                   14.40 kB │ gzip:   6.06 kB
dist/ui/assets/X62E3GBT-DfpN3cDA.js                         14.49 kB │ gzip:   6.27 kB
dist/ui/assets/FNOVOB4O-DVypvYOx.js                         15.11 kB │ gzip:   5.81 kB
dist/ui/assets/th-TH-HPSO5L25-OtOnfVJ4.js                   15.51 kB │ gzip:   5.17 kB
dist/ui/assets/chunk-SVP7TREG-m1eXt2g_.js                   15.63 kB │ gzip:   4.34 kB
dist/ui/assets/diagram-VX7I27RA-D8RZCd5L.js                 15.74 kB │ gzip:   5.52 kB
dist/ui/assets/nn-NO-6E72VCQL-DKz3qz-a.js                   15.95 kB │ gzip:   6.71 kB
dist/ui/assets/X5RFHQXM-Dw6CSR7A.js                         16.53 kB │ gzip:   6.98 kB
dist/ui/assets/mermaid-parser.core-BSPzXfUC.js              16.58 kB │ gzip:   3.93 kB
dist/ui/assets/nl-NL-IS3SIHDZ-D3R2Rx06.js                   16.72 kB │ gzip:   6.91 kB
dist/ui/assets/ishikawaDiagram-5VMMS53U-CNHXg392.js         17.29 kB │ gzip:   6.52 kB
dist/ui/assets/my-MM-5M5IBNSE-CeZ_XXUZ.js                   17.56 kB │ gzip:   5.28 kB
dist/ui/assets/hu-HU-A5ZG7DT2-DdPEh3-X.js                   18.07 kB │ gzip:   7.57 kB
dist/ui/assets/fi-FI-Z5N7JZ37-Bdl9Q5C2.js                   18.40 kB │ gzip:   7.52 kB
dist/ui/assets/kab-KAB-ZGHBKWFO-Jzb-3Hhw.js                 18.77 kB │ gzip:   7.54 kB
dist/ui/assets/zh-TW-RAJ6MFWO-3neZILu7.js                   18.98 kB │ gzip:   8.85 kB
dist/ui/assets/USNYFO5S-Zxj02Qjt.js                         19.04 kB │ gzip:   7.38 kB
dist/ui/assets/zh-CN-LNUGB5OW-BQ_RQPWk.js                   19.04 kB │ gzip:   8.86 kB
dist/ui/assets/lv-LV-5QDEKY6T-ndnKvK8Q.js                   19.13 kB │ gzip:   7.78 kB
dist/ui/assets/gl-ES-HMX3MZ6V-BGdjvteZ.js                   19.38 kB │ gzip:   7.71 kB
dist/ui/assets/tr-TR-DEFEU3FU-m5jW7Q7T.js                   19.50 kB │ gzip:   7.95 kB
dist/ui/assets/cs-CZ-2BRQDIVT-BS4HH52H.js                   19.52 kB │ gzip:   8.39 kB
dist/ui/assets/pt-PT-UZXXM6DQ-DFLh4yZC.js                   19.64 kB │ gzip:   7.78 kB
dist/ui/assets/id-ID-SAP4L64H-DhAaYPVx.js                   19.67 kB │ gzip:   7.67 kB
dist/ui/assets/ca-ES-6MX7JW3Y-BvEUE1Ob.js                   19.78 kB │ gzip:   7.89 kB
dist/ui/assets/oc-FR-POXYY2M6-CUA1Dxbe.js                   19.83 kB │ gzip:   7.78 kB
dist/ui/assets/nb-NO-T6EIAALU-CywAeawF.js                   20.09 kB │ gzip:   8.18 kB
dist/ui/assets/kanban-definition-UXKFOSKX-BtR1bUZK.js       20.25 kB │ gzip:   7.16 kB
dist/ui/assets/he-IL-6SHJWFNN-DzIpU7Iw.js                   20.31 kB │ gzip:   7.53 kB
dist/ui/assets/DRLTVNUE-CSbxAAZa.js                         20.36 kB │ gzip:   7.61 kB
dist/ui/assets/HSJLKHB7-C2DWeOfY.js                         20.75 kB │ gzip:   8.60 kB
dist/ui/assets/bg-BG-XCXSNQG7-81v8juYJ.js                   20.75 kB │ gzip:   7.38 kB
dist/ui/assets/pt-BR-5N22H2LF-BYo0nDbc.js                   21.03 kB │ gzip:   8.20 kB
dist/ui/assets/eu-ES-A7QVB2H4-CjZJLAXA.js                   21.19 kB │ gzip:   8.21 kB
dist/ui/assets/es-ES-U4NZUMDT-_337TYYo.js                   21.34 kB │ gzip:   8.48 kB
dist/ui/assets/sl-SI-NN7IZMDC-CYUyoMWc.js                   21.35 kB │ gzip:   8.57 kB
dist/ui/assets/sv-SE-XGPEYMSR-CvqDSp74.js                   21.51 kB │ gzip:   8.55 kB
dist/ui/assets/it-IT-JPQ66NNP-BZsYrxuS.js                   22.05 kB │ gzip:   8.57 kB
dist/ui/assets/sk-SK-C5VTKIMK-B-84EAA4.js                   22.30 kB │ gzip:   9.10 kB
dist/ui/assets/pl-PL-T2D74RX3-B51mcYY6.js                   22.49 kB │ gzip:   9.22 kB
dist/ui/assets/sankeyDiagram-P5KCCOFB-NDVvmE0K.js           22.79 kB │ gzip:   8.27 kB
dist/ui/assets/ro-RO-JPDTUUEW-DgiS2hTB.js                   23.14 kB │ gzip:   8.93 kB
dist/ui/assets/journeyDiagram-3NMN7TZE-CjZenfn6.js          23.15 kB │ gzip:   8.15 kB
dist/ui/assets/5OC2THR4-BgnUmsCV.js                         23.24 kB │ gzip:   9.33 kB
dist/ui/assets/de-DE-XR44H4JA-C1rTyMe4.js                   23.33 kB │ gzip:   8.96 kB
dist/ui/assets/ja-JP-DBVTYXUO-YZcgnms2.js                   23.39 kB │ gzip:   8.78 kB
dist/ui/assets/mindmap-definition-YA3MSWOX-CQaZ2-lh.js      23.41 kB │ gzip:   7.95 kB
dist/ui/assets/fr-FR-RHASNOE6-CSQxSvJW.js                   23.44 kB │ gzip:   8.86 kB
dist/ui/assets/bn-BD-2XOGV67Q-BpzY8WFf.js                   23.59 kB │ gzip:   6.67 kB
dist/ui/assets/ko-KR-MTYHY66A-BojVaANF.js                   23.87 kB │ gzip:   9.17 kB
dist/ui/assets/graphlib-DS17s2tU.js                         23.90 kB │ gzip:   8.31 kB
dist/ui/assets/SLD4V6NK-2KlkIrdQ.js                         24.14 kB │ gzip:  10.05 kB
dist/ui/assets/fa-IR-HGAKTJCU-DXggGMGV.js                   24.23 kB │ gzip:   8.43 kB
dist/ui/assets/wardleyDiagram-VM6X3IG4-BMzqlACK.js          25.19 kB │ gzip:   6.55 kB
dist/ui/assets/ar-SA-G6X2FPQ2-jbi5Kkn0.js                   25.66 kB │ gzip:   9.10 kB
dist/ui/assets/T3PCR2KE-BAhIsjBM.js                         27.01 kB │ gzip:  11.06 kB
dist/ui/assets/rough.esm-Dy-Kn_BL.js                        27.10 kB │ gzip:   8.85 kB
dist/ui/assets/pa-IN-N4M65BXN-AqYNSu4b.js                   27.97 kB │ gzip:   7.97 kB
dist/ui/assets/BB2UYUI2-CmVCLht6.js                         28.12 kB │ gzip:  10.89 kB
dist/ui/assets/gitGraphDiagram-WWUBYQGX-B_OmsPgj.js         29.00 kB │ gzip:   8.53 kB
dist/ui/assets/ku-TR-6OUDTVRD-DJpXkTev.js                   29.32 kB │ gzip:   9.26 kB
dist/ui/assets/el-GR-BZB4AONW-CkZSqOYr.js                   29.66 kB │ gzip:   9.59 kB
dist/ui/assets/BUM34MOA-C9L6PPQi.js                         30.06 kB │ gzip:  11.38 kB
dist/ui/assets/75O6YZUN-CN2EZPa7.js                         30.14 kB │ gzip:  11.57 kB
dist/ui/assets/timeline-definition-24CTP7MA-CxjcZruD.js     30.37 kB │ gzip:   9.95 kB
dist/ui/assets/chunk-75Z2AOVW-62WNjDJb.js                   30.37 kB │ gzip:   8.43 kB
dist/ui/assets/erDiagram-RLTQ6QDP-Dz3s6jMN.js               30.67 kB │ gzip:  10.59 kB
dist/ui/assets/ru-RU-B4JR7IUQ-BUhXzxTk.js                   30.73 kB │ gzip:   9.85 kB
dist/ui/assets/requirementDiagram-BXWQKSXE-Bz5cz6_J.js      30.97 kB │ gzip:   9.77 kB
dist/ui/assets/uk-UA-QMV73CPH-DkFdUKRE.js                   31.63 kB │ gzip:  10.09 kB
dist/ui/assets/pica-CXv_OHDX.js                             31.76 kB │ gzip:  12.46 kB
dist/ui/assets/hi-IN-IWLTKZ5I-DK5G382C.js                   32.34 kB │ gzip:   9.06 kB
dist/ui/assets/N3JZAHOW-CCqLAsRX.js                         32.57 kB │ gzip:  13.23 kB
dist/ui/assets/quadrantDiagram-AXDQQJYC-BdR1-lB-.js         33.51 kB │ gzip:   9.74 kB
dist/ui/assets/O65XPQGZ-DiKCt3MI.js                         34.04 kB │ gzip:  12.63 kB
dist/ui/assets/ta-IN-2NMHFXQM-DcJ2M_Wx.js                   35.26 kB │ gzip:   8.49 kB
dist/ui/assets/chunk-OSK3NFVY-Dw0Y-gVJ.js                   36.46 kB │ gzip:   7.91 kB
dist/ui/assets/km-KH-HSX4SM5Z-DJuEDhec.js                   36.64 kB │ gzip:   9.20 kB
dist/ui/assets/dagre-D7JM2Yhv.js                            36.84 kB │ gzip:  13.23 kB
dist/ui/assets/chunk-IMKFNOWR-8xFnxqxn.js                   37.62 kB │ gzip:  12.24 kB
dist/ui/assets/TKWO2OVW-Dq1t5PcY.js                         39.38 kB │ gzip:  14.70 kB
dist/ui/assets/vennDiagram-4TSXK5OY-84w695DV.js             41.15 kB │ gzip:  15.11 kB
dist/ui/assets/RHNBAITX-CXvIdt3U.js                         41.25 kB │ gzip:  15.47 kB
dist/ui/assets/blockDiagram-I7D4REHJ-ClzWcR-x.js            41.41 kB │ gzip:  13.36 kB
dist/ui/assets/mr-IN-CRQNXWMA-CK6QYGEp.js                   42.24 kB │ gzip:  10.67 kB
dist/ui/assets/LHDIQX7Q-DymnVJWm.js                         43.97 kB │ gzip:  16.07 kB
dist/ui/assets/xychartDiagram-S5SC5T6Z-CFi18T0a.js          44.13 kB │ gzip:  12.24 kB
dist/ui/assets/image-blob-reduce.esm-ZiL83eII.js            45.38 kB │ gzip:  16.30 kB
dist/ui/assets/src-BWF7jMDv.js                              45.66 kB │ gzip:  16.00 kB
dist/ui/assets/chunk-TICWLB2K-D3LfaguZ.js                   48.77 kB │ gzip:  15.75 kB
dist/ui/assets/chunk-GMAD6QVW-eifELQUV.js                   51.20 kB │ gzip:  16.68 kB
dist/ui/assets/chunk-SHT3W25Y-Cciini39.js                   61.18 kB │ gzip:  19.83 kB
dist/ui/assets/c4Diagram-7LVT6UL2-DzddlsmM.js               64.74 kB │ gzip:  18.55 kB
dist/ui/assets/ganttDiagram-EL5Y4UJY-D5braOTW.js            69.36 kB │ gzip:  22.77 kB
dist/ui/assets/cose-bilkent-JH36ORCC-vhvneb2W.js            81.23 kB │ gzip:  21.52 kB
dist/ui/assets/chunk-4HAMMTFA-PYlkreNw.js                  104.85 kB │ gzip:  25.52 kB
dist/ui/assets/swimlanes-42K2YHIH-DVkF6vda.js              111.04 kB │ gzip:  37.96 kB
dist/ui/assets/sequenceDiagram-WJ2MYXX4-zZzqmzGr.js        115.73 kB │ gzip:  30.57 kB
dist/ui/assets/dist--VBJabRh.js                            145.35 kB │ gzip:  48.73 kB
dist/ui/assets/architectureDiagram-5GKGNRK7-BoOlfTuC.js    148.87 kB │ gzip:  41.12 kB
dist/ui/assets/chunk-DU6HZSFF-BnzYhlej.js                  237.71 kB │ gzip:  39.00 kB
dist/ui/assets/katex-BxGmONnW.js                           258.56 kB │ gzip:  77.43 kB
dist/ui/assets/cytoscape.esm-CVyW_ZDf.js                   434.70 kB │ gzip: 137.72 kB
dist/ui/assets/chunk-FOHPRMQF-DhwWuAwv.js                  662.07 kB │ gzip: 143.15 kB
dist/ui/assets/chunk-EIO257PC-DtlbzX6i.js                1,820.99 kB │ gzip: 744.20 kB
dist/ui/assets/index-DYouoZcB.js                         2,026.66 kB │ gzip: 661.20 kB
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 946ms
```

## Concerns

- Finding 2's reconcile and finding 3's guard live in `BoardView`, which has no component test (none existed before).
  The pure parts (`droppedProposals`, the busy rows) are tested.
  The timer, the post, and the in-flight bookkeeping are verified only by reading the code and by the typecheck, not in a browser.
- A ghost removal followed by leaving the board within the 1 s grace period clears the timer, so that proposal stays pending on the server.
  This is the same orphan the finding describes, in a narrower window.
