The task review of your Task 1 work found two Important issues. Fix them now, in this thread, on branch `m0-skeleton` (HEAD is 19520d5; the controller committed a docs change raising the Node floor, see below). Rulings from the controller are in effect:

Ruling A: the Node floor is now 22, not 20 (Node 20 is end of life and the toolchain needs 22). The design and plan have been updated already in commit 19520d5. Do not pin chokidar; keep the latest versions.
Ruling B: `pnpm check` must also typecheck the server build config.

## Findings to address

1. Runtime dependency chokidar@^6.0.0 (package.json:44) needs Node >= 22.22, but `engines` (package.json:8-10) says >=20. vitest 5, jsdom 30 and concurrently 10 also need 22. `engines` must state the real floor. Fix: set `"engines": { "node": ">=22" }`. As part of stating the floor coherently, set `@types/node` to the major that matches it (`^22`), and reinstall so the lockfile follows.
2. `pnpm check` runs `tsc --noEmit -p tsconfig.json` (bundler resolution) but `pnpm build` uses `tsconfig.server.json` (NodeNext), so a server import without a `.js` extension passes check and fails build. Also tsconfig.server.json inherits `types: ["node", "vitest/globals"]`, so server code typechecks as if test globals existed. Fix: add `tsc --noEmit -p tsconfig.server.json` to the `check` script (after the first tsc), and set `"types": ["node"]` in tsconfig.server.json.

## What to do

- Make the changes, run `pnpm install` so the lockfile is consistent, then run `pnpm check` and confirm pristine output. Note: `tsc -p tsconfig.server.json` currently has only `src/shared/types.ts` in scope; that is fine.
- Commit with a conventional message and NO co-author or generated-with trailer, for example `fix: state the Node 22 floor and typecheck the server config in check`. Add only the files you changed (package.json, pnpm-lock.yaml, tsconfig.server.json).
- Append a "Fix round 1" section to your report file /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-1-report.md with: what you changed, the covering command (`pnpm check`) and its output.
- Do not spawn subagents or reviewers.

End your turn with ONLY the short status contract: Status, commits (short SHA + subject), one-line test summary, concerns, report path.
