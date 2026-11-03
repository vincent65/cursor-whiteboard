# Task 3 findings, round 1 (from review thr_u3ygb5ufvt, with controller rulings)

## Important
1. `message()` sends bare text to a session with nothing to resume (a run that failed before init, or whose saved session restore() dropped), so a fresh Claude starts without its task. Ruling: when the live session has no session id, `message()` sends the full run prompt followed by a blank line and the user's text, through the same `#promptInput` path `resume()` uses. Test both cases.
2. The board guard protects only the worktree's copy of the board; `../../boards/main.excalidraw.json` or an absolute path reaches the live board under the repository root. Ruling: run sessions deny a write when the path is protected under either the repository root or the worktree. Implement it as `denyBoardWrites([root, worktree], reason)` (accept a string or an array of roots; resolve relative paths against the hook's cwd as today). Tests: a relative `../../boards/x.excalidraw.json` from the worktree and an absolute root path are both denied; a write inside the worktree's `src/` is allowed.

## Minor (fix in this round)
3. A failed process's spend is lost because error results map to `error` events without cost. Ruling: the `error` PanelEvent gains optional `costUsd`; `SdkEventMapper` sets it from an error result's `total_cost_usd`; the manager adds it to the run's cost like a result. Test: a run that fails after spending shows that cost.
4. No test pins the cost of a multi-turn process. Ruling: add a fake whose `total_cost_usd` grows across two turns of one query and assert the record equals the last total.
5. Rename `INTERRUPTED` to `INTERRUPTED_REASON`.
6. `onEvent` ignores `#closing`. Ruling: ignore events after `close()` began, like `onStatus`.

## Deferred (do not address)
- `start()` restores every run's transcript up front (load lazily when the list grows).
