# untitled (thr_gj7icnha3c)

### Spec Compliance
- Spec compliant. All five Interfaces items are exported with the exact names, parameters and return types (`src/export/citations.ts:3-8`, `:15`, `:25`, `:35-38`, `:52-55`). They are re-exported through `src/export/index.ts:2`.
- The citation regex matches the brief character for character (`citations.ts:10`).
- The slug rule matches the brief: lowercase, strip anything that is not a letter, digit, space or hyphen, then turn each space into a hyphen (`citations.ts:28-31`).
- All four brief tests exist. Tests 1, 2 and 4 copy the brief's inputs and expected values exactly (`test/export/citations.test.ts:9-27`, `:68-75`).
- The brief left test 3 as `...`. The implementation fills it in properly: one node, one edge, one loose element and two doc headings, checked against an exact Set (`citations.test.ts:29-66`).
- Only the three listed files were touched. No extra exports: `key` stays private (`citations.ts:13`).
- The commit message is `feat(export): citation grammar, heading slugs and index` and the report says it has no trailers. That matches.
- Purity holds: the only import is a type import from `./schema.js` (`citations.ts:1`). No I/O, no server or UI imports.
- Cannot verify from the diff: whether the tests run with vitest globals (`test`/`expect` are not imported). I took the reported `pnpm check` result (23/23 passing, tsc clean) as evidence that the existing config provides them.

### Strengths
- The code is small and direct, and each function is a few lines.
- `parseCitations` uses `matchAll`, so the shared global regex has no `lastIndex` problems. `String.replace` with a `/g` regex also resets `lastIndex`, so reusing `CITATION` at `:59` is safe.
- `dropUnknownCitations` filters with a set of raw strings. That is correct: identical raw text always produces the same key, so a citation cannot be both known and unknown.
- Trimming the heading before slugging stops trailing spaces from turning into trailing hyphens.
- The report's concerns are honest and accurate. The underscore divergence, duplicate-slug suffixes and headings inside code fences are all real and all correctly marked non-blocking.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
- **Closing hashes leave a trailing hyphen** (`citations.ts:11`, `:28-31`). In a heading like `## Tokens ##`, the trim runs before the `#` characters are stripped. The text becomes `tokens `, then `tokens-`, where GitHub produces `tokens`. A valid citation `[[doc:x.md#tokens]]` would then be dropped. One fix: strip optional closing hashes in the heading regex (`/^#{1,6} (.*?)(?:\s+#+)?\s*$/gm`), or trim again after stripping.
- **Some valid headings are skipped** (`citations.ts:11`). The regex requires exactly one leading space after the hashes. CommonMark also allows up to 3 spaces of indent before the hashes and a tab after them. Rare in practice; matters only if docs are hand-written that way.
- **Fenced code blocks** (already in the report). A `# comment` line inside a fenced code block adds a fake doc key. That can only keep a citation that should have been dropped, never drop a valid one, so it is low risk for this task.
- **Test name claims more than it checks** (`citations.test.ts:23`). The test is named "heading slugs follow GitHub rules", but the brief's rule strips `_` and GitHub keeps it. This divergence comes from the brief itself. Renaming the test or adding a short comment would stop someone later "fixing" it in only one place.

### Assessment
Task quality: Approved
Reasoning: The implementation matches the brief's interfaces, regex, slug rule and tests exactly, with a clean, pure, minimal diff. What remains is minor edge cases in ATX heading parsing that don't affect the contract.
