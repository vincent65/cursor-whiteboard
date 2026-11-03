### Task 1: Repository bootstrap

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.server.json`, `biome.json`, `vitest.config.ts`, `.gitignore`, `src/shared/types.ts`
- Test: `test/smoke.test.ts`

**Interfaces:**
- Produces: `pnpm check` (typecheck, lint, tests), `pnpm test`, `pnpm build`, `pnpm dev` scripts; path layout `src/{cli,server,export,ui,shared}` and `test/`.

- [ ] **Step 1: Initialize git state and ignore files**

`.gitignore` contents:

```
node_modules/
dist/
.DS_Store
.blueprint/export/
.blueprint/worktrees/
```

- [ ] **Step 2: Write `package.json`**

Fields the implementer must set: `"name": "blueprint"`, `"private": true`, `"type": "module"`, `"bin": { "blueprint": "dist/cli/index.js" }`, `"engines": { "node": ">=20" }`, `"packageManager": "pnpm@<installed version>"`.
Scripts:

```json
{
  "dev": "concurrently -n server,ui \"tsx watch src/cli/index.ts --no-open\" \"vite\"",
  "build": "tsc -p tsconfig.server.json && vite build",
  "check": "tsc --noEmit -p tsconfig.json && biome check . && vitest run",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Dependencies: `hono`, `@hono/node-server`, `@hono/node-ws`, `chokidar`, `zod`, `react`, `react-dom`, `@excalidraw/excalidraw`, `codemirror`, `@codemirror/lang-markdown`, `@codemirror/state`, `@codemirror/view`.
Dev dependencies: `typescript`, `tsx`, `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@biomejs/biome`, `concurrently`, `@types/node`, `@types/react`, `@types/react-dom`.
Use the latest stable of each.

- [ ] **Step 3: Write the TypeScript configs**

`tsconfig.json`: `strict: true`, `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `jsx: react-jsx`, `noEmit: true`, `include: ["src", "test"]`, `types: ["node", "vitest/globals"]`.
`tsconfig.server.json`: extends base, `noEmit: false`, `outDir: dist`, `rootDir: src`, `module: NodeNext`, `moduleResolution: NodeNext`, `include: ["src/cli", "src/server", "src/export", "src/shared"]`.

- [ ] **Step 4: Write `biome.json` and `vitest.config.ts`**

Biome: recommended rules, formatter with 2-space indent and double quotes, `files.ignore` for `dist` and `test/export/fixtures`.
Vitest: `environment: "node"`, `globals: true`, `include: ["test/**/*.test.ts", "test/**/*.test.tsx"]`, `setupFiles: ["test/setup.ts"]`.
Create `test/setup.ts` containing the single line `import "@testing-library/jest-dom/vitest";`.

- [ ] **Step 5: Write the shared types stub and the smoke test**

`src/shared/types.ts` exports `export const APP_NAME = "Blueprint";`.
`test/smoke.test.ts`:

```ts
import { APP_NAME } from "../src/shared/types";
test("smoke", () => { expect(APP_NAME).toBe("Blueprint"); });
```

- [ ] **Step 6: Install and run the check**

Run: `pnpm install && pnpm check`
Expected: typecheck clean, Biome clean, 1 test passed.

- [ ] **Step 7: Commit**

```bash
git add .gitignore package.json pnpm-lock.yaml tsconfig.json tsconfig.server.json biome.json vitest.config.ts src/shared/types.ts test/setup.ts test/smoke.test.ts docs/
git commit -m "chore: bootstrap blueprint package and commit design docs"
```

---

