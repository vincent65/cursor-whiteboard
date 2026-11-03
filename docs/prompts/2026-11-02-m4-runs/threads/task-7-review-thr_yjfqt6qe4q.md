### Spec Compliance
- Issues found: one deliberate deviation from the brief, nothing missing.
  - **"Launched" was not built (deviation).** The brief says the card button reads `Launched` and is disabled only while a run is `working` or `needs_you`. Instead, any task with a run of any status shows a `View run` link (`src/ui/plan/TasksView.tsx:260-263`), so `Launched` never appears.
  - **The deviation looks correct.** I checked `src/server/runs/git.ts:17-31`: `createWorktree` refuses when the worktree or `blueprint/<slug>` branch already exists. So the brief's version would have shown an enabled `Launch` on `done`, `failed` and `interrupted` cards that always fails on the server.
  - **Consequence to note:** a failed or interrupted run cannot be retried from the UI. That is an M4 product gap outside this task's scope.
- Everything else in the brief is present:
  - Gate reasons are mapped to the brief's wording (`src/ui/plan/LaunchDialog.tsx:25-29`).
  - The mode select defaults to `acceptEdits` and offers `default` and `bypassPermissions` (`:31-43`, `:60`).
  - `Launch anyway` shows only when the gate fails (`:122-131`).
  - `Launch` stays disabled while the gate fails and the override is off (`:141`).
  - `Cancel` works (`:146`).
  - A successful launch navigates to `#/sessions` (`TasksView.tsx:231-233`).
- Both tests the brief names exist with the exact titles and check what the brief says:
  - `test/ui/LaunchDialog.test.tsx:362` checks the reason wording, the default mode, the disabled `Launch` until the override is checked, and the `onLaunch("default", true)` call.
  - `test/ui/TasksView.test.tsx:536` checks the `gate("auth")` call, the `launchRun` body with the chosen mode, the `#/sessions` hash, and that the dialog closes.
- The extras (in-flight guard, error alert, Escape to close, focus on open, mode explanations, `View run` link) are small and follow from the brief.
- Cannot verify from diff:
  - That the controller approved the `View run` deviation. I only have the implementer's word for it.
  - The `pnpm check` and `pnpm build` results, which come from the report only.
  - That `api.gate`, `api.listRuns` and `api.launchRun` exist with these signatures. They come from earlier tasks.

### Strengths
- The dialog stays a plain component: the gate result and `onLaunch` are passed in, so it can be tested without mocking the API.
- The in-flight guard (`LaunchDialog.tsx:62,141`) prevents a double POST, and a failed launch re-enables `Launch` with the server's message shown (`:74-76`). Both are tested.
- The ran-slug set reloads on `runs.changed` (`TasksView.tsx:238`), and a test covers the button flipping to `View run`.
- The CSS reuses existing classes (`.run-input`, `.run-actions`, `.plan-error`, `.button`).
- The jsdom pragma is present in the new test file.
- The UI copy has no "Claude Code" branding.
- The reason mapping is a typed `Record` keyed by `MissingDependency["reason"]`, so a new server reason code breaks the type check.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None. This assumes the controller confirms the `View run` deviation. If they did not, it is a missed requirement. Even then, the server constraint in `git.ts:29-31` makes the implemented behaviour the better one, so I would record it in the plan rather than revert it.

#### Minor (Nice to Have)
1. **Gate errors never clear.** `TasksView.tsx:199,223`: a failed gate check sets the shared `error`, which only clears on the next `split.status` event. The alert stays after the user retries `Launch` and the gate succeeds. Fix: call `setError(null)` on a successful gate, or keep a separate launch error.
2. **The branch name is hard-coded in the UI.** `LaunchDialog.tsx:91` builds `blueprint/{slug}`, duplicating the server's naming convention. It is harmless while the convention holds, but it will drift silently if the convention changes.
3. **The gate can go stale.** `TasksView.tsx:220-224`: the gate result is a snapshot taken when the dialog opens. If a dependency's run finishes while the dialog is open, it still says blocked. This only costs the user an override click, assuming the server re-checks the gate on launch.
4. **Async assertion may be fragile.** `test/ui/TasksView.test.tsx:564`: `expect(location.hash).toBe("#/sessions")` runs right after `user.click`, but the hash is set after an awaited `launchRun`. It passes because userEvent's internal delay flushes microtasks. Wrapping it in `waitFor` would make it robust.
5. **Escape bubbles from inside the select.** `LaunchDialog.tsx:85`: pressing Escape to dismiss an open native `<select>` can bubble up and close the whole dialog.
6. **Focus is lost on close.** After `Cancel` or Escape, focus falls to `body` instead of returning to the card's `Launch` button. The implementer already acknowledged this.

### Assessment
Task quality: Approved
Reasoning: The brief's dialog behaviour and both named tests are implemented correctly, and the `View run` deviation matches a real server constraint (`git.ts:29-31`). The remaining items are polish.
