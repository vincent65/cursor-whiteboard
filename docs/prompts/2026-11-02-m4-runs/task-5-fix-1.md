Task 5 is approved. Four small follow-ups, in this thread, on branch `m4-runs`:

1. `listOtherSessions` passes `includeProgrammatic: false` (parity with the terminal `/resume` picker). This hides Blueprint's own split and replaced plan sessions and other headless SDK runs; terminal sessions still appear. Update the test's expected options.
2. Move `sessionRoutes` from `src/server/runRoutes.ts` into `src/server/sessions.ts` and mount it from there.
3. `GET /api/sessions/:id/transcript` returns at most the last 500 events (the panel's limit).
4. `transcriptFrom` uses each message's own timestamp for `at` when the `SessionMessage` carries one (check its type in `sdk.d.ts`; fall back to now). Add one assertion.

Run `pnpm check` once (pristine), commit with conventional messages and NO co-author trailer, append a "Fix round 1" section to your report, and end with the short status contract only.
