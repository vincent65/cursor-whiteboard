### Spec Compliance
- Spec compliant for the brief's three files and interfaces. `selectedIds`, `blobToDataUrl` and `sameIds` match the Interfaces block (`src/ui/board/snapshot.ts:4-20`). `blobToDataUrl` uses `arrayBuffer` plus `btoa` through `base64` and never touches `FileReader`.
- The three tests the brief lists exist and assert what it says (`test/ui/snapshot.test.ts:7-30`). The `sameIds` test also covers the empty, reordered and different-length cases.
- `BoardView` debounces `selection.changed` at 150 ms and sends it only on change (`BoardView.tsx:152-159`, called from `onChange` at `:267`).
- `board.png` returns `{ png }` for the whole board. A different board name gets the error `board <name> is not open` (`:166-169`).
- `selection.snapshot` returns `{ ids, png | null }` from the `latest` ref, with export padding 16 (`:171-179`, `toPng` at `:56-68`). Responses go out through a `useServerEvent` handler (`:181-188`).
- Extra 1: `selection.snapshot` also puts text bound to a selected container into the PNG (`BoardView.tsx:174-178`). The brief says the PNG covers "only the selected elements". The addition is justified, since without it a labelled shape exports as an empty box, and `ids` still reports exactly the selection. I accept it, but it is not in the spec.
- Extra 2: changes to `src/ui/api.ts`, `src/ui/server-events.tsx`, `test/ui/server-events.test.tsx` and `scene.ts` (`base64` is now exported). The report says these are Task 3 review carry-overs the controller asked for.
- Cannot verify from the diff:
  - That the controller actually asked for the carry-over changes.
  - That the commit body has no co-author trailer. The package shows only the subject line, which matches the brief.
  - The manual WS-frame check and the PNG crops. These rest on the report's Playwright account; I did not re-run them.

### Strengths
- `snapshot.ts` is pure and small, and reuses `base64` rather than writing a second copy.
- `useServerEvent` reads the latest handler from a ref (`src/ui/server-events.tsx` `useServerEvent`), and `BoardView` is keyed by `route.name` (`src/ui/App.tsx:72-73`). So `answer` never sees a stale `name`; I checked both.
- Dropping queued `response` frames on reconnect fits the hub contract. Plan line 150 says "A removed socket rejects its pending requests immediately", so no live request waits on a frame that was dropped.
- The reconnect-queue test checks sends during CLOSING as well as CLOSED, and it collapses to the latest selection. The throwing-subscriber test spies on and restores `console.error`, so the output stays clean.
- The report lists its own edge cases honestly: requests that go unanswered while a doc is open, async rejections outside the subscriber try/catch, and flush on unmount.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
- **The hub loses the board's selection on reconnect, and nothing sends it again** (`src/ui/api.ts:85-96`, `src/ui/board/BoardView.tsx:152-159`).
  - The hub learns its active socket and `activeBoard` only from `selection.changed` (plan lines 145, 150, 466, 488).
  - `reportedIds` sends only on change. `connectWs` sends a selection again only if it was queued while the socket was down.
  - Scenario: the user selects `[x]` on board A and the frame is sent. The server then restarts (`tsx watch` in dev) and the socket reconnects. The new hub has `activeBoard === null`, and the tab never tells it otherwise until the selection changes.
  - Task 7's `get_selection` would then get `ids: [x]` from the browser with no board name to build the graph from. With several tabs, requests would also go to the wrong socket.
  - Fix: `connectWs` keeps the last `selection.changed` it sent and sends it again on every `onopen`, not only when it was queued. This is a few lines in code this task already changes.
  - Related Minor: a freshly mounted board with an empty selection never announces itself, because `reportedIds` starts as `[]`. Starting it as `null` makes the first report always go out.

#### Minor (Nice to Have)
- `BoardView.tsx:171`: any request kind other than `board.png` is answered as `selection.snapshot`. A request kind added later would get a snapshot back with no compile error. A `switch` on `m.kind` that ends in a `never` check would make the compiler catch it.
- `BoardView.tsx:174-178`: the bound-label filter is the one piece of new non-trivial logic, and it sits in a component that cannot load under vitest. No test covers it. Moving it into `snapshot.ts` as a pure `snapshotElements(elements, ids)` would make it testable.
- `BoardView.tsx:142-149` versus `:56-68`: `exportPng` and `toPng` pass the same arguments to `exportToBlob` (png, padding 16, `appState`, `files`). One shared `exportBlob(elements, s)` would keep the two exports from drifting apart.
- `BoardView.tsx:185`: the rejection handler is typed `(err: Error)`. If something rejects with a non-Error, the response carries `error: undefined`. Using `String(err?.message ?? err)` avoids that.
- `useDebounced` flushes on unmount (report, self-review). If the user selects on board A and opens board B within 150 ms, a late `selection.changed` for A arrives after B is open, and the hub's `activeBoard` goes stale. This is low impact.
- Two pre-existing console errors the report saw but left alone (the StrictMode "WebSocket is closed before the connection is established" and the `favicon.ico` 404). Under the user's standing rule, they should be fixed rather than deferred.

### Assessment
Task quality: Needs fixes

Reasoning: The brief is fully and cleanly implemented, and the carry-over fixes come with tests. However, the hub's active-board state depends entirely on `selection.changed`, and this task never sends it again after a reconnect, so the server can silently lose which board is selected. That should be closed here, in `connectWs`, while the code is open.
