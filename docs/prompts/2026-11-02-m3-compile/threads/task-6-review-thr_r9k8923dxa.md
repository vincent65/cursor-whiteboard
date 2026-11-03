### Spec Compliance
- Spec compliant, with two deviations that are justified and recorded.
  - `src/ui/App.tsx:82,90` is outside the brief's file list. It is the 2-line wiring of `focus={route.focus}`, and without it the feature cannot be reached or checked by hand. Justified.
  - `BoardView.tsx` (focus effect, `scrollToContent` call) no longer uses the brief's literal `{ fitToViewport: true, animate: true }`. It pins `minZoom`/`maxZoom` to the current zoom when the targets fit, and otherwise uses `viewportZoomFactor: 0.8`, with `canvasOffsets.left` in both cases. This follows the fix-round-0 ruling ("never zoom in"), so it is not drift.
- `focusTargets` matches the brief's signature and behavior (`src/ui/board/focus.ts:2-8`). The brief's test is present verbatim (`test/ui/focus.test.ts:4-12`).
- `BoardView` selects with `CaptureUpdateAction.NEVER` and returns early on an empty target list, as the brief requires.
- `DocView` scrolls to the first heading whose slug matches `focus[0]` and puts the cursor there. A missing slug falls through the loop with no dispatch.
- No jsdom header is needed: `test/ui/focus.test.ts` renders nothing.
- Cannot verify from the diff:
  - That Excalidraw 0.18.1 calls `onChange` only after `initialData` resolves. The `loaded` gate depends on this. The report's manual checks back it up, and I did not open the Excalidraw bundle.
  - That `scrollToContent` respects `minZoom`/`maxZoom` and `canvasOffsets` at runtime. `tsc` accepts the types, and the screenshots `fix0-single.png` and `fix0-wide.png` are the only runtime evidence.

### Strengths
- The `loaded` gate addresses a real race and explains it in a comment: Excalidraw's async `initializeScene` overwrites the selection otherwise (`BoardView.tsx`, comment above `useState(false)`).
- `focus` keeps its identity between renders. I checked `src/ui/hooks/useHashRoute.ts:40-53`: the route is `useState` and changes only on `hashchange`, so the effect does not re-run on unrelated renders.
- Doc slugs come from the same `headingSlugs` the server uses to build its citation index (`src/export/citations.ts:11,25`). I checked that the regex is line-anchored (`/^#{1,6} (.*)$/gm`), so matching one line at a time gives the same slugs as matching the whole document. Neither side de-duplicates slugs, so the client and the server agree.
- Focusing is not an undo step, and the report confirms it does not trigger a save.
- The pure `fitsInView` helper is unit-tested with the cases the ruling named.
- The fixed panel width carries a `ponytail:` comment that names its limit (the phone layout).

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
1. **Shadowed name in `BoardView.tsx`.** The new `loaded` state shares its name with the `loaded: Scene` parameter of `apply` (`const apply = useCallback((loaded: Scene) => ...`) and with the local variable in the load effect (`lastSaved.current = saveState(loaded.elements, ...)`). Readers have to track which `loaded` is the boolean. Renaming the state to `sceneReady` would remove the ambiguity.
2. **The doc heading lookup is untested.** The loop in the `DocView.tsx` focus effect is new logic with no test. Pulling it out as a pure `headingLine(doc, slug)` next to `focusTargets` would make it one assertion to cover. The brief does not require this.
3. **`setLoaded(true)` runs on every `onChange`.** Excalidraw fires `onChange` on every pointer move, and React usually skips the update when the value is unchanged. Checking a ref before calling `setLoaded` would make that explicit, but the cost today is negligible.
4. **Recreating the editor does not re-apply focus.** If the `[name, save]` effect in `DocView` ever recreates the editor with the same `name`, `loaded` stays `true` and the focus effect does not run again. This cannot happen today because `DocView` is keyed by `name` and `save` is stable, so it is only a latent issue.

### Assessment
Task quality: Approved

Reasoning: All the required behavior is present and matches the brief and the fix-round ruling. The tests cover the pure helpers, and the only findings are readability and test-coverage polish.
