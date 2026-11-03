### Spec Compliance
- **Verdict: spec compliant.** `Op`, `Propose`, `Revise`, `Proposal`, `Decision`, `ProposalLogEntry` (both the type and the `z.ZodType<ProposalLogEntry>` schema) and `referencedIds` match the brief's interface field for field (`src/shared/proposals.ts:4-78`).
- `appendProposal` uses `appendFile` and writes a trailing newline (`src/server/files.ts:262-264`).
- `readProposals` handles each case the brief names (`src/server/files.ts:266-291`):
  - a missing file (ENOENT) returns `[]`;
  - blank lines are skipped;
  - a line that is not valid JSON throws `proposals.jsonl line <n>: ...` with a 1-based `n`;
  - a line that fails the schema throws the same message.
- All four tests the brief lists exist and make the brief's assertions (`test/shared/proposals.test.ts:3-21`, `test/server/files.test.ts:300-330`).
- The test code differs from the brief in two places, and both are justified:
  - `await store.init()` was added because `.blueprint/` must exist. The neighbouring test at `test/server/files.test.ts:295` does the same.
  - `"delete" as const` was added so the fixture type-checks.
- Nothing was added beyond the brief. The only extra is the private `proposalsPath()` helper, which mirrors `sessionsPath()`.
- Imports use NodeNext `.js` extensions (`src/server/files.ts:15`). The commit message matches the brief, with no co-author trailer.
- **Cannot verify from the diff:** that `pnpm check` and `pnpm build` are clean. The report states the results (140 tests passed, Biome clean, no warnings), but I did not re-run them.

### Strengths
- `referencedIds` is small and correct. A `Set` keeps first-seen order. The `else` branch can only be one of the two add ops, which carry `near` (`src/shared/proposals.ts:71-78`).
- The `ProposalLogEntry` schema is a discriminated union on `event`. The nested `Proposal` schema also enforces `ops.min(1)`, so a corrupt log entry with no ops is rejected.
- The `z.ZodType<ProposalLogEntry>` annotation makes the compiler check that the schema's output is assignable to the hand-written type.
- `readProposals` re-throws read errors other than ENOENT instead of swallowing them, the same pattern `readSessions` uses.
- The report is honest about its deviations from the brief and about the torn-line behaviour.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
1. **Schema-failure path is untested** (`test/server/files.test.ts:322-330`).
   - The corrupt-log test only exercises the `JSON.parse` failure branch (`{nope`).
   - The `safeParse` failure branch (`src/server/files.ts:282-286`) has no test.
   - If someone deleted that branch, the bad line would be cast and returned silently, and no test would fail.
   - Fix: add one line of valid JSON with a bad shape, e.g. `{"event":"weird","at":"x"}`, and assert that it throws `proposals.jsonl line 1`.
2. **Schema error messages are noisy** (`src/server/files.ts:285`).
   - In Zod 4, `parsed.error.message` is a pretty-printed JSON array of issues, so the error spans many lines.
   - `z.prettifyError(parsed.error)` or the first issue's `path` and `message` would give a readable one-line reason.
3. **The `Proposal` shape is declared twice** (`src/shared/proposals.ts:36-42` and `src/shared/proposals.ts:48-54`).
   - The `ZodType` annotation only checks one direction: the schema's output must fit the type.
   - If the schema later gains a field, or becomes stricter than the type, the compiler will not notice the drift.
   - The brief fixes the hand-written type, so this is acceptable. `export type Proposal = z.infer<typeof Proposal>` would remove the duplication.
4. **A torn trailing line makes the whole log unreadable** (`src/server/files.ts:275-287`).
   - Plan-mandated: the brief requires `readProposals` to throw on any bad line.
   - A crash during `appendFile` can leave a partial last line with no newline. Every later `readProposals` call then throws until someone edits the file by hand.
   - This is acceptable for this task. The later task that reads the log at startup should decide how to surface this error, and it is worth flagging there.

### Assessment
**Task quality: Approved.**
Reasoning: The implementation matches the brief exactly, and its two test changes from the brief are both necessary. The remaining items are a test gap, a readability nicety and one plan-mandated robustness note for a later task, none of which block this task.
