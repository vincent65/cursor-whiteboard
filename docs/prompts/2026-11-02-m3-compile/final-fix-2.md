The re-review confirmed 14 of 15 findings. Two small follow-ups, in this thread, on branch `m3-compile`:

1. Finding 7 is partial: an unknown citation that leads a list still leaves a stray comma. In `src/export/citations.ts`, when the text after the citation starts with `,` or `;` and the text before it ends in whitespace only, take the separator after (and its following space) instead of the space before. Add these to `test/export/citations.test.ts` with the exact expected output:
   - `"Statement [[board:main#x]], [[board:main#a]]."` → `"Statement [[board:main#a]]."`
   - `"Login (see [[board:main#x]], [[board:main#a]]) fast."` → `"Login (see [[board:main#a]]) fast."`
   - `"See [[board:main#x]], [[board:main#y]], A."` → `"See A."`
   Keep the existing cases passing, and correct the comment above `SEPARATOR_BEFORE` if it no longer describes the code.
2. `SpecView.split()` sets `heardSplit.current = true` when the user clicks Split, so a late mount-time `agentState()` answer cannot re-enable the button. Add a test.

Run `pnpm check` once (pristine), commit with conventional messages and NO co-author trailer, append a "Fix round 2" section to final-fix-report.md, and end with the short status contract only.
