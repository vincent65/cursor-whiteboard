The task review of your Task 5 work found one Important issue. Fix it now, in this thread, on branch `m0-skeleton`.

## Finding to address

- Important #1: The base64 check is not strict, so a truncated or corrupt image is stored silently (src/server/files.ts:48,153). The regex `[A-Za-z0-9+/]+=*` accepts any length and any number of `=`; `Buffer.from(..., "base64")` silently drops leftovers, so `AAAAA`, `AAAA=====`, and `AB` all pass and decode to garbage that is then stored under a valid-looking sha256 name with no error. The brief requires "base64 is validated with a strict regex before decoding". Fix: use a canonical base64 regex such as `(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?` for the payload (anchored, non-empty), and add `AAAAA` and `AAAA==` cases to the malformed-dataURL test, asserting InvalidSceneError and that nothing is written.

## What to do

- Make the fix in `src/server/files.ts` and extend the malformed-dataURL test in `test/server/files.test.ts` with the `AAAAA` and `AAAA==` payloads (each must reject with InvalidSceneError, leave the board bytes unchanged, and write nothing to assets/). Keep the valid-payload tests passing.
- Run the covering test file, then `pnpm check` once; output must be pristine.
- Commit with a conventional message and NO co-author or generated-with trailer, for example `fix(server): validate base64 strictly before extracting assets`.
- Append a "Fix round 1" section to your report file /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-5-report.md with: what you changed, the covering tests, the command, and its output.
- Do not spawn subagents or reviewers. Do not address other observations beyond this finding.

End your turn with ONLY the short status contract: Status, commits (short SHA + subject), one-line test summary, concerns, report path.
