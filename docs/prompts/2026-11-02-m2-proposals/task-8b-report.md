# Task 8b report: arrow ids in the board export and typed API errors

Status: DONE

Commit: `f783aab feat(export): list connected arrows with ids, and typed API errors`

## What I implemented

- `boardGraphToMarkdown` emits `## Arrows` right after the `<!-- ids: … -->` comment, only when there are connected arrows.
  It has one bullet per connected arrow in diagram (`linked`) order, in the same shape as the Unconnected arrows bullets.
  The `side` helper and a new `arrow` bullet helper moved up so both sections share them; labels go through `plain()`.
  The Unconnected arrows section is unchanged.
- The golden `test/export/fixtures/basic.md` gains the section, edited by hand:
  - `- a1: "API" (r1) -> "Postgres" (r2) label "SQL"`
  - `- a2: "Browser" (e1) -> "API" (r1) label "HTTPS"`
- `SYSTEM_PROMPT_APPEND`: the propose line now ends with `Element ids come from the selection header or get_board: nodes in its ids comment, arrows in its Arrows list.`
  The old sentence `Use element ids from the selection header or get_board.` was removed because the new one replaces it.
- `src/ui/api.ts` exports `class ApiError extends Error` with a public `readonly status: number`.
  `request()` throws it for every non-ok response, and the message is built exactly as before.
- `BoardView.decide` now runs server-first and is async:
  - It awaits `api.decideProposal` first.
  - On success, or on `ApiError` with status 404 (logged with `console.warn`), it applies `decideProposal` locally through the existing `throughGhosts` code, removes the id from `titles`, and clears the refine target if it pointed at this proposal.
  - On any other error, including 409, it applies nothing and shows `Decision failed: <message>`.
  - The match on the "is not pending" message text is gone.

## TDD evidence

RED: `pnpm vitest run test/export/markdown.test.ts test/server/agent/prompt.test.ts test/ui/api.test.ts`

```
   × the prompt tells Claude where arrow ids come from
   × connected arrows are listed with their ids after the diagram
   × request throws ApiError with the status and the server's message
   × without a body error, the message names the method, path, and status
 FAIL  test/export/markdown.test.ts > connected arrows are listed with their ids after the diagram
AssertionError: expected '# Board: main\n\n## Diagram\n\n```mer…' to contain '<!-- ids: n1=fr1 n2=r1 n3=r2 n4=e1 --…'
 FAIL  test/ui/api.test.ts > request throws ApiError with the status and the server's message
AssertionError: The instanceof assertion needs a constructor but undefined was given.
 FAIL  test/ui/api.test.ts > without a body error, the message names the method, path, and status
AssertionError: expected Error: GET /agent/proposals: 500 to match object { status: 500, …(1) }
 FAIL  test/server/agent/prompt.test.ts > the prompt tells Claude where arrow ids come from
AssertionError: expected 'You are planning inside Blueprint, a …' to match /arrows in its Arrows list/
      Tests  4 failed | 11 passed (15)
```

GREEN: `pnpm check`

```
Checked 94 files in 88ms. No fixes applied.
 Test Files  34 passed (34)
      Tests  201 passed (201)
```

Both typechecks passed, Biome reported nothing, and Vitest printed no stderr.
`pnpm build` warned only about the pre-existing chunk size (`(!) Some chunks are larger than 500 kB`).

## Files changed

- `src/export/markdown.ts`
- `test/export/fixtures/basic.md`
- `test/export/markdown.test.ts`: new test that checks the Arrows section follows the ids comment, and that a board without connected arrows has no Arrows section.
- `src/server/agent/prompt.ts`
- `test/server/agent/prompt.test.ts`
- `src/ui/api.ts`
- `src/ui/board/BoardView.tsx`
- `test/ui/api.test.ts` (new, jsdom): checks a 404 with a body error, and a 500 with no body, which falls back to the method, path, and status message.

## Self-review

- The Arrows bullets show `from` and `to` as stored.
  For a start-only arrowhead, the Mermaid line is reversed but the bullet is not.
  The Unconnected arrows bullets work the same way, and the brief asks for that shape.
- `decide` reads `target` from the closure after the await.
  If the user changes the refine target while the request is in flight, that check uses the old value.
  The worst case is a missed or extra `setTarget(null)`, and the request is local and fast, so I left it.
- `ProposalsBar`'s `onDecide` is typed as returning void, and the async `decide` assigns to it without a typecheck error.
  `decide` handles its own errors, so the returned promise never rejects from the API call.
- I added no UI test for the server-first branching in `BoardView`.
  The brief lists no BoardView test, and `BoardView` has no component test harness, since it mounts Excalidraw.
  The `ApiError` contract the branching relies on is covered in `test/ui/api.test.ts`.

## Concerns

- I did not run a manual end-to-end check against a live server for the 409-during-revise path.
  The behaviour comes from reading the code.
