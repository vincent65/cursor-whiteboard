The task review of your Task 10 work found one Important issue, which is the Task 9 proxy defect you reported. Fix it now, in this thread, on branch `m0-skeleton`; the controller rules that this task owns the fix.

## Finding to address

- Important #1: `pnpm dev` shows a blank app because of a dev proxy bug in `vite.config.ts` (a Task 9 defect that blocks this task's Step 4 check). The proxy key `"/api"` is a prefix match and also captures the UI module `/api.ts` (`src/ui/api.ts`), which is then served as `application/octet-stream` so the module fails to load and nothing renders. Fix: change the key to `"/api/"` (the `/ws` key is fine) so only API paths are proxied, and confirm `pnpm dev` renders the app and the brief's Step 4 checks pass.

## What to do

- Change the proxy key in `vite.config.ts` from `"/api"` to `"/api/"`. Start `pnpm dev`, confirm the app renders, and re-run the brief's Step 4 checks (autosave within a second; silent reload when clean; banner when dirty). Stop the dev servers afterwards.
- Run `pnpm check` once; output must be pristine.
- Commit with a conventional message and NO co-author or generated-with trailer, for example `fix(ui): proxy only /api/ paths in the dev server`.
- Append a "Fix round 1" section to your report file /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-10-report.md with: what you changed, what you observed under pnpm dev, the command, and its output.
- Do not spawn subagents or reviewers. Do not address other observations beyond this finding.

End your turn with ONLY the short status contract: Status, commits (short SHA + subject), one-line test summary, concerns, report path.
