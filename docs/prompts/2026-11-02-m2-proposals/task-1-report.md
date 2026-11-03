# Task 1 report: Proposal schemas and the proposal log

Status: DONE

Commit: `4979eb5 feat(proposals): operation schemas and the proposal log`

## What I implemented

- `src/shared/proposals.ts`: `Op`, `Propose`, `Revise` exactly as in the brief.
  Also the `Proposal`, `Decision`, and `ProposalLogEntry` types.
  `ProposalLogEntry` is a `z.discriminatedUnion("event", ...)` typed as `z.ZodType<ProposalLogEntry>`.
  Its two members use Zod 4 multi-value literals (`z.literal(["proposed", "revised"])` and `z.literal(["accepted", "rejected"])`).
  The inner `Proposal` schema (module-private) validates `ops` with `z.array(Op).min(1)` and `title` as `string | null`.
  `referencedIds` walks the ops into a `Set` (first-seen order): `update.id` and `delete.id`, plus every `near` id of the add ops.
- `src/server/files.ts`: `FileStore.appendProposal` appends `JSON.stringify(entry) + "\n"` to `.blueprint/proposals.jsonl` with `appendFile`, which creates the file.
  `FileStore.readProposals` returns `[]` on ENOENT.
  It splits on `\n`, skips blank lines, then parses and validates each line.
  A JSON error or a schema failure throws `Error("proposals.jsonl line <n>: <reason>")`, where n is 1-based.
  A private `proposalsPath()` sits beside `sessionsPath()`.

## TDD evidence

RED: `pnpm vitest run test/shared/proposals.test.ts test/server/files.test.ts -t "proposal"`

```
 ❯ test/shared/proposals.test.ts (0 test)
 ❯ test/server/files.test.ts (15 tests | 2 failed | 13 skipped) 10ms
   × proposal log appends lines and reads them back; a missing file is empty 7ms
   × a corrupt proposal log line is reported with its line number 3ms
 FAIL  test/shared/proposals.test.ts [ test/shared/proposals.test.ts ]
Error: Cannot find module '../../src/shared/proposals.js' imported from .../test/shared/proposals.test.ts
 FAIL  test/server/files.test.ts > proposal log appends lines ...
TypeError: store.readProposals is not a function
 Test Files  2 failed (2)
      Tests  2 failed | 13 skipped (15)
```

GREEN: `pnpm vitest run test/shared/proposals.test.ts test/server/files.test.ts`

```
 Test Files  2 passed (2)
      Tests  17 passed (17)
```

`pnpm check`: both typechecks clean, Biome `Checked 83 files ... No fixes applied.`, and Vitest `Test Files 28 passed (28)`, `Tests 140 passed (140)`.
The output had no warnings or errors.

## Manual observations

The brief names no manual verification.
I ran an ad-hoc probe of `ProposalLogEntry` through `node --import tsx` (the script was in `$TMPDIR` and is not committed):
- `revised` with a full proposal: accepted.
- `rejected` with an id: accepted.
- `proposed` with only an `id` (no proposal): rejected.
- A proposal with `ops: []`: rejected.
- An unknown event `weird`: rejected.

## Files changed

- `src/shared/proposals.ts` (new)
- `src/server/files.ts`
- `test/shared/proposals.test.ts` (new)
- `test/server/files.test.ts`

## Self-review findings

- The brief's files tests needed two small adaptations to run:
  - Both tests call `await store.init()` first. The suite's `beforeEach` does not create `.blueprint/`, and without it `appendFile` and the corrupt-file `writeFile` both fail with ENOENT. The other store tests also call `init()` first.
  - The proposal fixture uses `op: "delete" as const`. Without it, TypeScript widens `op` to `string` and `appendProposal`'s argument fails the typecheck.
- `appendProposal` does not record the write in `ownWrites`, per the resolution: the watcher ignores files that are not boards or docs.
- Biome reformatted one long line in `readProposals`, and I kept that change.

## Concerns

None.
`readProposals` fails on the whole log when any line is corrupt, including a half-written trailing line after a crash.
This is the behaviour the brief specifies, so later tasks that read the log at startup will surface that error rather than skip the line.
