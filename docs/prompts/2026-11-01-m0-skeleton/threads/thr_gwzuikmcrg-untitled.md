# untitled (thr_gwzuikmcrg)

### Spec Compliance
- **Spec compliant.** All three source files and the test file from the brief exist.
  - `src/export/schema.ts:3-93` matches the Step 1 schemas field for field, and each schema has a same-named inferred type.
  - `excalidrawToBoardGraph(board: BoardFile, boardName: string): BoardGraph` matches the brief's interface (`src/export/boardGraph.ts:19-22`).
  - `src/export/index.ts:1-2` re-exports everything.
  - Every Step 4 rule maps to code:
    - deleted elements are filtered (`:23`)
    - container labels are trimmed bound text (`:32-35`)
    - the kind map is correct (`:8-15`)
    - edge ends resolve only to live elements (`:36-37`, `:43-44`)
    - arrowheads use `Boolean(...)` (`:47-48`)
    - freedraw and line become loose items (`:53-55`)
    - other types are ignored (`:59`)
    - origin is `"ai"` only when `customData.origin === "ai"` (`:73`)
    - image asset comes from `board.files` (`:75-76`)
- All 8 tests in the brief exist and assert what the brief says (`test/export/boardGraph.test.ts:27-191`).
  - The arrow test uses exact `toEqual`, and the deleted/missing endpoint test uses `r9` deleted and `"nope"` as specified.
- Purity holds. `boardGraph.ts` has only a type import from `./schema.js`, and the only runtime dependency in the module is `zod`.
- The commit message is conventional and has no trailer.
- Checks I ran:
  - `vitest.config.ts` sets `globals: true`, and `tsconfig.json:10` includes `vitest/globals`. So the tests can use `test`/`expect` without importing them.
  - `package.json:47` has zod `^4.6.7`, so `.loose()` is a valid API.
- Cannot verify from the diff alone: the RED/GREEN output and the clean `pnpm check`. I relied on the report for these. The evidence is not truncated and contains no warnings.

### Strengths
- The schema is a verbatim transcription with same-named value and type exports, which is a clean contract for later tasks.
- All lookups go through one `byId` map of live elements, so "deleted" and "missing" are handled by a single code path (`:23-24`, `:36-37`).
- Element IDs pass through untouched, and output order follows element order.
- The tests use realistic element shapes (bindings, `boundElements`, `containerId`, `files`) rather than mocks.
  - The "deleted elements" test asserts the whole graph exactly, so stray output would fail it.
- The report is honest: it raises two judgment calls (frame label, orphaned bound text) instead of hiding them.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
1. **The text-to-container binding is read from two different fields, so a one-sided binding either loses text silently or emits it twice** (`src/export/boardGraph.ts:32-35` vs `:59`).
   - Whether a text element is suppressed depends on the text's own `containerId` (`:59`). The container's label depends on the container's `boundElements` (`:33`).
   - **Case A:** the text has `containerId: "r1"` (live), but `r1` has no `boundElements`. The text is skipped, and `r1.label` is `""`. The text vanishes from the export.
   - **Case B:** `r1.boundElements` lists `t1`, but `t1.containerId` is null. `t1` becomes its own text node and is also `r1`'s label, so the text appears twice.
   - `boundText` also never checks that the referenced text's `containerId === e.id`. A stale `boundElements` entry can borrow another container's text as a label.
   - Why this matters: Excalidraw repairs these inconsistencies when it loads a scene, but this function reads the raw file on disk. Later tasks write boards with `origin: "ai"` elements, and that is exactly where half-written bindings appear.
   - Fix: use one source of truth. Build a `containerId -> text` map from live text elements whose `containerId` is live. Use it both for labels and for deciding suppression.
   - Add a test for each case, plus the orphaned-text case from the report's Concern 2, which has no test today.

#### Minor (Nice to Have)
1. **Element types that match built-in object properties produce a bad kind** (`src/export/boardGraph.ts:8`, `:57`).
   - `NODE_KINDS` is a plain object literal looked up with an arbitrary string. An element with `type: "constructor"` or `"toString"` returns a function, which is truthy, so it becomes a node with a non-enum `kind`.
   - The `.loose()` schema accepts any `type`, and board files can be edited by hand.
   - Fix: use a `Map`, `Object.hasOwn`, or `Object.create(null)`.
2. **`frameId` is not resolved against live elements** (`:71`), even though edge ends are (`:43-44`).
   - A child whose frame is deleted or missing keeps pointing at a frame node that does not exist. Consumers that group nodes by frame would then reference a phantom frame.
   - The brief does not specify this, but the inconsistency is worth settling now: `liveId(e.frameId ?? undefined)`.
3. **Some Step 4 rules have no test:**
   - trimming of labels (no test input has surrounding whitespace)
   - an image whose `fileId` has no `files` entry (asset key omitted)
   - an unnamed frame (`label: ""`)
   - an edge whose bound label text is deleted
   
   Each is one short test and pins behaviour that later tasks depend on.
4. **The nested ternary for the label** (`:65-70`) is readable but would be simpler as a small `labelOf(e, kind)` helper or a switch. This is polish only.

### Assessment
Task quality: Needs fixes

Reasoning: The task matches the brief and is cleanly built. However, reading the text-container binding from two different fields means a one-sided binding silently drops or duplicates text in the export. This should be made consistent and tested before later tasks build on this function.
