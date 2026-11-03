The re-review confirmed all twelve findings and found two small regressions. Fix them, in this thread, on branch `m4-runs`:

1. `SessionsView`: other sessions get their own error state, so a good runs load never clears a `listSessions` failure; also ignore a rejection from a load that is no longer the latest (`n !== latest.current`). Test: `listSessions` rejects while `listRuns` resolves later; the other-sessions error stays visible.
2. `manager.ts`: apply the sticky-done rule in the `stopped` case too, so a done or marked-done run stopped while its CLI starts stays done. Test it.

Run `pnpm check` once (pristine), commit with conventional messages and NO co-author trailer, append a "Fix round 3" section to final-fix-report.md, and end with the short status contract only.
