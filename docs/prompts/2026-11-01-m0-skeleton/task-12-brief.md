### Task 12: Milestone acceptance

**Files:**
- Modify: `package.json` (no change expected), none otherwise.

- [ ] **Step 1: Full check**

Run: `pnpm check`
Expected: typecheck clean, Biome clean, all tests pass.

- [ ] **Step 2: Production run in a scratch repository**

Run:

```bash
pnpm build && mkdir -p /tmp/bp-scratch && cd /tmp/bp-scratch && git init -q && node /Users/vincentyip/programming/cursor-whiteboard/dist/cli/index.js --no-open
```

Then open `http://localhost:4242`, create a board and a doc, draw, type, and confirm the files under `/tmp/bp-scratch/.blueprint/` and the two gitignore lines in `/tmp/bp-scratch/.gitignore`.
Expected: the milestone 0 "done when" row in `docs/build-plan.md` section 8 holds.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix: milestone 0 acceptance fixes"
```

Only if Step 1 or Step 2 required changes.
