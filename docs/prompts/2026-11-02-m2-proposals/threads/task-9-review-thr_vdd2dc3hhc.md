### Spec Compliance
- Spec compliant. I checked each item in the brief against the diff:
  - **Stopped row:** reads `Stopped · $<cost> total` (`src/ui/panel/ClaudePanel.tsx:52-57`), and the test asserts `"Stopped · $0.0200 total"` (`test/ui/ClaudePanel.test.tsx:131`).
  - **Selection-header regex:** `SELECTION_HEADER`, `UserMessage`, the `.msg-user-note` CSS and the header-stripping assertions are all removed. The restored transcript fixture now uses plain text (`test/ui/ClaudePanel.test.tsx:75`).
  - **Refine chip:** while `target` is set, the chip reads `Refining <id> · <title>` with an `×` button labelled `Clear refine` (`ClaudePanel.tsx:216-236`). The `×` clears the target and focuses the textarea. A send passes `target?.id` as the third `agentSend` argument and clears the target once the send resolves (`ClaudePanel.tsx:146-152`).
  - **Required tests:** both exist and assert what the brief asks.
    - "a refine target shows a chip, sends the proposal id, and clears" checks the chip text, the call `("tighter", undefined, "p_1")`, and that the chip is gone afterwards.
    - "the chip's × clears the target without sending" checks that `agentSend` is not called.
  - **Tool rows for `propose` and `revise`:** the brief says these already work through `summarizeTool`, so this task needed no change there.
- **Extras, all reasonable:**
  - A failed send keeps the target.
  - The chip has a no-title form.
  - The textarea also gets focus when a target is set.
  - The plain-send test now expects a third argument of `undefined`.
  - None of these conflict with the brief.
- **Cannot verify from the diff:**
  - **App wiring:** I checked that `src/ui/App.tsx:16-18` wraps the app in `RefineProvider` and that `<ClaudePanel />` renders inside it at `:97`. Without the provider, `useRefine` would quietly fall back to a no-op setter.
  - **CSS variable:** I checked that `--surface` exists (`styles.css:7`), because `.chip-clear:hover` depends on it.
  - **Check, build and live send:** I am relying on the report for `pnpm check` and `pnpm build`. The live send against a logged-in Claude session was not exercised; the report says so.

### Strengths
- The removal is clean: the dead regex, its component, its CSS and its test assertions all went in the same commit.
- The send path keeps the existing "a failed send loses nothing" behaviour, and the new test proves the chip survives a rejected send and is cleared after the retry succeeds.
- Clicking `×` moves focus to the textarea. Without that, focus would fall to `body` when the button unmounts.
- The chip is accessible: `aria-label="Clear refine"`, a `:focus-visible` outline, and a hover state.
- The CSS handles long titles. `.chip-label` ellipsizes with `min-width: 0`, the button has `flex-shrink: 0`, and `.chips` wraps with a gap so both chips can show at once.
- The tests drive real `RefineProvider` state through a test button rather than mocking the context.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
1. **A send that resolves can clear a newer target** (`src/ui/panel/ClaudePanel.tsx:151`).
   - The implementer flagged this themselves.
   - `send()` captures `target` when it starts, and `if (target) setTarget(null)` runs after the await, so it clears whatever target is current at that moment.
   - Example: the user sends a refinement for `p_1`, then clicks Refine on `p_2` before the HTTP call returns. The `p_2` chip disappears, and the next message goes out without a proposal id.
   - The window is short, but the failure is silent: the refinement would land as a fresh prompt.
   - Fix: use a functional update that only clears when `current?.id === sent.id`. This needs `setTarget` to accept an updater; its type is currently `(t: RefineTarget | null) => void` (`src/ui/panel/refine.tsx:8`).
2. **The chip can name a proposal that is already decided** (`ClaudePanel.tsx:216`).
   - The target stays set if the proposal is accepted or rejected while the chip is showing, so the next message carries a stale `proposalId`.
   - The brief does not ask for this, so I am noting it for the whole-branch review rather than this task.
3. **The selection-plus-refine combination is untested** (`test/ui/ClaudePanel.test.tsx:268-275`).
   - `renderRefine` has no `SelectionProvider`, so no test sends with both a selection and a proposal id, and none shows both chips together.
   - The brief's `<selection or undefined>` allows this, but the combination is the realistic case. The board's Refine flow probably selects the ghost, which the report's manual check also saw.

### Assessment
Task quality: Approved

Reasoning: The diff delivers every requirement in the brief, with tests that check real behaviour and careful focus and overflow handling. The remaining issues are a narrow race the implementer already disclosed and test-coverage polish.
