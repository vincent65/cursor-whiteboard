# Task 1 report: Repository bootstrap

Status: DONE_WITH_CONCERNS

Commit: `c4e3df3 chore: bootstrap blueprint package and commit design docs` on branch `m0-skeleton`.
The commit message is the subject line only.
It has no trailers.

## What I implemented

- `.gitignore` with the exact five lines from the brief.
  It also covers `docs/.DS_Store` and the root `.DS_Store`, and neither one was committed.
- `package.json` has `name`, `private`, `type: module`, `bin`, `engines`, `packageManager: pnpm@10.30.1` (the installed version), the five scripts copied exactly from the brief, and every listed dependency and dev dependency.
  pnpm added each one with a `^` range.
- `tsconfig.json` uses the brief's values plus `skipLibCheck: true` (see Concerns).
- `tsconfig.server.json` uses the brief's values exactly and extends `./tsconfig.json`.
- `biome.json` uses the Biome 2.6 schema, `files.includes` with negations, 2-space indent, double quotes, and the recommended preset (see Concerns).
- `vitest.config.ts` uses the brief's values exactly.
- `test/setup.ts` is the single jest-dom/vitest import line.
- `src/shared/types.ts` exports `APP_NAME = "Blueprint"`.
- `test/smoke.test.ts` has the brief's test, formatted by Biome (see Concerns).
- `docs/` is committed in full (16 files).

## Environment

- `node --version`: v22.23.1
- `pnpm --version`: 10.30.1 (already on PATH, so corepack was not needed)

## Dependency versions installed (latest stable at install time)

Dependencies:

| Package | Version |
| --- | --- |
| @codemirror/lang-markdown | 6.5.2 |
| @codemirror/state | 6.7.6 |
| @codemirror/view | 6.43.15 |
| @excalidraw/excalidraw | 0.18.1 |
| @hono/node-server | 2.1.5 |
| @hono/node-ws | 1.3.1 |
| chokidar | 6.0.0 |
| codemirror | 6.0.2 |
| hono | 4.13.16 |
| react | 19.3.1 |
| react-dom | 19.3.1 |
| zod | 4.6.7 |

Dev dependencies:

| Package | Version |
| --- | --- |
| @biomejs/biome | 2.6.4 |
| @testing-library/jest-dom | 7.0.1 |
| @testing-library/react | 16.3.3 |
| @testing-library/user-event | 14.6.8 |
| @types/node | 26.6.6 |
| @types/react | 19.3.0 |
| @types/react-dom | 19.3.0 |
| @vitejs/plugin-react | 6.1.2 |
| concurrently | 10.0.6 |
| jsdom | 30.1.3 |
| tsx | 4.23.15 |
| typescript | 7.0.2 |
| vite | 8.3.5 |
| vitest | 5.0.5 |

## Check output

Command: `pnpm install && pnpm check`.
The final `pnpm install` finished in 347ms as a no-op against the lockfile.
Final `pnpm check` output:

```
> blueprint@ check /Users/vincentyip/programming/cursor-whiteboard
> tsc --noEmit -p tsconfig.json && biome check . && vitest run

Checked 8 files in 23ms. No fixes applied.

 RUN  v5.0.5 /Users/vincentyip/programming/cursor-whiteboard


 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  22:10:16
   Duration  236ms (setup 79%, transform 15%, worker 3%, import 2%, tests 1%)
```

The typecheck is clean, Biome is clean, and 1 test passed.

Other checks:

- `tsc -p tsconfig.server.json --outDir $TMPDIR/srvout` emitted `shared/types.js`, so the NodeNext server config compiles.
- `tsx -e 'import("./src/shared/types.ts")...'` printed `Blueprint`.
- I did not run `pnpm build`, because `vite build` has no `index.html` or UI entry until a later task.

## Files changed

`.gitignore`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `tsconfig.server.json`, `biome.json`, `vitest.config.ts`, `src/shared/types.ts`, `test/setup.ts`, `test/smoke.test.ts`, and everything under `docs/`.
The commit has no other files.

## Concerns and deviations from the brief

1. **`skipLibCheck: true` added to `tsconfig.json`.**
   The latest stable versions, vitest 5.0.5 and @testing-library/jest-dom 7.0.1, conflict in their type declarations.
   Vitest 5 declares `Assertion<R, T>`.
   jest-dom's `types/vitest.d.ts` still augments `Assertion<T = any>`.
   As a result, `tsc` fails with TS2428 ("All declarations of 'Assertion' must have identical type parameters") inside `node_modules`.
   I checked the registry and found no jest-dom release with a fix (latest 7.0.1, beta tag 5.7.0-beta.1).
   I tested `skipLibCheck` with a temporary probe test.
   `expect(el).toBeInTheDocument()` typechecks, and a made-up matcher is rejected with TS2551.
   The matchers therefore stay fully typed.
   jest-dom's `T` lands on Vitest's `R` (the return type), which is also correct in meaning.
   `skipLibCheck` is the default in Vite's own templates.
   The alternative was to pin vitest to 4.1.12, which conflicts with "latest stable".
   If the reviewer prefers strict lib checking, pinning `vitest@^4` is the switch.
   When jest-dom ships Vitest 5 types, removing `skipLibCheck` is optional.
2. **Biome `files.includes` also excludes `docs` and `.superpowers`.**
   Biome 2.6 formats Markdown and lints CSS, so `biome check .` failed on the committed design docs and on the orchestrator's untracked `.superpowers/` briefs.
   It wanted to reformat tables and flagged `!important` in `docs/tech-spec/diagrams/style.css`.
   Those are not code and should not be reformatted by Biome.
   Final value: `["**", "!!**/dist", "!!test/export/fixtures", "!!docs", "!!.superpowers"]`.
3. **Biome uses `rules.preset: "recommended"`, not `rules.recommended: true`.**
   Biome 2.6.4 marks `recommended` as deprecated and prints a DEPRECATED diagnostic on every run.
   `preset` is the replacement it suggests, and it keeps the output clean.
4. **Smoke test formatting.**
   The brief's one-line `test(...)` body is not Biome-formatted, and it is missing the blank line after imports.
   I applied `biome check --write`, which changed only the layout, not the code.
5. **pnpm 10 skipped the esbuild postinstall script** ("Ignored build scripts: esbuild@0.28.2").
   Nothing breaks: esbuild's platform binary comes in through optional deps, and tsx runs fine.
   I did not add an `onlyBuiltDependencies` allowlist, because the brief does not list one.
   The warning appears during `pnpm install` but not in `pnpm check`.
6. **Sandbox notes (environment only, not the project).**
   The first install inside the agent sandbox failed with EPERM, because the sandbox blocks writing `.idea` paths that come from the iconv-lite tarball.
   The sandbox also forced pnpm to create a `.pnpm-store/` inside the repo.
   I deleted `.pnpm-store/` and `node_modules`, then re-ran the install outside the sandbox so pnpm used its normal global store.
   No stray files remain.
7. pnpm reports that 12.16.1 is available, but I kept the installed 10.30.1 in `packageManager` as the brief says.

## Self-review

- Completeness: every file in the brief exists with the specified contents, apart from the deviations listed above.
  The scripts match the brief character for character.
- Discipline: there are no extra files or dependencies.
  `git status --short` is clean after the commit.
  `.DS_Store`, `docs/.DS_Store`, `node_modules/` and `.superpowers/` are ignored.
  The package metadata and copy contain no Claude Code branding.
- Testing: `pnpm check` passes with clean output.

## Fix round 1

Commit: `fix: state the Node 22 floor and typecheck the server config in check` (no trailers).

### Changes

- `package.json`: `engines.node` changed from `>=20` to `>=22` (Ruling A).
  chokidar 6, vitest 5, jsdom 30 and concurrently 10 all need Node 22.
  chokidar was not pinned.
- `package.json`: `@types/node` changed from `^26.6.6` to `^22.20.5` (installed with `pnpm add -D @types/node@^22`), so the types match the floor.
- `package.json`: the `check` script is now `tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.server.json && biome check . && vitest run` (Ruling B).
- `tsconfig.server.json`: added `"types": ["node"]`, so server code no longer sees the vitest globals.
- `pnpm-lock.yaml`: regenerated by `pnpm add`.
  A follow-up `pnpm install` was a no-op (354ms).

### Verification

`pnpm check`:

```
> blueprint@ check /Users/vincentyip/programming/cursor-whiteboard
> tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.server.json && biome check . && vitest run

Checked 8 files in 23ms. No fixes applied.

 RUN  v5.0.5 /Users/vincentyip/programming/cursor-whiteboard


 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  22:14:07
   Duration  233ms (setup 81%, transform 13%, worker 3%, import 2%, tests 1%)
```

I also checked that the new step catches the problem the review described.
I added a temporary `src/server/probe.ts` containing `export { APP_NAME } from "../shared/types";`.
It passes the base config.
The server config rejects it with TS2835 ("Relative import paths need explicit file extensions ... Did you mean '../shared/types.js'?").
I deleted the probe file afterwards.

### Concerns

None new.
The earlier notes (`skipLibCheck`, the esbuild build script) still apply.
