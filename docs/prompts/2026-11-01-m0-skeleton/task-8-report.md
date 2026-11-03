# Task 8 report: CLI

Status: DONE
Commit: `2f6dee1 feat(cli): blueprint serve and init commands`

## What I implemented

- `src/cli/args.ts`: `parseArgs(argv)` returns `{ command, port, open }`.
  The defaults are `serve`, `4242` and `true`.
  It accepts one optional `serve` or `init` positional, `--port <n>` and `--no-open`.
  `--port` throws when the value is missing, is not an integer, or is outside 0-65535.
  An unknown flag throws `unknown flag: <flag>`.
  An unexpected positional, including a second command, throws `unexpected argument: <arg>`.
- `src/cli/open.ts`: `openBrowser(url)` spawns `open` on darwin and `xdg-open` everywhere else.
  The child is detached, its stdio is ignored, and it is unref'd.
  It catches both synchronous throws and the async `error` event, so it never throws.
- `src/cli/index.ts`: starts with `#!/usr/bin/env node` and uses `process.cwd()` as the root.
  Both commands run `FileStore.init()`.
  `init` prints `Initialized .blueprint/ in <root>`.
  `serve` calls `startServer` with `uiDir` set to `../ui` relative to the compiled file (`new URL("../ui", import.meta.url)`).
  It then prints `Blueprint running at http://localhost:<port>` and opens the browser unless `--no-open` is set.
  `main()` runs only when the module is the entry point.
  The check compares `realpathSync(process.argv[1])` with the module path, so an installed bin that is a symlink still works.
  When `main()` fails, it prints the error message to stderr and sets exit code 1. It does not print a stack trace.

## TDD evidence

RED, run before any `src/cli` file existed: `pnpm vitest run test/cli/args.test.ts`

```
 FAIL  test/cli/args.test.ts [ test/cli/args.test.ts ]
Error: Cannot find module '../../src/cli/args.js' imported from .../test/cli/args.test.ts
 Test Files  1 failed (1)
```

GREEN: `pnpm vitest run test/cli/args.test.ts`

```
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

## Build and init (brief Step 4)

`pnpm tsc -p tsconfig.server.json && node dist/cli/index.js init`

```
Initialized .blueprint/ in /Users/vincentyip/programming/cursor-whiteboard
exit 0
```

`.blueprint/` now holds `assets boards docs export tasks worktrees`.
`.gitignore` already contained `.blueprint/export/` and `.blueprint/worktrees/`, so the file did not change and I did not commit it.
The `.blueprint/` directories are empty, so git does not see them and nothing from them was committed.

## Extra manual verification from the compiled output

- `node dist/cli/index.js --port 4317 --no-open` printed `Blueprint running at http://localhost:4317`, and `GET /api/boards` returned 200.
- A second server on the same port printed `listen EADDRINUSE: address already in use 127.0.0.1:4317` and exited with code 1.
- `--bogus` printed `unknown flag: --bogus` and exited with code 1.
- `--port` with no value and `--port abc` each printed a clear message and exited with code 1.
- I called `openBrowser("http://localhost:1")` inside the sandbox, where `open` is blocked, and it did not throw.
- I ran `init` through a symlink to `dist/cli/index.js`, as an installed bin would be, and it exited with code 0.

`pnpm check`: tsc for both projects passed, biome reported no fixes, and vitest reported 9 files and 51 tests passed with no warnings.

## Files changed

- `src/cli/index.ts` (new)
- `src/cli/args.ts` (new)
- `src/cli/open.ts` (new)
- `test/cli/args.test.ts` (new)

## Self-review

- Completeness: `serve` and `init` both work from `dist/`, and the three brief tests exist and pass.
- Quality: `openBrowser` cannot throw.
  CLI errors print a single line, not a stack trace.
- Discipline: only the four listed files changed, and no dependencies were added.
  The CLI output contains no "Claude Code" branding.
- Testing: `pnpm check` output is clean.

## Concerns

- The printed URL uses `localhost` as the brief specifies, while the server binds only to `127.0.0.1`.
  On a machine where `localhost` resolves to `::1` first, browsers fall back to IPv4, so this works.
  A strict IPv6-only client would fail, though.
  Printing `127.0.0.1` would remove that risk if it ever matters.
- There is no `--help` and no `SIGINT` handler.
  Ctrl-C uses Node's default exit, which is fine for M0.
- `dist/ui` does not exist until Task 9.
  Until then, non-API routes return 404, which is expected.
