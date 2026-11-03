The task review of your Task 4 work found one Important issue. Fix it now, in this thread, on branch `m1-claude-panel`.

## Finding to address

- Important #1: The hub loses the board's selection on reconnect, and nothing sends it again (src/ui/api.ts:85-96, src/ui/board/BoardView.tsx:152-159). The hub learns its active socket and `activeBoard` only from `selection.changed`; `reportedIds` sends only on change and `connectWs` re-sends a selection only if it was queued while the socket was down. After a server restart the new hub has `activeBoard === null` until the selection changes, so a later `get_selection` has ids with no board, and with several tabs requests go to the wrong socket. Fix: `connectWs` keeps the last `selection.changed` it sent and sends it again on every `onopen`, not only when queued. Related: a freshly mounted board with an empty selection never announces itself because `reportedIds` starts as `[]`; start it as `null` so the first report always goes out. Add a test in the server-events test for the re-send on reconnect.

## What to do

- Make the change in `src/ui/api.ts` (`connectWs` remembers the last `selection.changed` and re-sends it on every open) and `src/ui/board/BoardView.tsx` (`reportedIds` starts as `null`). Extend `test/ui/server-events.test.tsx` with a reconnect case asserting the last selection is sent again after `onopen` fires on the new socket.
- Run the covering test files, then `pnpm check` once; output must be pristine.
- Commit with a conventional message and NO co-author or generated-with trailer, for example `fix(ui): re-announce the board selection on every reconnect`.
- Append a "Fix round 1" section to your report file /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-4-report.md with: what you changed, the covering tests, the command, and its output.
- Do not spawn subagents or reviewers. Do not address other observations beyond this finding.

End your turn with ONLY the short status contract: Status, commits (short SHA + subject), one-line test summary, concerns, report path.
