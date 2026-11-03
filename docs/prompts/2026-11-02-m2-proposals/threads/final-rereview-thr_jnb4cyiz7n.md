**Finding 1: ADDRESSED.**
- `src/export/boardGraph.ts:70-80` drops elements tagged `ghost: "add"`, plus any text whose `containerId` is an add ghost.
- `labelBefore` (`boardGraph.ts:56-61`) uses `before.label` for update ghosts, on both edges (diff l.103) and nodes (l.125).
- Delete ghosts stay.
- `withoutAddGhosts` is removed from `src/server/agent/tools.ts` (diff l.592-608). `checkIds` keeps the add-ghost exclusion inline (l.629-631), with the same filter as before.
- `before.label` is written from `originalText ?? text` in `ghosts.ts:372`, so the export reads the right field.
- `test/export/boardGraph.test.ts` (diff l.1072-1152) covers add ghosts with their labels, update ghosts (bound text, a node's own text, an arrow label, and an update with no `before.label`), and delete ghosts.
- The report says the goldens are untouched, and the diff stat shows no fixture changes.

**Finding 2: ADDRESSED.**
- `droppedProposals` is at `src/ui/board/ghosts.ts:899-906`, with a test at `test/ui/ghosts.test.ts:1650-1658`.
- In `BoardView.tsx`, `onChange` checks the previous list (`seen`) against the next one and skips any id that has a decision in flight (diff l.786-789).
- `reconcileDrop` waits 1 s, re-reads the scene's ghosts, re-checks `decidingNow`, then posts `rejected` through `tellServer`, which tolerates a 404 (l.759-768).
- The timers are cleared on unmount (l.769-774).
- `decide` takes its own id out of `seen` after the await and before its scene update (l.741), so a decision's own removal is never treated as a drop.
- `App.tsx:79-80` keys `BoardView` by board name, so switching boards unmounts it rather than dropping every ghost through `onChange`.

**Finding 3: ADDRESSED.**
- `BoardView` keeps a `deciding` set: the id is added before the request and removed in `finally` (diff l.728-737).
- The bar gets `busy: deciding.has(p.id)` (l.812-816).
- `ProposalsBar.tsx` disables all three buttons on a busy row (l.857, 865, 873).
- Test: `test/ui/ProposalsBar.test.tsx:1593-1609`.

**Finding 4: ADDRESSED.**
- `test/ui/restoreSeam.test.ts` uses the same FontFace and canvas stubs as `mermaid.test.ts`.
- It runs the `between` fixture through `applyProposal`, `listBoundArrows`, and the real `restoreElements(..., { refreshDimensions: true, repairBindings: true })`.
- It asserts that the "reads" label survives, that both arrows keep both bindings, and that a, b and the new node list the arrows in `boundElements` (l.1929-1941).
- The report says reverting either earlier fix makes the test fail.

**Finding 5: ADDRESSED.**
- `SessionDeps.onNotSent?` is at `session.ts` diff l.365.
- Held sends and `InputQueue` items now carry their send id. `drain`, `#stopRun` and `#notSent` pass the ids oldest first and call `onNotSent` for each (l.410-414, 494-507, 543-547).
- All three paths that drop a send go through it: Stop on held sends, Stop while the CLI is still starting, and a run that ends.
- `createAgent` keeps a `riding` map from send id to notes (`index.ts` l.192):
  - `onNotSent` re-queues that send's notes (l.223-227).
  - A `result` event retires the oldest entry (l.217-220).
  - A synchronous throw re-queues and rethrows (l.268-276).
- `ProposalStore.requeueNotes` puts requeued notes ahead of fresh ones (`proposals.ts` l.306, 329-337).
- Tests: three session tests now assert the exact dropped ids, plus two `agentRoutes` tests (Stop, sync throw) and one store ordering test.
- An error result appears as an `error` event, not `result`, so its entry retires late. That is harmless:
  - Entries are only ever looked up by id.
  - `onNotSent` only fires for ids that never ran.
  - Results never outnumber sends, so an entry is never retired early.

**Finding 6: ADDRESSED.**
- `refine.tsx` types the setter as `Dispatch<SetStateAction<…>>` (diff l.1038-1054).
- `BoardView.tsx` uses `setTarget((t) => (t?.id === id ? null : t))` (l.754).
- `ClaudePanel.tsx` captures `refining` before the await and clears with the same updater (l.995-1005).
- Test: `test/ui/refine.test.tsx:1807-1819`.

**Finding 7: ADDRESSED.**
- The check in `src/ui/board/mermaid.ts:966-969` is now `Object.keys(files ?? {}).length > 0`.
- Test: `test/ui/mermaid.test.ts:1770-1779`, which wraps the real importer through `vi.mock`.

**Finding 8: ADDRESSED.**
- The accept branch for a delete in `ghosts.ts` (diff l.929-939) sets only the matching `startBinding` or `endBinding` of live arrows to null.
- The loop reads the current `out`, so if a later update ghost on the same arrow runs, it spreads the patched element and keeps the unbinding.
- Test: `test/ui/ghosts.test.ts:1681-1713`. It covers an arrow starting on the element, one ending on it, an already-deleted arrow (unchanged), and a reject (binding kept).

**Finding 9: ADDRESSED.**
- `index.ts` l.260-264 ends the note with ` Its current ops are: ${JSON.stringify(refining.ops)}`.
- The test expectation is updated at `agentRoutes.test.ts:1422`.

**Finding 10: ADDRESSED.**
- `src/export/markdown.ts` l.158 and l.161 rename the local to `link`.
- The `arrow` helper is still what l.167 and l.171 use.

Test evidence: the report names the covering test for each finding and shows its output, and reports `pnpm check` (234/234 tests) and `pnpm build` passing. The claims match the diff.

### New Breakage in the Fix Diff
None at Critical or Important. Three Minor gaps:

- **Minor: a reconcile that gets a 409 is never retried** (`src/ui/board/BoardView.tsx` diff l.765). If the user removes ghosts by hand while Claude is revising that proposal, the timer's post gets a 409. `tellServer` then shows "Decision failed: …" for a decision the user never made, and the proposal stays orphaned with no retry.
- **Minor: the reconcile path does not clean up its own UI state** (`BoardView.tsx` diff l.759-768). It neither removes the `titles` entry nor clears a refine target that points at the rejected proposal. A later Refine send then fails with "proposal … is not pending" until the user clears the chip by hand.
- **Minor: leaving the board within the 1 s grace period leaves the orphan** (`BoardView.tsx` diff l.769-774). Unmount clears the pending timers, so that proposal stays pending on the server. The implementer flagged this in the report.

### Out-of-Scope Observations
- `ghosts.ts:371` does `labelOf(out, cur.id) as El` when an update op sets a label. On an element with no label this cast hides an `undefined`, and the next line reads `.originalText` from it. This was there before the fix and the diff does not touch it.
- `BoardView` has no component test, so the reconcile timer and the in-flight bookkeeping are verified only by reading the code. The implementer noted this too.

### Verdict
Fix round passes: all ten findings are addressed, with no new Critical or Important breakage. The three Minor gaps above do not block.
