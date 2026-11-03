### Spec Compliance
- **Spec compliant**, measured against the plan as amended in 174b4dd. The amendment adds the "between" placement rule, moves arrow listing into `BoardView`, and requires labels to have a non-zero size.
- `Op` gains `add_node` (defaults to `kind: "box"`) and `add_arrow` exactly as the brief gives them: `src/shared/proposals.ts:176-188`.
- `referencedIds` skips `$` refs: `src/shared/proposals.ts:227-230`.
- `checkRefs` uses the brief's message: `src/shared/proposals.ts:237-247`.
- Both tools call `checkRefs` before `checkIds`: `src/server/agent/tools.ts:113` and `:146`. The test at `test/server/agent/tools.test.ts:788-802` proves the order by pairing an unknown id `zzz` with a bad `$2`.
- `Revise.title` exists and `revise` falls back to `title: args.title ?? prev.title`: `src/shared/proposals.ts:198`, `src/server/agent/tools.ts:150`.
- `renderNode` is at `src/ui/board/mermaid.ts:695-704`.
- In `applyProposal`:
  - `add_node` places beside the anchor, or between two neighbours: `ghosts.ts:540-563`.
  - Arrows are built last, with border points, both bindings, arrowheads, ghost style, group and tag: `ghosts.ts:604-668`.
  - An arrow label is bound text with `containerId` set: `ghosts.ts:650-667`.
- `listBoundArrows` in `BoardView.tsx:288-307` matches the amended plan.
- The prompt sentence is verbatim: `prompt.ts:65`.
- Every test the brief lists exists:
  - `test/shared/proposals.test.ts:856`. It covers `$0` naming a delete rather than "`$1` naming a delete"; the rule tested is the same.
  - `test/server/agent/proposals.test.ts:747`
  - `test/server/agent/tools.test.ts:777`
  - `test/ui/ghosts.test.ts:972`. This is the "beside" test rewritten for the between rule, and it still asserts `added: 3`.
  - `ghosts.test.ts:1068`
  - `test/ui/mermaid.test.ts:1177`
  - `test/server/agent/prompt.test.ts:721`
- Checks I ran:
  - `biome check` on `BoardView.tsx` and `ghosts.ts` gives "No fixes applied".
  - No co-author trailer on the three commits.
  - The server binds to `127.0.0.1` (`src/server/index.ts:72`), so `crypto.randomUUID` has a secure context.
- **Cannot verify from the diff:**
  - That Excalidraw's restore prunes stale `boundElements` entries for rejected ghost arrows (the report's concern 1 claims it does).
  - That `repairBindings` adds the label to the arrow's `boundElements`. This was verified only in a throwaway test that was deleted, not a committed one.
  - The arrow-label fix and the between placement in the real browser. No real-login run followed fix round 0.

### Strengths
- The validation pass runs before any mutation, so a bad `$` ref or an unknown arrow end leaves the board untouched. `ghosts.test.ts:1068-1095` tests this with a `structuredClone` snapshot.
- `betweenTargets` is pure, exported and thoroughly tested (`ghosts.test.ts:1115-1145`): either op order, a single arrow, two arrows in, the same end on both sides, a `$` end, three arrows, and an unrelated arrow.
- Centering on the shape rather than the shape-plus-label group is correct, and it is tested. The label's top-left lands at (225,15).
- The geometry test for diagonal arrows (`ghosts.test.ts:1052-1066`) checks real border intersections, not mocks.
- The manual run found two real Excalidraw 0.18.1 behaviours, the zero-size label drop and `repairBindings` not listing arrows. Both were fixed, and the plan was amended rather than diverged from silently.
- The server already excludes add-ghosts from `checkIds` (`tools.ts:88-96`), so arrows cannot bind to another proposal's added shapes.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
1. **`listBoundArrows` has no test** (`src/ui/board/BoardView.tsx:288-307`).
   - It is the only thing behind the acceptance criterion "Accept leaves solid bound arrows that follow the boxes when dragged".
   - It runs on every `throughGhosts` call and rewrites (and version-bumps) any element in the scene, user-drawn ones included.
   - That was checked only by hand, once, before fix round 0.
   - It needs nothing from Excalidraw except types. It can operate on `El` (which would need `boundElements` added), so it could live in `ghosts.ts` or `scene.ts` with a unit test covering:
     - both ends get listed;
     - an existing entry is not duplicated;
     - deleted arrows are skipped;
     - an unchanged element keeps its identity, so no version bump.

#### Minor (Nice to Have)
1. **The `$`-reference rule exists twice**: `src/shared/proposals.ts:237-247` and `src/ui/board/ghosts.ts:488-497`.
   - The stated reason is keeping zod out of the UI bundle.
   - That is better solved by moving `isRef`/`checkRefs` into a zod-free shared module that both files import, instead of keeping two copies in sync by comment.
   - `ghosts.ts` also writes `startsWith("$")` inline three times (`:490`, `:613`, `:460`) instead of using one helper.
2. **Arrow ends skip the "element is in pending proposal X" guard** that update and delete enforce (`ghosts.ts:498-503`, against the `add_arrow` branch at `:487-497`).
   - Example: proposal p_2 deletes box X and is still pending. p_1 can then bind an arrow to X.
   - Accepting p_2 leaves p_1's arrow bound to a deleted element.
   - The same thing happens within one proposal: `delete a` together with `add_arrow a→b`.
3. **`$`-ref spelling mismatch**: `betweenTargets` matches the exact string `$${i}` (`ghosts.ts:451`), but `checkRefs` accepts `$01` because `Number("01")` is 1.
   - A `$01` ref therefore validates but silently falls back to beside placement.
   - Tightening the regex to `^\$(0|[1-9]\d*)$` closes the gap.
4. **Self-loops are accepted**: `add_arrow` from an element to itself (`a→a` or `$1→$1`).
   - `borderPoint` then returns the center (`t = 0`), giving a zero-length arrow (`ghosts.ts:438-441`).
   - `checkRefs` or the validation pass could reject `from === to`.
5. **`listBoundArrows` lists arrows on deleted targets too.** `elements.map` does not skip `e.isDeleted`, so a soft-deleted shape can be version-bumped needlessly (`BoardView.tsx:296-306`).
6. **The plan's Step 1 test sketch is now stale.** It still says "b (300,0) … the node lands at x 180" (`docs/superpowers/plans/2026-11-02-m2-proposals.md`, diff lines 49-51), which contradicts the amended between rule just above it.

### Assessment
Task quality: Needs fixes

Reasoning: The requirements are met and the core logic is well tested. The only gap is that the arrow-listing logic, which every proposal runs over the whole board and which makes accepted arrows follow their boxes, has no automated test; it should be moved to a testable spot and covered.
