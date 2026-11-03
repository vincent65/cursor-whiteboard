### Task 3: Server events context in the UI and sidebar refresh

**Files:**
- Create: `src/ui/server-events.tsx`
- Modify: `src/ui/api.ts`, `src/ui/App.tsx`, `src/ui/board/BoardView.tsx`, `src/ui/docs/DocView.tsx`
- Test: `test/ui/server-events.test.tsx`

**Interfaces:**
- Produces in `src/ui/server-events.tsx`:

```ts
export function ServerEventsProvider({ children }: { children: ReactNode }): JSX.Element;
export function useServerEvent(handler: (m: ServerMessage) => void): void;   // subscribes for the component's lifetime
export function useSendToServer(): (m: ClientMessage) => void;              // queued until the socket is open
```

- `api.ts` keeps `connectWs` but it now accepts and returns the typed messages: `connectWs(onMessage: (m: ServerMessage) => void): { send(m: ClientMessage): void; close(): void }`.
- `App.tsx` wraps the shell in the provider, and refreshes the sidebar lists when a `file-changed` arrives for a board or doc name it does not know.
- `BoardView` and `DocView` subscribe with `useServerEvent` instead of opening their own sockets.

- [ ] **Step 1: Write the failing tests** (file starts with the jsdom pragma; a fake `WebSocket` class installed on `window`)

```tsx
test("subscribers receive parsed messages and sends queue until open", async () => {
  // render a probe component inside the provider; fake socket records sends
  // after the fake socket fires onopen, a queued selection.changed is sent once
  // a file-changed message dispatched through onmessage reaches the subscriber
});
test("a file-changed for an unknown doc refreshes the sidebar lists", ...);  // App with mocked api: listDocs called again after the message
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/ui/server-events.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the provider and rewire the views**

The provider owns one socket per tab, dispatches each message to every subscriber, and keeps a send queue while the socket is connecting or reconnecting. The views' existing message filters stay the same.

- [ ] **Step 4: Run the UI tests and verify by hand**

Run: `pnpm vitest run test/ui && pnpm dev`
Then: with the app open, create a doc file on disk by hand and confirm it appears in the sidebar without a reload; confirm the board and doc external-change behavior from milestone 0 still works.
Expected: tests PASS and both checks hold.

- [ ] **Step 5: Commit**

```bash
git add src/ui/server-events.tsx src/ui/api.ts src/ui/App.tsx src/ui/board/BoardView.tsx src/ui/docs/DocView.tsx test/ui/server-events.test.tsx
git commit -m "feat(ui): one server-events socket per tab and live sidebar refresh"
```

---

