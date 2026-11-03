# Task 4 report: Citations

## What I implemented

`src/export/citations.ts` exports exactly the brief's interface:

- `type Citation = { kind: "board" | "doc"; page: string; id: string; raw: string }`
- `parseCitations(text)` uses the brief's regex verbatim: `/\[\[(board|doc):([^#\]]+)#([^\]]+)\]\]/g` (via `matchAll`, so no shared `lastIndex` state).
- `headingSlugs(markdown)` matches ATX headings only with `/^#{1,6} (.*)$/gm`.
  Slug rule per the brief: lowercase, strip every character that is not a letter (`\p{L}`), digit (`\p{Nd}`), space, or hyphen, then replace each space with a hyphen.
  The heading text is trimmed first, so trailing whitespace does not become trailing hyphens.
- `buildCitationIndex({ boards, docs })` adds `board:<name>#<id>` for every node, edge, and loose id, and `doc:<file>#<slug>` for every heading slug.
- `dropUnknownCitations(text, index)` removes each citation whose `kind:page#id` key is not in the index and returns the dropped ones in order.
  No whitespace cleanup, matching the brief's expected `"x [[board:main#r1]] y "`.

`src/export/index.ts` gains one line: `export * from "./citations.js";`.
The internal `key` helper is not exported, so the public surface is exactly the five brief items.

## TDD evidence

RED: `pnpm vitest run test/export/citations.test.ts`

```
 FAIL  test/export/citations.test.ts [ test/export/citations.test.ts ]
Error: Cannot find module '../../src/export/citations.js' imported from /Users/vincentyip/programming/cursor-whiteboard/test/export/citations.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

GREEN: `pnpm vitest run test/export/citations.test.ts`

```
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

Full check: `pnpm check`

```
Checked 16 files in 30ms. No fixes applied.
 Test Files  4 passed (4)
      Tests  23 passed (23)
```

Both tsc passes were silent (no errors), biome clean, no warnings.

## Files changed

- `src/export/citations.ts` (new)
- `src/export/index.ts` (one re-export line)
- `test/export/citations.test.ts` (new, 4 tests)

Commit: `dc14c76 feat(export): citation grammar, heading slugs and index` (no trailers).

## Self-review

- Completeness: the four brief tests exist and pass; the third test (left as `...` in the brief) covers a node, an edge, a loose id, and two doc slugs, asserting the exact Set.
- Regex and slug rule match the brief exactly.
- Discipline: only the three listed files touched; no extra exports.
- The test imports from `citations.js` directly so RED fails with "module not found", as the brief expects.

## Concerns (minor, none blocking)

- The brief's slug rule strips `_`, while GitHub keeps underscores; a heading `# my_func` slugs to `myfunc` here and `my_func` on GitHub. I followed the brief.
- GitHub also appends `-1`, `-2` to duplicate heading slugs; not implemented (brief does not ask, and the index is a Set). Marked with a `ponytail:` comment.
- ATX headings inside fenced code blocks are still counted as headings, which can add spurious doc keys. Harmless for dropping unknown citations, but worth handling if the UI ever resolves anchors strictly.
