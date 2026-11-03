**Status:** Done. Both follow-ups are fixed and `pnpm check` passes with no stderr.

**Commits:**
- `8fc6684` fix(export): an unknown citation leading a list takes the comma after it
- `b802cd8` fix(ui): a split pressed before the state arrives keeps its button busy

**Tests:** 294 of 294 pass across 41 files. Both new tests failed before their fixes.

**Concerns:** The second of the three new citation cases (`Login (see [[x]], [[a]]) fast.`) already passed before this change. The other two were the ones failing.

**Report:** /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m3-compile/final-fix-report.md (the "Fix round 2" section is at the end)
