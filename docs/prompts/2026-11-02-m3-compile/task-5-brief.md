### Task 5: Routes, API client, sidebar, and the Compile button

**Files:**
- Modify: `src/ui/hooks/useHashRoute.ts`, `src/ui/api.ts`, `src/ui/nav/Sidebar.tsx`, `src/ui/panel/ClaudePanel.tsx`, `src/ui/App.tsx`
- Test: `test/ui/useHashRoute.test.ts`, `test/ui/Sidebar.test.tsx`, `test/ui/ClaudePanel.test.tsx`

**Interfaces:**
- Produces in `src/ui/hooks/useHashRoute.ts`:

```ts
export type Route =
  | { kind: "board" | "doc"; name: string; focus?: string[] }   // focus from ?focus=a,b (URL-decoded, empty entries dropped)
  | { kind: "spec" } | { kind: "tasks" } | null;
export function routeHash(route: Exclude<Route, null>): string;  // the inverse, e.g. "#/boards/main?focus=a,b", "#/spec"
```

- Produces in `src/ui/api.ts`: `getSpec(): Promise<{ text: string | null; dropped: Citation[] }>`, `listTasks(): Promise<TaskFile[]>`, `agentCompile(): Promise<{ id: string }>`, `agentSplit(): Promise<void>` (throws with the server's message on 404 or 409).
- Sidebar gains a `Plan` section with `Spec` and `Tasks` links (`#/spec`, `#/tasks`), active when the route matches.
- `ClaudePanel` header gains a `Compile` button that calls `agentCompile()`, disabled while the status is `starting`; `App` renders `SpecView` and `TasksView` (Task 7) for the new routes.

- [ ] **Step 1: Write the failing tests**

```ts
test("parses focus and the plan routes, and routeHash inverts them", ...);
test("the sidebar shows Spec and Tasks links", ...);
test("Compile calls agentCompile", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/ui/useHashRoute.test.ts test/ui/Sidebar.test.tsx test/ui/ClaudePanel.test.tsx`
Expected: FAIL on the new tests.

- [ ] **Step 3: Implement** (stub `SpecView` and `TasksView` imports are not allowed; `App` wires them in Task 7, so leave `App` routing for `spec`/`tasks` rendering a placeholder paragraph here)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/ui`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/hooks/useHashRoute.ts src/ui/api.ts src/ui/nav/Sidebar.tsx src/ui/panel/ClaudePanel.tsx src/ui/App.tsx test/ui/useHashRoute.test.ts test/ui/Sidebar.test.tsx test/ui/ClaudePanel.test.tsx
git commit -m "feat(ui): plan routes, sidebar links, and the Compile button"
```

---

