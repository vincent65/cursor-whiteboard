### Finding Verdicts

1. **ADDRESSED.** The definition of done now opens with "1. Create and edit files with the Write and Edit tools, not shell redirection." (`src/server/runs/prompt.ts:28`), and items 2 to 5 are renumbered. The runPrompt test checks the full text and checks that this line is item 1.
2. **ADDRESSED.** `src/server/runs/manager.ts:293` sets `allowDangerouslySkipPermissions: record.permissionMode === "bypassPermissions"`. The launch test asserts `true` and the default-mode permission test asserts `false`.
3. **ADDRESSED.** In the `idle` case, `src/server/runs/manager.ts:357-360` uses the URL from the turn, or else `live.record.prUrl`, or else `markedDone`. The test covers a done run that takes a message and ends a turn with no URL: the statuses are `["done","working","done"]`, the saved record has the same `prUrl`, and `checkGate` passes for a dependent task.
4. **ADDRESSED.** `prUrlIn` (`src/server/runs/prompt.ts:37-57`) handles each line as follows:
   - It removes `**`, a short label followed by a colon and whitespace, and trailing `.,;:!`.
   - It then accepts the bare URL, `<url>`, or `[text](url)`.
   - If no line matches, it falls back to the last URL anywhere in the text, with `(?![\w/])` so `/pull/N/files` is skipped.
   - Because the label needs whitespace after its colon, `https:` is never stripped as a label.

   There is one `test.each` case per wrapped form. A fallback test covers an inline mention, the last of two URLs, and "No PR: …" giving `null`. The one changed existing test follows the ruling: a line URL still wins over an inline one.
5. **ADDRESSED.** Both pre-checks throw `ExistsError` (`src/server/runs/git.ts:30,32`). `git.test.ts` checks the error class. A new route test drives the real `createWorktree` against a worktree that already exists, gets a 409 with the path in the message, and checks that `console.error` is not called.
6. **ADDRESSED.**
   - `launch` stores `relative(root, worktree)` (`manager.ts:105`).
   - `#worktree` resolves the path against the root (`manager.ts:261`). It is used for the session `cwd`, the board-write guard roots (`:268`), and the view (`:189`).
   - Legacy absolute paths resolve to themselves; the restart test keeps `/w/...` records.
   - I checked that no other code in `src` reads `record.worktree`. `RunCard` builds the resume command from the `RunView`, which holds the resolved path.
7. **ADDRESSED.** `list()` catches a `listTasks()` failure, falls back to slugs, and warns once per distinct message (`manager.ts:176-183`). Round 2 added the once-per-message rule as a follow-up from the controller. The launch test covers it.
8. **ADDRESSED, but the fix introduced the regression listed below.** A good load clears the page error (`SessionsView.tsx:105`). A run transcript failure is now stored per run (`:159`, `:170`) and shown inside its card (`RunCard.tsx:207`). A retry clears the old error before it fetches, for both run cards (`:159`) and other-session rows (`:38`). Two new tests cover this.
9. **ADDRESSED.** The result row now reads "Turn done" (`src/ui/panel/TranscriptList.tsx:28`). `ClaudePanel.test.tsx` and `RunCard.test.tsx` were updated.
10. **ADDRESSED.** `manager.ts:397` reads `() => this.#closing || broadcast(...)`. The new test holds a write back until after `close()`, uses a macrotask wait, and asserts that nothing is broadcast.
11. **ADDRESSED.**
    - `markDone` (`manager.ts:153-160`) throws 404 for an unknown run and 409 for any status except idle. For an idle run it saves `markedDone: true` and derives `done`, which patches `endedAt`.
    - The route is at `src/server/runRoutes.ts:64` and answers 204. The card shows the button only for idle runs (`RunCard.tsx:188`).
    - Round 2 saves `markedDone` (`src/server/files.ts:118` defaults it to `false`), so a marked run stays done through a restart and a resume.
    - Tests cover the manager (409, 404, statuses, gate, a later turn, restart then resume), the route (409, 404, 204), the card's per-status table and click, and the SessionsView wiring.
12. **ADDRESSED, as amended by the controller's round-2 ruling** (`final-fix-2.md` item 1). The ruling reversed the "stop propagation from the select" instruction because it was a regression: focus starts in the select, so Escape stopped closing the dialog. A native select's open popup handles its own Escape. `LaunchDialog.tsx` is unchanged from `ff078c0`, and the diff stat confirms it.
    - **Focus return:** `closeLaunch` records the slug (`src/ui/plan/TasksView.tsx:77`), and a callback ref focuses the card's Launch button when it mounts again (`:155-156`).
    - **Gate error:** it has its own state and clears on the next successful check (`:46`, `:71`, `:73`).
    - **Tests:** cover Escape from the focused select, focus return after Cancel and after Escape, and the gate error clearing.

### New Breakage in the Fix Diff

- **Minor, `src/ui/sessions/SessionsView.tsx:105` together with `:113`.** The page-level `error` slot is shared by `listRuns` and `listSessions`. The new `setError(null)` after a good runs load wipes a `listSessions` failure. On first mount both requests race, so a `listSessions` rejection that lands before `listRuns` resolves is never shown. Any later `runs.changed` reload also clears it. The "Other sessions" section is then left empty with no explanation. Fix: give other sessions their own error state, or clear only an error that came from the runs load.
- **Minor, `src/server/runs/manager.ts:364`.** The sticky-done rule is applied only in the `idle` case. `"stopped"` still maps straight to `{ status: "idle" }`. The session emits `stopped` when Stop is pressed while the CLI is still starting (`session.ts:217`), for example on the first message after a restart. So a done run that the user stops in that window drops to idle with `endedAt: null`, and its dependents' gate fails until the next turn ends or the user marks it done. The rule is recoverable and matches the finding's wording ("on idle"), but it does not cover every path where done could be lost. Applying the same rule in the `stopped` case would close the gap.

### Out-of-Scope Observations

- `SessionsView.tsx` `load`: the rejection handler does not check `n === latest.current`, so a slow older request that fails can set an error after a newer request succeeded. This predates the fix; only the success path was touched.
- `#warned` is never cleared. A task file that breaks, is fixed, and breaks again with the same message will not warn the second time. This is negligible.
- A done run whose follow-up turn errors becomes `failed` and has no Mark done button. It recovers through the next message, so it is not blocking.

### Verdict

Fix round: all 12 findings are addressed, finding 12 as amended by the controller's round-2 ruling, and the fix adds no new Critical or Important breakage. The report names the covering tests for each finding, shows their red and green output, and ends with a `pnpm check` at 350 passing tests. The diff agrees with those claims. Two Minor issues came in with the fix, the shared error slot in SessionsView and done not sticking through `stopped`. Both are worth a quick follow-up but do not block this task.
