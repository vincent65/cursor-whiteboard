### Finding Verdicts

1. **ADDRESSED.** `listBoundArrows` moved out of BoardView.tsx into `src/ui/board/ghosts.ts:146` as a pure function, and `El` gained the optional `boundElements` field (`ghosts.ts`, El type).
   - It skips deleted arrows (`e.type !== "arrow" || e.isDeleted`) and deleted targets (`if (e.isDeleted) return e`).
   - It collects arrow ids in a `Set` and leaves out ids already listed, so no entry is duplicated.
   - It returns `e` unchanged when nothing is missing, so untouched elements keep their identity.
   - `throughGhosts` in `src/ui/board/BoardView.tsx` now runs it on the output of `change(...)` before the identity-based `bumpVersion`. Only elements it actually replaced get a version bump.
   - All five tests the ruling asked for are in `test/ui/ghosts.test.ts`: both ends, no duplicates (including a self-bound arrow), deleted arrows and deleted targets, and identity.
   - Moving the call before `restoreElements` is safe. I read Excalidraw's `repairContainerElement` (`chunk-4FTI6OG3.js:20621`): it only removes entries whose element is missing or deleted. The arrows this function lists are live, so restore keeps them.

2. **ADDRESSED.** Existing-element arrow ends now go through the shared `claim(id)` check in `ghosts.ts` `applyProposal`. That gives them the same "unknown id" and cross-proposal checks as update and delete.
   - An end that any `delete` op in the same proposal targets throws `op <i>: arrow end <id> is deleted by this proposal`. The check looks at every op, so it works whatever the op order.
   - Both cases are tested in `test/ui/ghosts.test.ts` ("an arrow end must not be in another pending proposal or deleted by this one"). The test also checks that the input elements are not mutated.

3. **ADDRESSED.** `src/shared/refs.ts:4` uses `REF = /^\$(0|[1-9]\d*)$/`.
   - `checkRefs`, the `applyProposal` check, `betweenTargets` (`names = refIndex(end) === i`) and the `end()` lookup all go through `refIndex`.
   - `$01` and other malformed refs are tested in `test/shared/proposals.test.ts` and in "applyProposal reads refs the canonical way only".

4. **ADDRESSED.** `src/shared/proposals.ts` `checkRefs` throws `op <i>: an arrow needs two different ends` when `from === to`. The test covers both `a→a` and `$0→$0`.

5. **ADDRESSED.** `src/shared/refs.ts` has no zod import and exports `isRef` and `refIndex`.
   - Both `proposals.ts` and `ghosts.ts` import it. The duplicated regex and the "repeated so the UI bundle stays free of zod" comment are gone.
   - `checkRefs` stays in proposals.ts.

The fix report names the covering tests and shows RED output, GREEN output (33/33), `pnpm check` (222/222) and a clean build, apart from the chunk-size warning that was already there. These claims match the diff.

### New Breakage in the Fix Diff
None.

### Out-of-Scope Observations
- `applyProposal` in `ghosts.ts` does not reject self-loops itself. Only the server-side `checkRefs` does. That matches the ruling, which scoped the check to `checkRefs`, but a proposal that reached the UI without passing the server would still draw a zero-length arrow. Not blocking.

### Verdict
Fix round passes: all five findings are addressed and the fix introduces no new Critical or Important breakage.
