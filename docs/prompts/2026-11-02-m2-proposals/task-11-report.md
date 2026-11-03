# Task 11 report: Connecting operations

Status: DONE_WITH_CONCERNS.
Commit: `bfc6336 feat(proposals): add_node and add_arrow connect new shapes to existing ones`.

## What I implemented

- `src/shared/proposals.ts`: `Op` gains `add_node` and `add_arrow` exactly as the brief specifies.
  `Revise` gains `title: z.string().optional()`.
  `referencedIds` collects `add_arrow` ends that are not `$` references.
  `checkRefs(ops)` throws `op <i>: <ref> must name an earlier add_node` for any `$` reference that is malformed (for example a bare `$`), out of range, not earlier, or names an op other than `add_node`.
- `src/server/agent/tools.ts`: `propose` and `revise` call `checkRefs` before `checkIds`.
  `revise` uses `title: args.title ?? prev.title`, and its description mentions the title.
- `src/server/agent/proposals.ts`: no change needed.
  `ProposalStore.revised(p)` already logs and stores the whole record, so a new title already replaces the old one, also on replay.
  A test now covers this.
- `src/server/agent/prompt.ts`: the propose line lists the six ops (`add_node (label, kind box, ellipse, or diamond)`, `add_arrow (from, to, optional label)`) and ends with the brief's sentence verbatim.
- `src/ui/board/mermaid.ts`: `renderNode(label, kind)` converts the brief's skeleton with `regenerateIds: true`.
- `src/ui/board/ghosts.ts`:
  - `El` gets optional `points`, `startBinding`, `endBinding`, `startArrowhead`, `endArrowhead`, plus `fontSize`, `fontFamily`, `textAlign`, `verticalAlign` for the arrow label.
  - The validation pass checks `add_arrow` ends: plain ids must be live elements (`unknown element id …`), and `$` references follow the `checkRefs` rule, so nothing changes when a reference is bad.
  - `add_node` is placed like `add_note`. A `nodes` map records each `add_node` op's placed shape by op index, so `$i` resolves to it.
  - `add_arrow` runs after every other op. It intersects the center-to-center line with each end's bounding box, and builds the arrow with `x`/`y` at the start border point, `points: [[0,0],[dx,dy]]`, both bindings `{ elementId, focus: 0, gap: 1 }`, `startArrowhead: null`, `endArrowhead: "arrow"`, the ghost style, the proposal group, and the `add` tag.
    A label becomes a bound text element (`containerId` set to the arrow, centered on the midpoint, Excalidraw's default 20 px Excalifont) with the same tag.
  - New ids come from `crypto.randomUUID()`, so a revise (reject then re-apply) never reuses an id.
  - ghosts.ts does not import `checkRefs`.
    Importing it pulled zod into the UI bundle (main chunk grew from 2,025 kB to 2,109 kB, and `ZodError` appeared in it), so the rule is repeated inline (6 lines) with a comment.
- `src/ui/board/BoardView.tsx`: `add_node` is rendered with `renderNode` before applying.
  `throughGhosts` now ends with `listBoundArrows`, which adds every live bound arrow to its two ends' `boundElements` (see concern 1).

## TDD evidence

RED, after writing the tests and before any implementation:

```
$ pnpm vitest run test/shared/proposals.test.ts test/server/agent test/ui/ghosts.test.ts test/ui/mermaid.test.ts
   × the prompt names add_node, add_arrow, and the $ reference
   × add_node is placed beside the anchor and add_arrow binds both ends
   × an arrow between diagonal shapes starts and ends on their borders
   × a $ reference to a missing node throws before anything changes
   × add_node and add_arrow parse, $ references resolve only to earlier add_node ops
   × revise can retitle, and keeps the title when none is given
   × propose and revise refuse a bad $ reference before checking ids or drawing
   × renderNode makes a shape with a bound label
 FAIL  test/shared/proposals.test.ts > add_node and add_arrow parse, ... ZodError: [
 FAIL  test/ui/ghosts.test.ts > add_node is placed beside the anchor ... Error: op 2 was not rendered
 FAIL  test/ui/mermaid.test.ts > renderNode makes a shape with a bound label  TypeError: renderNode is not a function
 FAIL  test/server/agent/prompt.test.ts > ... expected 'You are planning inside Blueprint, a …' to match /add_node/
 FAIL  test/server/agent/tools.test.ts > revise can retitle ... expected 'Cache' to be 'Redis cache'
 FAIL  test/server/agent/tools.test.ts > propose and revise refuse a bad $ reference ... promise resolved ... instead of rejecting
 Test Files  5 failed | 6 passed (11)
      Tests  8 failed | 101 passed (109)
```

The store test `revise can retitle` (`test/server/agent/proposals.test.ts`) passed at RED, because `revised` already stored the whole record.

GREEN after implementing:

```
 Test Files  11 passed (11)
      Tests  109 passed (109)
```

Second RED/GREEN cycle, for the label bug the manual run found (below): I changed the label assertion to `y: 12.5, width: 0, height: 25`, and it failed (`Tests 1 failed | 19 passed`).
After the fix: `Tests 20 passed (20)`.

Final check:

```
$ pnpm check
Checked 94 files in 52ms. No fixes applied.
 Test Files  34 passed (34)
      Tests  212 passed (212)
$ pnpm build 2>&1 | grep -iE 'warn|\(!\)|error'
(!) Some chunks are larger than 500 kB after minification. Consider:
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

Pristine, apart from the chunk-size warning that was already there.

## Manual verification (real login, one turn)

Setup:
- Scratch repository `$TMPDIR/bp-t11` with board `main`: box `API` (`boxApi`, x 160, y 300, 160x80), box `Database` (`boxDb`, x 520), and a bound arrow `arrAD` between them.
- Server `node dist/cli/index.js --no-open --port 4318`, run outside the sandbox so the SDK can reach the login.
- Playwright MCP could not start (`Browser is already in use for …/mcp-chrome-e220b27`, the same as Task 10), so I used gstack browse (headless, 1440x900), started from the scratch repository.

Steps and observations:
1. Cmd+A on the canvas: the chip read `3 selected: API, Database, arrow`.
2. Sent `Add a cache between these two`.
   About 6 s later the bar read `Claude proposed Add cache between API and Database · 3 added, 1 removed`.
   Logged ops: `delete arrAD`, `add_node "Cache" box near [boxApi, boxDb]`, `add_arrow boxApi → $1`, `add_arrow $1 → boxDb label "on miss"`.
   The turn cost $0.2164.
3. On the board, the old arrow was red dashed at opacity 40.
   A dashed Cache box appeared with two dashed arrows.
   The saved file showed both arrows with bindings to the right ids, starting on the border points, and with `boundElements` on API, Database and Cache listing them.
4. **Bug found and fixed**: the `on miss` label was missing from the scene.
   `restoreElements` drops any non-linear element whose width and height are both 0 (`isInvisiblySmallElement`), and my label started at 0x0.
   It also grows a centered text from `x` in both directions but from `y` downward only.
   The fix: the label starts 0 wide and one line tall (25 px), with its top half a line above the midpoint.
   This turn was the one real-login turn, so I did not ask Claude again.
   Instead I ran a throwaway jsdom test (since deleted) that put `applyProposal` output through the real `restoreElements(…, { refreshDimensions: true, repairBindings: true })`.
   The label survived, was centered on the arrow midpoint (250, 25), and the arrow's `boundElements` listed it.
5. **Placement does not match the brief's expectation**: Claude passed `near: [boxApi, boxDb]`, so the placement rule put Cache 80 px to the right of both boxes (x 760), not between them.
   As a result the API→Cache ghost arrow runs straight through the Database box.
   See concern 2.
6. Accept: the arrows turned solid, the old arrow was deleted, and `customData` became `{ origin: "ai", proposalId }`.
   I dragged the API box 150 px down with synthetic pointer events, and the API→Cache arrow followed (file: arrow start at (321, 465), API at y 450).
7. Cosmetic: the Cache box is 67x35 with sharp corners, next to the hand-drawn 160x80 rounded boxes, because the brief's skeleton has no size or roundness.
   I left it as specified.

Both servers are stopped, the gstack `.gstack/` landed in the scratch repository, and `git status` here is clean.

## Files changed

- `src/shared/proposals.ts`, `src/server/agent/tools.ts`, `src/server/agent/prompt.ts`, `src/ui/board/ghosts.ts`, `src/ui/board/mermaid.ts`, `src/ui/board/BoardView.tsx`
- `test/shared/proposals.test.ts`, `test/server/agent/tools.test.ts`, `test/server/agent/proposals.test.ts`, `test/server/agent/prompt.test.ts`, `test/ui/ghosts.test.ts`, `test/ui/mermaid.test.ts`
- `src/server/agent/proposals.ts`: unchanged (see above).

## Self-review findings

- I made `borderPoint` non-exported because nothing outside ghosts.ts uses it.
- The approximations are marked with `ponytail:` comments:
  - Ellipse and diamond ends use the bounding box, so their arrows stop slightly short.
  - A label that wraps to two lines sits half a line low until the arrow next moves.
- `listBoundArrows` runs on every `throughGhosts` call, including decisions.
  It only touches shapes missing an arrow entry, and bumps their version so saves and undo see the change.
  On reject, Excalidraw's own `repairContainerElement` removes the deleted ghost arrows from the targets again.
- The `$`-reference rule exists twice (`checkRefs` on the server, inline in ghosts.ts) to keep zod out of the UI bundle.
  Both copies have tests with the same messages.

## Concerns

1. **The brief's binding claim is wrong for Excalidraw 0.18.1.** `restoreElements(…, { repairBindings: true })` does not add a bound arrow to its targets' `boundElements`.
   It only repairs container↔text links and nulls bindings to missing elements (`chunk-4FTI6OG3.js:20621-20720`).
   A shape drags only the arrows it lists (`updateBoundElements` → `boundElementsVisitor`).
   I kept ghosts.ts free of target patching, as the brief says, and put the listing in BoardView (`listBoundArrows`), the file the brief already assigns this to.
   The Accept-then-drag check passed.
2. **"Between" depends on which `near` ids Claude passes.** With both ends as `near`, the node goes right of both, and one new arrow crosses the far box.
   The brief's own test passes only the left box.
   A fix is either one prompt clause (for example "pass only the first node as near") or a placement rule for an `add_node` that arrows connect (for example, the midpoint of its arrow ends).
   I changed neither, because the prompt sentence is verbatim and placement is fixed by the global constraints.
   This needs a decision.
3. I verified the arrow-label fix offline with the real `restoreElements` but not in the browser, to keep to one real-login turn.

## Fix round 0

Ruling applied: "between" placement.
Commit: `74aed14 feat(ui): place a connecting node between its two neighbours`.

### What changed

- `src/ui/board/ghosts.ts`: new pure helper `betweenTargets(ops, i): [string, string] | null`.
  It returns the two ends when exactly two `add_arrow` ops touch `$i`, one into it and one out of it (in either list order), and their other ends are two distinct existing ids (not `$` references).
  Otherwise it returns null.
- `applyProposal` uses it for `add_node`.
  For a node between two elements, the node's shape (not its label) is centered on the midpoint of the two elements' centers, `near` is ignored, and the node stays out of the downward stack (`offsetY` is not advanced).
  Every other add keeps the beside-the-anchor rule unchanged.
- `src/server/agent/prompt.ts`: the propose line now ends with `… using $<index> to name the new node. A node between two existing ones needs no near.`

### Tests

- The brief's connecting test now uses the ruling's layout: `a` (0,0,100,50), `b` (400,0,100,50), ops delete `ab`, add_node "Cache" (still with `near: ["a"]`, to show it is ignored), add_arrow a→$1, add_arrow $1→b with a label.
  The Cache box (100x50) lands at (200,0), so it is centered on (250,25).
  Both arrows bind to it: a→n runs (100,25)→(200,25), and n→b runs (300,25)→(400,25).
  The label's top-left is (350, 12.5), and the counts are still `3 added, 1 removed`.
- New `a node with one connecting arrow stays beside its anchor`: a node with a single arrow is placed at x 180 (80 px gap).
- New `betweenTargets wants one arrow in and one out, from two distinct existing elements`: covers either order, one arrow, two arrows in, the same element on both sides, a `$` reference as an end, three arrows, and an unrelated arrow.
- The prompt test asserts the new sentence.

RED:

```
$ pnpm vitest run test/ui/ghosts.test.ts test/server/agent/prompt.test.ts
   × the prompt names add_node, add_arrow, and the $ reference
   × a node between two existing elements is centered between them and add_arrow binds both ends
   × betweenTargets wants one arrow in and one out, from two distinct existing elements
AssertionError: expected { type: 'rectangle', x: 180, …(10) } to match object { x: 200, y: +0 }
TypeError: betweenTargets is not a function
AssertionError: expected 'You are planning inside Blueprint, a …' to contain 'A node between two existing ones need…'
      Tests  3 failed | 26 passed (29)
```

My first implementation centered the whole rendered group (shape plus label) and got x 187.5, because the test's label element extends past the shape.
I changed it to center the shape itself, as the ruling says ("its own width and height subtracted").

GREEN:

```
$ pnpm vitest run test/ui/ghosts.test.ts test/server/agent/prompt.test.ts
      Tests  29 passed (29)
$ pnpm check
Checked 94 files in 51ms. No fixes applied.
 Test Files  34 passed (34)
      Tests  214 passed (214)
```

No real-login turn was run, as instructed.
Concern 2 is resolved by this ruling, and concerns 1 and 3 were accepted as they are.

## Fix round 1

Findings from `task-11-findings-1.md`, applied as ruled.
Commit: `9dac292 fix(ui): test and guard the bound-arrow listing and arrow ends`.
The deferred item (the plan's Step 1 sketch) is untouched.

### What changed

1. **Bound-arrow listing (Important).**
   `listBoundArrows(elements: readonly El[]): El[]` moved from BoardView.tsx into `src/ui/board/ghosts.ts` as a pure function, and `El` gains optional `boundElements`.
   It adds each live bound arrow to its live ends.
   It skips deleted arrows and deleted targets, never duplicates an entry (ids are collected in a `Set`, and existing entries are skipped), and returns elements that need nothing by identity.
   `throughGhosts` now runs it on the output of `change(...)`, before the version bump.
   So only the elements it actually replaced get bumped, and untouched elements keep their versions.
   It no longer post-processes the restored scene.
2. **Arrow-end guards.**
   An `add_arrow` end that names an existing element goes through the same check as update and delete (a shared `claim(id)`): an unknown id throws `unknown element id …`, and an id held by another pending proposal throws `element … is in pending proposal …`.
   An end that a `delete` op of the same proposal targets throws `op <i>: arrow end <id> is deleted by this proposal`.
3. **Canonical refs.**
   References must match `^\$(0|[1-9]\d*)$` everywhere.
   `checkRefs`, the `applyProposal` validation, `betweenTargets`, and the arrow end lookup all go through `refIndex`, so `$01` is rejected the same way in all of them.
4. **Self-loops.**
   `checkRefs` throws `op <i>: an arrow needs two different ends` when `from === to`, for both element ids and `$` references.
5. **One `$` rule.**
   The new `src/shared/refs.ts` (no zod) exports `isRef(s)` (starts with `$`) and `refIndex(s)` (the index, or null when the ref is not canonical).
   `src/shared/proposals.ts` and `src/ui/board/ghosts.ts` both import it, and `checkRefs` stays in proposals.ts.
   The UI bundle is still free of zod: `grep -c ZodError` on the main chunk gives 0, and the chunk is 2,025.61 kB as before.

### Covering tests

- `test/shared/proposals.test.ts`:
  - `refs are $ and a canonical index, and checkRefs uses exactly that` covers `$0`, `$12`, and the rejects `$`, `$01`, `$-1`, `$1.5`, `$a`, `1`, `$1 `, plus `checkRefs` on `$01`.
  - `checkRefs rejects an arrow whose two ends are the same` covers `a→a` and `$0→$0`.
- `test/ui/ghosts.test.ts`:
  - `an arrow end must not be in another pending proposal or deleted by this one`.
  - `applyProposal reads refs the canonical way only`.
  - `listBoundArrows lists a live bound arrow on both of its ends`.
  - `listBoundArrows never duplicates an entry`.
  - `listBoundArrows skips deleted arrows and deleted targets`.
  - `listBoundArrows keeps unchanged elements by identity`.

### Commands and output

RED:

```
$ pnpm vitest run test/shared/proposals.test.ts test/ui/ghosts.test.ts
   × an arrow end must not be in another pending proposal or deleted by this one
   × applyProposal reads refs the canonical way only
   × listBoundArrows lists a live bound arrow on both of its ends
   × listBoundArrows never duplicates an entry
   × listBoundArrows skips deleted arrows and deleted targets
   × listBoundArrows keeps unchanged elements by identity
Error: Cannot find module '../../src/shared/refs.js' imported from .../test/shared/proposals.test.ts
 Test Files  2 failed (2)
      Tests  6 failed | 22 passed (28)
```

The proposals test file failed at import because `refs.js` did not exist yet, so its two new tests did not run at RED.

GREEN:

```
$ pnpm vitest run test/shared/proposals.test.ts test/ui/ghosts.test.ts
 Test Files  2 passed (2)
      Tests  33 passed (33)
```

The first `pnpm check` failed on one Biome error that I introduced: `lint/suspicious/useIterableCallbackReturn` in the new identity test, where a `forEach` callback returned `expect(...)`.
I rewrote it as a `for … of` loop.
The run after that:

```
$ pnpm check
Checked 95 files in 51ms. No fixes applied.
 Test Files  34 passed (34)
      Tests  222 passed (222)
$ pnpm build 2>&1 | grep -iE 'warn|\(!\)|error'
(!) Some chunks are larger than 500 kB after minification. Consider:
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

Pristine, apart from the chunk-size warning that was already there.
