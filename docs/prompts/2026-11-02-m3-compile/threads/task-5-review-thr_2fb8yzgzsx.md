### Spec Compliance
- Spec compliant. Every interface the brief names is in the diff with the brief's signatures. All three tests the brief lists exist and check what the brief says. The placeholder paragraphs follow the brief's Step 3 instruction.
  - `Route` and `routeHash`: `src/ui/hooks/useHashRoute.ts:144-178`.
  - `getSpec`, `listTasks`, `agentCompile` and `agentSplit`: `src/ui/api.ts:87-124`.
  - The Plan section with Spec and Tasks links: `src/ui/nav/Sidebar.tsx:257-272`.
  - The Compile button, disabled only while `starting`: `src/ui/panel/ClaudePanel.tsx:324-331`.
  - The placeholder paragraphs: `src/ui/App.tsx:33-38`.
- I checked that the client matches the server (outside the diff), because a mismatch between them would break at runtime. They match:
  - `GET /spec` returns `{ text: null, dropped: [] }` or `dropUnknownCitations(...)` → `{ text, dropped: Citation[] }` (`src/server/routes.ts:85-88`, `src/export/citations.ts:53-56`).
  - `POST /agent/compile` returns `{ id }` (`src/server/agentRoutes.ts:34`).
  - `/split` errors go through the app's error handler, so `request()` throws them as `ApiError` (`agentRoutes.ts:36`).
- Cannot verify from the diff: the report's claims that `pnpm check` is clean and that `pnpm build` warns only about chunk size. I did not re-run either, as instructed.

### Strengths
- `parseRoute` decodes each id after splitting on commas. An encoded comma inside an id therefore survives the round trip, and the test covers it (`test/ui/useHashRoute.test.ts:509-515`).
- A malformed escape falls back to the raw text instead of throwing inside a hashchange handler (`useHashRoute.ts:151-157`).
- An empty `?focus=` normalizes to no `focus` key, so plain routes compare equal with `toEqual`.
- The Compile test checks three things: disabled while `starting`, enabled after `idle`, and a rejected call shown in the alert (`test/ui/ClaudePanel.test.tsx:379-397`).
- The Sidebar test checks the active state of both Plan links, the inactive board link, and the section order.
- `agentSplit` reuses the existing `request()` error path instead of handling errors a second way.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
- **No tests for the new API functions.** `getSpec`, `listTasks` and `agentSplit` have no tests of their own (`src/ui/api.ts:87-124`). `agentSplit` has no caller yet, so its promised throw on 404 or 409 is covered only by the existing `request()` behaviour. The brief lists no tests for these functions, so this is not a requirement gap. The first caller (Task 7) should assert that the error surfaces.
- **Placeholder copy names an internal milestone.** "Spec view arrives in Task 7." is user-visible text (`src/ui/App.tsx:34,37`). The brief mandates the placeholder and Task 7 removes it. Confirm that removal is part of Task 7's checklist.
- **Test leaves hooks mounted.** In `test/ui/useHashRoute.test.ts:487-490`, `read()` renders a new hook on each call without unmounting the earlier ones. Up to nine `hashchange` listeners stay attached until RTL cleanup runs. This is harmless today because the callback is `() => false`. Calling `unmount()` would keep the test hermetic.
- **Compile stays enabled while a turn is running.** It is enabled while `working` or `needs_you` (`ClaudePanel.tsx:327`). That matches the brief, and a server rejection is shown in the failure line. Mid-turn use still deserves a look in the Task 7 manual pass, as the report itself notes.

### Assessment
Task quality: Approved

Reasoning: All interfaces and tests match the brief, and the client agrees with the server routes it calls. The remaining items are test hygiene and temporary placeholder copy.
