# Task 11 report: Mermaid parser test over the golden blocks

## What I implemented

- Added `mermaid@^12.2.0` as a dev dependency.
- Added `test/export/mermaid.test.ts` (jsdom pragma).
It pulls the fenced mermaid blocks out of the Markdown with a regex and runs each one through `mermaid.parse`.
It checks two blocks:
  - the block in `test/export/fixtures/basic.md` (subgraph, ellipse, labeled edges);
  - a block that `boardGraphToMarkdown` renders from a graph built to cover these cases: a frame subgraph whose label has quotes, a pipe and brackets; a node label with quotes, a pipe and brackets; an edge label with quotes, a pipe and brackets; both arrowheads (`<-->`); no arrowheads (`---` with a label); start-only (reversed `-->`); end-only; a diamond; an ellipse.
- `expect(blocks).toHaveLength(2)` stops the test from passing with nothing checked if the regex ever stops matching.
- `mermaid.initialize({ startOnLoad: false })` runs once, at the start of the test.

Every block parsed on the first run, so the renderer needed no changes (Step 3 did not apply).
`src/export/markdown.ts` and the fixtures are unchanged.

## TDD evidence

The brief expected this step might pass on the first run and said to prove the harness by breaking it on purpose.
I did that two ways and restored the files after each.

Install: `pnpm add -D mermaid` -> `+ mermaid 12.2.0`.

First run: `pnpm vitest run test/export/mermaid.test.ts`.
It failed for a reason unrelated to Mermaid: `TypeError: The URL must be of scheme file` at `readFile(new URL("./fixtures/basic.md", import.meta.url))`.
jsdom replaces the global `URL`, and Node's `readFile` rejects jsdom's URL object.
I switched to `join(import.meta.dirname, "fixtures/basic.md")` and added a one-line comment explaining why.

GREEN: `pnpm vitest run test/export/mermaid.test.ts` -> `Tests 1 passed (1)`.

Deliberate break 1 (renderer): I commented out `.replaceAll('"', "#quot;")` in `mermaidLabel`.
```
× every mermaid block the renderer produces parses with the real Mermaid parser
AssertionError: promise rejected "Error: Parse error on line 2: ...bgraph n1["Frame "x" ...
Expecting 'SQE', ..., got 'STR'
```
Restored with `git checkout src/export/markdown.ts`.

Deliberate break 2 (test input): in the test, I changed the golden block's `["API"]` to `["A"PI"]` in memory.
```
× every mermaid block the renderer produces parses with the real Mermaid parser
Caused by: Error: Parse error on line 3:
...kend"]    n2["A"PI"]    n3["Postgres"]
```
I restored the file from a backup and re-ran: `Tests 1 passed (1)`.

Full check: `pnpm check` passed.
tsc (both configs) clean, biome `Checked 81 files ... No fixes applied.`, vitest `Test Files 27 passed (27)`, `Tests 121 passed (121)`.
Grepping the output for warn/error/stderr found nothing.

## Manual observations

- jsdom stubs: none were needed.
Mermaid 12.2.0 imports and `parse` works under jsdom with no `getBBox` or DOMPurify shims.
- The only jsdom adaptation is the file path described above (jsdom's global `URL` versus `fs`).

## Files changed

- `package.json` (dev dependency `mermaid`)
- `pnpm-lock.yaml`
- `test/export/mermaid.test.ts` (new)

Commit: `ca71e3c test(export): parse the golden Mermaid blocks with the real parser` (no trailers).

## Self-review

- The test name matches the brief exactly.
- The graph covers every case the brief lists: quotes, pipes and brackets in labels (node, edge and subgraph title), both arrowheads, none, start-only, diamond, subgraph.
- The test has its own small `node`/`edge` helpers instead of importing them from `markdown.test.ts`, which does not export them.
Exporting them would mean changing a file the brief does not list.
- The block-count assertion protects against the regex silently matching nothing.

## Concerns

- Environment only: `pnpm add` failed inside the sandbox with `ERR_PNPM_UNEXPECTED_STORE`, because the sandbox cannot write to the global store at `~/Library/pnpm/store/v10`.
I ran it again outside the sandbox and it worked.
The peer-dependency warnings that `pnpm add` printed are about Excalidraw's radix packages and `@hono/node-ws`, not mermaid.

## Fix round 1

Finding: `mermaid@^12.2.0` (and its `@mermaid-js/parser@2` and `commander@15` dependencies) requires Node >= 22.12, which breaks the project's Node 22.1 floor.

What I changed: I replaced the dev dependency with mermaid 11.
The test needed no changes, because mermaid 11 has the same `initialize` and `parse` API.
I edited only `package.json` and `pnpm-lock.yaml`.

Command (run outside the sandbox because the global pnpm store is not writable inside it): `pnpm add -D mermaid@^11`
```
- mermaid 12.2.0
+ mermaid 11.17.2 (12.2.0 is available)
Done in 1.6s using pnpm v10.30.1
 package.json   |   2 +-
 pnpm-lock.yaml | 103 ++-------------------------------------------------------
```
`package.json` now has `"mermaid": "^11.17.2"`.

Lockfile check: `grep -cE 'mermaid@12|chevrotain@13|commander@15|@mermaid-js/parser@2' pnpm-lock.yaml` -> `0`.
The lockfile now holds only `mermaid@11.17.2`, `chevrotain@11.0.3`, and `commander@7.2.0` and `@8.3.0`.

`pnpm vitest run test/export/mermaid.test.ts` -> `Tests 1 passed (1)`.

I confirmed the harness still catches failures on mermaid 11.
With the `"` escape in `mermaidLabel` commented out, the test failed (`Parse error on line 2`, `Tests 1 failed (1)`).
I restored the file with `git checkout`.

`pnpm check`: tsc and biome clean, `Test Files 27 passed (27)`, `Tests 121 passed (121)`.
Grepping the output for warn/error/stderr found nothing.

Commit: `fix(deps): use mermaid 11 so the Node 22.1 floor holds` (no trailers).
