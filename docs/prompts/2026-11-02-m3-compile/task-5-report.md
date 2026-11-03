# Task 5 report: Routes, API client, sidebar, and the Compile button

Status: DONE

Commit: `bc0e06c feat(ui): plan routes, sidebar links, and the Compile button`

## What I implemented

- `src/ui/hooks/useHashRoute.ts`: `Route` now covers `board`/`doc` with an optional `focus: string[]`, plus `{ kind: "spec" }` and `{ kind: "tasks" }`.
  `parseRoute` reads `#/spec`, `#/tasks`, and `#/(boards|docs)/<name>[?focus=a,b]`; the name excludes `?`, each focus id is split on `,`, empty entries are dropped, and each id is `decodeURIComponent`-decoded.
  A malformed escape in a hand-typed hash keeps its raw text instead of throwing.
  An empty focus list is omitted, so `#/boards/main?focus=` parses as `{ kind: "board", name: "main" }`.
  `routeHash` is the inverse: `#/spec`, `#/tasks`, or `#/<kind>s/<name>` with `?focus=` built from `encodeURIComponent` on each id joined by `,`.
- `src/ui/api.ts`: `getSpec()` (GET `/api/spec`), `listTasks()` (GET `/api/tasks`), `agentCompile()` (POST `/api/agent/compile`, returns `{ id }`), `agentSplit()` (POST `/api/agent/split`).
  All go through the existing `request()`, which already throws an `ApiError` carrying the server's `error` message on 404, 409, or any non-OK status.
- `src/ui/nav/Sidebar.tsx`: a `Plan` section above Boards and Docs with `Spec` (`#/spec`) and `Tasks` (`#/tasks`) links, using the existing `nav-section`/`nav-title`/`nav-list`/`nav-link` styling, with `aria-current="page"` when the route kind matches.
  `active` is now typed as `Route`; board/doc links only match routes that carry a name.
- `src/ui/panel/ClaudePanel.tsx`: a `Compile` button in the header before `Stop`, disabled while the status is `starting`; it clears the failure line, calls `agentCompile()`, and shows a thrown message in the existing `panel-failure` alert.
- `src/ui/App.tsx`: placeholder paragraphs (`Spec view arrives in Task 7.` and `Tasks view arrives in Task 7.`, class `empty`) for the `spec` and `tasks` routes.

## TDD evidence

RED: `pnpm vitest run test/ui/useHashRoute.test.ts test/ui/Sidebar.test.tsx test/ui/ClaudePanel.test.tsx`

```
 FAIL  test/ui/ClaudePanel.test.tsx > Compile calls agentCompile
TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Compile"
 FAIL  test/ui/Sidebar.test.tsx > the sidebar shows Spec and Tasks links
TestingLibraryElementError: Unable to find an accessible element with the role "link" and name "Spec"
 FAIL  test/ui/useHashRoute.test.ts > parses focus and the plan routes, and routeHash inverts them
AssertionError: expected null to deeply equal { kind: 'spec' }
      Tests  3 failed | 10 passed (13)
```

GREEN: `pnpm vitest run test/ui`

```
 Test Files  16 passed (16)
      Tests  75 passed (75)
```

`pnpm check`: both `tsc` runs clean, `biome check .` reports "Checked 100 files ... No fixes applied.", and vitest reports 37 files and 265 tests passed, with no stderr or warnings.
`pnpm build`: built; the only warning is the pre-existing chunk size warning.

## Manual observations

The brief names no manual verification, so I did not run the app in a browser.
The header layout should hold: `.status` is `flex: 1` with ellipsis, so the extra button shrinks the status text rather than overflowing.

## Files changed

- `src/ui/hooks/useHashRoute.ts`
- `src/ui/api.ts`
- `src/ui/nav/Sidebar.tsx`
- `src/ui/panel/ClaudePanel.tsx`
- `src/ui/App.tsx`
- `test/ui/useHashRoute.test.ts`
- `test/ui/Sidebar.test.tsx`
- `test/ui/ClaudePanel.test.tsx`

## Self-review findings

- The tests cover the brief's three cases.
  The route test also covers URL-decoding, dropped empty entries, re-encoding of a comma inside an id, an empty `?focus=`, and an unknown path (`#/spec/extra` gives `null`).
  The Compile test covers the disabled state while `starting`, the call once the status is `idle`, and an error shown in the failure line.
- Board names in the hash are not decoded, as before; names are slugs, so they never need escaping.
- `App`'s existing `key={route.name}` on BoardView/DocView means a focus-only hash change does not remount the view, which is what Task 7 will want.
- Only the eight listed files changed; no new dependencies.

## Concerns

- Compile is enabled while the agent is `working` or `needs_you`, as the brief specifies (disabled only while `starting`).
  If the server rejects a compile during a turn, the user sees that message in the failure line.
- No browser check of the header with three controls; worth a look in Task 7's manual pass.
