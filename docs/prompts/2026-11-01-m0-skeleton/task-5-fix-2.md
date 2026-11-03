The scoped re-review of your Task 5 fix found that the finding is NOT addressed: the new canonical regex is correct on small inputs but overflows V8's stack on payloads of about 4 MB and up, so normal large images can no longer be saved. Fix round 2, in this thread, on branch `m0-skeleton`. Controller ruling: strictness by decode-and-re-encode equality satisfies the brief's "strict regex" requirement; do not use a repeated-group regex.

## Finding to address

- Important #1 (open from round 1): base64 validation must be strict (reject truncated or non-canonical payloads such as `AAAAA`, `AAAA==`, `AB`) AND must not break real images. The round-1 regex `(?:[A-Za-z0-9+/]{4})*(?:...)` overflows V8's stack on payloads of about 4 MB and up (RangeError: Maximum call stack size exceeded), so images Excalidraw allows by default (up to 4 MB, about 5.3 MB encoded) can no longer be saved and the error is not an InvalidSceneError. Fix: keep a linear character-class regex for the alphabet and padding shape, decode with `Buffer.from(payload, "base64")`, and require `bytes.toString("base64") === payload`, throwing InvalidSceneError otherwise. Add a test that writes an image whose payload is at least 5 MB and expects success, with the asset written and the sha256 matching.

## What to do

- In `src/server/files.ts`: validate the payload with a linear character-class pattern such as `^[A-Za-z0-9+/]+={0,2}$`, decode it, and require `decoded.toString("base64") === payload`; otherwise throw InvalidSceneError before anything is written.
- In `test/server/files.test.ts`: keep the malformed cases (`AAAAA`, `AAAA==`, `AAAA=====`, `AB`, `***`) rejecting with nothing written, and add a test that saves a board whose image payload is at least 5 MB of random bytes base64-encoded and expects success: the asset file exists, its sha256 matches, and the stored reference is correct.
- Run the covering test file, then `pnpm check` once; output must be pristine.
- Commit with a conventional message and NO co-author or generated-with trailer, for example `fix(server): strict base64 check that scales to large images`.
- Append a "Fix round 2" section to your report file /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-5-report.md with: what you changed, the covering tests, the command, and its output.
- Do not spawn subagents or reviewers.

End your turn with ONLY the short status contract: Status, commits (short SHA + subject), one-line test summary, concerns, report path.
