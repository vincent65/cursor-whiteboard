# untitled (thr_w2syu2tbv5)

- **Status:** DONE_WITH_CONCERNS
- **Commits:**
  - `f1cdee1` fix(server): refuse non-loopback Hosts and cross-origin writes and websocket upgrades
  - `a7cd1c2` fix(server): accept every image type Excalidraw does and sandbox served assets
  - `145a574` fix(ui): save only the files that live image elements use
  - `2b36862` fix(ui): slugify new board and doc names with a rule shared with the server
  - `f716321` fix(ui): ask before leaving a view whose disk conflict would drop local edits
- **Tests:** `pnpm check` passes (both typechecks, Biome, and 62 tests in 14 files). In the browser, "My Board" became `my-board`, and a cross-origin POST, rebinding Host and cross-origin WebSocket upgrade were all refused with 403.
- **Concerns:**
  - The check only accepts a write when `Origin` matches the request's own `Host`; it does not require the server's bound port. Requiring the port would break `pnpm dev`, because the Vite proxy forwards port 5173, and it would add no protection.
  - That one middleware in `createApp` also guards WebSocket upgrades, because they pass through the app too. I didn't add a separate check in `startServer`, and a test against the real server covers it.
  - `slugify` also trims a trailing dash.
  - The `/browse` tool can't start Chromium inside the sandbox, so I used the Playwright browser instead. Its failed start had added `.gstack/` to `.gitignore`; I reverted that and the working tree is clean.
- **Report:** [final-fix-report.md](/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/final-fix-report.md)
