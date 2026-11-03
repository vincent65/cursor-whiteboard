# untitled (thr_s7y4yvy9bc)

### Spec Compliance
- **Spec compliant.** All three files the brief lists exist, and all three Produces signatures match exactly:
  - `reconcileExternalChange` at `src/ui/docs/reconcile.ts:3-9`
  - `useDebounced<T>(fn, ms): (v: T) => void` at `src/ui/hooks/useDebounced.ts:6-9`
  - `DocView({ name }: { name: string })` at `src/ui/docs/DocView.tsx:49`
- The brief's reconcile test is copied word for word with the same three assertions (`test/ui/reconcile.test.ts:3-13`).
- The useDebounced test matches the brief. It uses `renderHook` and fake timers, makes three calls within 400 ms, checks for no call at 499 ms, then checks exactly one call with `"c"` at 500 ms (`test/ui/useDebounced.test.ts:9-23`).
- Step 3 behaviour is all present:
  - `basicSetup` plus `markdown()`.
  - An update listener that sets dirty and calls the 500 ms debounced save (`DocView.tsx:87-94`, `69-71`).
  - Dirty is cleared only when the saved text equals the current text (`DocView.tsx:62`).
  - A `file-changed` message triggers a `getDoc` and then reconcile (`DocView.tsx:111-125`).
  - `reload` replaces the content.
  - The banner's `Keep mine` saves the local text and `Take theirs` replaces the content (`DocView.tsx:130-141`, `145-157`).
- Extras beyond the brief, all small and justified, none harmful:
  - Line wrapping and a token-based editor theme.
  - Autosave paused while the banner is up (`DocView.tsx:70`).
  - A save-error alert line.
  - A flush of any pending call on unmount in `useDebounced` (`useDebounced.ts:18-26`).
- No new dependencies. No "Claude Code" branding in UI copy.
- Checked out-of-diff: `ServerMessage` (`src/shared/messages.ts`) is a single-member union with `type: "file-changed"`. So filtering only on `kind` and `name` (`DocView.tsx:112`) is correct.
- Checked out-of-diff: `App.tsx:69` mounts `<DocView key={route.name} …>`. So a pending debounced save from one doc cannot be written under another doc's name.
- **Cannot verify from diff:**
  - The commit body: is there really no co-author trailer? The package lists only the commit subject, and I was told not to run git.
  - The Step 4 manual checks: autosave within 1 s, silent reload when clean, banner when dirty. The report describes them in detail, but I did not re-run them.

### Strengths
- `reconcile.ts` is pure and minimal, and checking for equal text first means `noop` takes priority over the dirty state. That is correct.
- The `Transaction.remote` annotation on swapped-in disk text (`DocView.tsx:21-26`, `88-91`) cleanly stops reload and Take theirs from counting as edits or triggering a save.
- The dirty logic is careful:
  - A debounced timer that fires after a reload or Take theirs is skipped, because it re-checks `dirty.current` (`DocView.tsx:70`).
  - A save that was in flight while the user kept typing does not clear dirty (`DocView.tsx:62`).
- Pausing autosave during a conflict closes a real overwrite hole the brief did not mention.
- Lifecycle handling is clean:
  - A `cancelled` flag guards the case where the component unmounts while the doc is still loading.
  - `view.destroy()` runs on cleanup.
  - The WebSocket disposer is returned straight from the effect.
  - The WS handler bails out if `view.current` is null after its `await`.
- `useDebounced` returns a stable function, always calls the latest `fn` through a ref, and keeps the effect dependencies honest without Biome ignores.
- The implementer found and clearly documented a real Task 9 bug instead of hiding it (see Important).

### Issues

#### Critical (Must Fix)
None.

#### Important (Should Fix)
1. **`pnpm dev` shows a blank app because of a dev proxy bug.** This is a Task 9 defect outside this diff, but it blocks this task's Step 4.
   - Evidence: `vite.config.ts` declares `proxy: { "/api": "http://localhost:4242", … }`. I checked the file, and the key is a prefix match, so it also captures the UI module `/api.ts` (`src/ui/api.ts`).
   - The implementer reproduced it: `/api.ts` is served as `application/octet-stream`, the module fails to load, and nothing renders.
   - Every user running the brief's Step 4 command (`pnpm dev`) gets a blank page.
   - Fix: change the key to `"/api/"` (or use a regex key such as `"^/api/"`). Land it as a follow-up commit before Task 11, which needs the same dev loop.

#### Minor (Nice to Have)
1. **The unmount flush is untested.** `useDebounced.ts:18-26` (run a pending call at unmount) is the hook's only data-loss guard, and the report says Task 11 relies on it. No test covers it. One `renderHook(...).unmount()` test that asserts `fn` was called with the pending value would lock it in.
2. **Navigating away while the banner is up silently discards local edits.** The flush calls the save callback, which skips when `conflict !== null` (`DocView.tsx:70`). Disk keeps "theirs" and the user's unsaved text is lost without a prompt. This is acceptable for M0, but worth noting next to report concern #4.
3. **A silent reload replaces the whole document** (`DocView.tsx:21-26`, `122`). The cursor and selection jump, and the change enters undo history. Ctrl+Z after a reload restores the old text and autosaves it over the external edit. Consider adding `addToHistory.of(false)` or applying a minimal diff later.
4. **Out-of-order fetches in the WS handler.** Two quick `file-changed` events start two `getDoc` calls (`DocView.tsx:113`). If they resolve out of order, the editor reloads the older disk text. A sequence counter, or ignoring stale responses, would close this.
5. **The error line misuses an empty-state class.** It reuses `className="empty"` (`DocView.tsx:159`) for an error alert. The load-failure path also shows the raw `err.message` (`DocView.tsx:99`), while save failures get a `Save failed:` prefix.
6. **Banner buttons are unfinished.** They use inline styles with no hover or focus-visible state (`DocView.tsx:37-47`). The report and a `ponytail:` comment acknowledge this, so it is tracked.

### Assessment
Task quality: Needs fixes

Reasoning: The diff is correct and well built, and its contracts match the brief exactly. Before moving on, the one-line `vite.config.ts` proxy fix (`"/api/"`) should land, because without it the brief's own `pnpm dev` check shows a blank app. A one-line unmount-flush test should come with it.
