# Task 1 report: DONE

Commit `0b30e4c feat(tasks): task schema, ordering, and Markdown frontmatter`, no trailer.

## What I implemented

`src/shared/tasks.ts`:

- `Task`, `TaskGraph` (Zod 4, inferred types), and `TaskFile`, exactly as the brief specifies.
- `orderTasks`: first checks for duplicate slugs, then for unknown dependencies, then runs a stable Kahn's algorithm.
  Each pass picks the earliest task in the input whose dependencies are all placed.
  This is O(n^2), marked with a `ponytail:` comment, and fine for the 3 to 12 tasks a split returns.
  When no task is ready, `cycleMessage` follows each unplaced task's first unplaced dependency until a slug repeats, and names two tasks on the loop.
- `taskFileName(index, slug)` gives `"01-auth.md"` for index 0.
- `taskToMarkdown` writes one `key: <JSON.stringify value>` line per field, in the ruled order title, slug, dependsOn, files, acceptance, sources.
  Then it writes the closing `---`, one blank line, and the body verbatim.
- `taskFromMarkdown` needs `---` on line 1 and a later `---` line.
  Each header line must match `key: <json>` and its value must pass `JSON.parse`.
  It drops one blank line after the fence, keeps the rest as the body, and validates the whole object with `Task`.
  Every failure throws `task frontmatter: <reason>`, and a Zod failure names the first issue's path and message.
  `Object.fromEntries` defines own properties, so a `__proto__:` key cannot change the prototype.

`test/shared/tasks.test.ts`: the brief's four tests, with two accepted changes.
I moved the `t` helper to file scope.
I also added a check that a file without a `slug` line throws `task frontmatter`.

## TDD evidence

RED, `pnpm vitest run test/shared/tasks.test.ts`:

```
Error: Cannot find module '../../src/shared/tasks.js' imported from .../test/shared/tasks.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

GREEN, same command:

```
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

`pnpm check` (tsc client and server, biome, vitest):

```
Checked 98 files in 92ms. No fixes applied.
      Tests  244 passed (244)
```

The output is pristine.
The first run had 3 biome `noNonNullAssertion` warnings in my `cycleMessage`.
I rewrote it without assertions before committing.

## Manual observations

I ran a throwaway vitest file (deleted afterwards) to see the cycle messages:

- `a->b, b->a` gives "tasks a and b depend on each other".
- `x->a, a->b, b->c, c->a` gives "tasks a and c depend on each other".
  `x` waits on the loop but is correctly not named.
- `a->a` gives "tasks a and a depend on each other".

## Files changed

- `src/shared/tasks.ts` (new)
- `test/shared/tasks.test.ts` (new)

## Self-review

- The interfaces and error strings match the brief, and the frontmatter order matches the ruling.
- `taskToMarkdown` does not validate its input.
  The split output passes `TaskGraph` before it gets there, and `taskFromMarkdown` validates on read.
- The body comes back unchanged, including its trailing newline, which the round-trip test checks.
  An empty body round-trips as `""`.
- CRLF files are not handled: a `---\r` line is reported as a missing fence.
  The server writes LF, so I left this out.
- `cycleMessage` has two `?? ""` fallbacks that can never fire, because every unplaced task has an entry.
  They exist only to satisfy biome without non-null assertions.

## Concerns

- A task that depends on itself is reported as "tasks a and a depend on each other".
  The wording is odd but the meaning is clear.
  A dedicated "task a depends on itself" message would be a small follow-up if wanted.
- For loops of three or more tasks, the two named tasks are both on the loop but need not depend on each other directly.
  For example, "a and c": c depends on a, while a depends on c only through b.
