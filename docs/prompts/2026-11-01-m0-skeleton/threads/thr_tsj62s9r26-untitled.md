# untitled (thr_tsj62s9r26)

### Spec Compliance
- **Issues found.** A dependency resolved under "latest stable" breaks the global "Node 20 or later" constraint. See Important #1.
- Everything else the brief asks for is present and matches it:
  - `.gitignore` has the exact five lines (`.gitignore:1-5`).
  - `package.json:2-18` has every required field and the five scripts character for character, plus every listed dependency and dev dependency (`package.json:19-48`).
  - Both tsconfigs match the brief except for `skipLibCheck` (`tsconfig.json:9`).
  - `vitest.config.ts:4-9` is exact.
  - `test/setup.ts:1`, `src/shared/types.ts:1` and `test/smoke.test.ts:1-5` match.
- **Deviations, each judged on its merits:**
  - `skipLibCheck: true` (`tsconfig.json:9`): accepted. It is the standard setting. The implementer showed that jest-dom matchers stay typed and that a made-up matcher is still rejected, and pinning vitest to 4 would break "latest stable".
  - `files.includes` with `!!` negations (`biome.json:3-11`): accepted. This is the correct Biome 2 replacement for the brief's Biome 1 key `files.ignore`.
  - `rules.preset: "recommended"` (`biome.json:25-27`): accepted. I could not verify the deprecation claim from the diff.
  - Excluding `docs` from Biome: accepted. Those files are not code.
  - Excluding `.superpowers` from Biome: weak. See Minor #1.
  - Reformatting the smoke test: accepted. The code is unchanged.
- **Cannot verify from diff:**
  - `pnpm build` and `pnpm dev` were never run. `src/cli/index.ts`, `index.html` and a Vite config do not exist yet, so both scripts fail today. That is expected at this stage, but nothing exercises them yet.
  - Whether `biome check` prints no deprecation diagnostics. I accepted the reported output.
  - The lockfile and binary docs are excluded from the diff. `git ls-files` shows `pnpm-lock.yaml` plus the PDF, DOCX and two PNGs are committed (25 tracked files).
  - The commit message and the absence of trailers. The diff header shows only the subject line, which is conventional.

### Strengths
- All five scripts are copied exactly, the `packageManager` is pinned to the installed pnpm version, and every listed dependency is installed.
- The `skipLibCheck` deviation is well investigated. The implementer named the TS2428 root cause, ran a probe test to show matchers stay typed, and documented a way to undo it.
- The Biome 2 config is translated correctly from the brief's Biome 1 key names, and the result is clean.
- The commit is disciplined: no extra source files and no stray `.pnpm-store`. `.DS_Store` and `node_modules` are correctly ignored.

### Issues

#### Critical (Must Fix)
None.

#### Important (Should Fix)
1. **Runtime dependency `chokidar@^6.0.0` (`package.json:44`) needs Node >= 22.22, but `engines` (`package.json:8-10`) and the spec promise Node >= 20.**
   - Check I ran: read `engines` from the installed `node_modules/*/package.json`.
   - Runtime result: `chokidar 6.0.0 {"node":">= 22.22"}`. Every other runtime dependency accepts Node 20.
   - Dev toolchain results: `vitest 5.0.5` needs `^22.12 || ^24 || >=26`, `jsdom 30.1.3` needs `^22.22.2 || ...`, and `concurrently 10.0.6` needs `>=22`.
   - `vite 8.3.5` and `@vitejs/plugin-react 6.1.2` need `^20.19 || >=22.12`, so plain `>=20` is already wrong for 20.0 to 20.18.
   - Effect: a user on Node 20 would install Blueprint and then fail at runtime in the file watcher. A contributor on Node 20 cannot run `pnpm check`, `pnpm test` or `pnpm dev`.
   - The implementer followed "latest stable of each" without checking it against the Node constraint, so the brief carries part of the blame. But the constraint binds this task.
   - Option 1: pin `chokidar` to a version range that supports Node 20. This keeps the promise for end users. The dev toolchain would still need Node 22, so state that separately.
   - Option 2: raise the floor to Node 22 in both `engines` and the spec.
   - Either way, `engines` must state the real floor.
2. **`pnpm check` does not typecheck the build config, so a green check can hide a broken `pnpm build` (plan-mandated).**
   - `check` runs `tsc --noEmit -p tsconfig.json` with `moduleResolution: bundler` (`tsconfig.json:5`, `package.json:15`).
   - `build` uses `tsconfig.server.json`, which switches to `NodeNext` (`tsconfig.server.json:7-8`).
   - Under NodeNext, ESM relative imports need explicit `.js` extensions; bundler resolution does not.
   - So the first server-side `import "./foo"` without an extension passes `pnpm check` and fails `pnpm build`. If it slipped past tsc, it would fail at runtime under `"type": "module"`.
   - Fix: add `tsc --noEmit -p tsconfig.server.json` to `check`.
   - Also, `tsconfig.server.json` inherits `types: ["vitest/globals"]` (`tsconfig.json:10`), so server code typechecks as if test globals existed. Override `types: ["node"]` there.

#### Minor (Nice to Have)
1. **`biome.json:10`, `"!!.superpowers"`, puts orchestration tooling into project lint config, and `.superpowers/` is not gitignored** (`git check-ignore` reports "not ignored").
   - Risk: a later `git add .` commits the orchestrator's briefs.
   - Cleaner fix: add `.superpowers/` to `.gitignore` and enable Biome's `vcs.useIgnoreFile`. That also covers `dist`, so the Biome include list shrinks to the fixtures and docs entries.
2. **`@types/node@^26.6.6` (`package.json:25`) lets code typecheck against Node 26 APIs that are missing on the supported floor.** Match its major version to the `engines` floor once Important #1 settles that floor.
3. **`pnpm install` prints "Ignored build scripts: esbuild@0.28.2".** This is reported noise. Allowlist it (`pnpm.onlyBuiltDependencies: ["esbuild"]`) or explicitly mark it as not needed, so installs are clean.
4. **`test/smoke.test.ts:4` checks a constant against itself (plan-mandated).** It does prove that TS imports, Vitest globals and `setupFiles` are wired up, which is its job. It does not exercise the jest-dom matchers from `test/setup.ts`.
5. **`docs/tech-spec/build.sh:7` and `docs/tech-spec/diagrams/puppeteer.json:1` hardcode a macOS Chrome path, `/tmp`, and `--no-sandbox`.** These are docs tooling outside this task's scope. They are noted because they are now committed.

### Assessment
Task quality: Needs fixes

Reasoning: The scaffold matches the brief closely, and the deviations from current tool versions are well justified. However, the installed dependencies break the project's Node 20 constraint (chokidar 6 needs Node 22.22 at runtime), and `pnpm check` cannot catch server-build resolution failures. Both should be resolved before later tasks build on this base.
