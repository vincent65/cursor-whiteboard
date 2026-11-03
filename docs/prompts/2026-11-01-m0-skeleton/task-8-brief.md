### Task 8: CLI

**Files:**
- Create: `src/cli/index.ts`, `src/cli/args.ts`, `src/cli/open.ts`
- Test: `test/cli/args.test.ts`

**Interfaces:**
- Consumes: `FileStore`, `startServer`.
- Produces: `parseArgs(argv: string[]): { command: "serve" | "init"; port: number; open: boolean }` and the `blueprint` binary.

- [ ] **Step 1: Write the failing tests**

```ts
test("defaults to serve on 4242 with open", () => expect(parseArgs([])).toEqual({ command: "serve", port: 4242, open: true }));
test("init, --port and --no-open", () => expect(parseArgs(["init", "--port", "5000", "--no-open"])).toEqual({ command: "init", port: 5000, open: false }));
test("unknown flag throws with the flag name", () => expect(() => parseArgs(["--bogus"])).toThrow("--bogus"));
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run test/cli/args.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the CLI**

`index.ts` starts with `#!/usr/bin/env node`, resolves `root` as `process.cwd()`, runs `store.init()` for both commands, and for `serve` calls `startServer` with `uiDir` resolved relative to the compiled file as `../ui`, prints `Blueprint running at http://localhost:<port>`, and opens the browser unless `--no-open`.
`open.ts` exports `openBrowser(url: string): void` that spawns `open` on darwin and `xdg-open` elsewhere, detached, ignoring failure.
`init` prints `Initialized .blueprint/ in <root>`.
In `pnpm dev` the UI is served by Vite on its own port with the proxy from Task 9; the API server's static route then points at the unbuilt `src/ui` and is simply not used.

- [ ] **Step 4: Run the test and the build**

Run: `pnpm vitest run test/cli/args.test.ts && pnpm tsc -p tsconfig.server.json && node dist/cli/index.js init`
Expected: tests PASS; the build succeeds; `.blueprint/` appears in this repository with the gitignore lines added.

- [ ] **Step 5: Commit**

```bash
git add src/cli test/cli .gitignore
git commit -m "feat(cli): blueprint serve and init commands"
```

---

