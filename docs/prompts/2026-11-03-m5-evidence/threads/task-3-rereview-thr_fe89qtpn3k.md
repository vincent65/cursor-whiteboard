### Finding Verdicts

1. **Duplicate React keys: ADDRESSED.**
   - `src/ui/markdown.tsx` `lines()` now wraps each line in `<Fragment key={n}>`, with the `<br>` inside the fragment, so `inline()`'s per-call index keys no longer share a parent with the next line's keys.
   - The new `listItem()` returns two keyed fragments (`"text"`, `"nested"`), so mixing item text with a nested list also has unique keys.
   - Test: `test/ui/markdown.test.tsx` "markup on several lines of one block renders without a key warning". It spies on `console.error` over a two-line paragraph and a list item with a continuation line, bold on each line, and asserts 4 `strong` elements and no `console.error` call.
   - The report says the test failed before the fix with React's duplicate-key message.

2. **`--fs-code-ratio` token: ADDRESSED.**
   - `src/ui/styles.css` defines `--fs-code-ratio: 0.9em` in `:root`.
   - `.md code` uses `font-size: var(--fs-code-ratio)`, replacing 0.88em.
   - `src/ui/docs/DocView.tsx` uses `fontSize: "var(--fs-code-ratio)"` for the `tags.monospace` highlight.
   - The `DESIGN.md` type table gains the row.

3. **Balanced parentheses in link URLs: ADDRESSED.**
   - The `href` group in `INLINE` is now `(?:[^\s()]|\([^\s()]*\))+`.
   - The two alternatives start on different characters, so the pattern has no backtracking blow-up.
   - Test: "a link URL keeps its balanced parentheses" asserts the full `https://en.wikipedia.org/wiki/Foo_(bar)` href.

4. **Intraword single asterisk: ADDRESSED.**
   - The `i1` alternative is now `(?<!\w)\*(?<i1>…)\*(?!\w)`.
   - Test: "an asterisk inside a word is not emphasis" covers `a*b and c*d` (no `em`, text preserved) and `*word*` (still `em`).

5. **One level of list nesting: ADDRESSED.** The fix goes further than asked: nesting goes as deep as the indentation.
   - `sibling()` only accepts items indented less than `base + 2`.
   - Deeper item lines join the item above through `indent(l) > base`.
   - `listItem()` splits the item at its first nested item line, dedents those lines by their minimum indent, and passes them back through `blocks()`.
   - I traced these cases:
     - A different list kind nested under an item (`- a` / `  1. b`) works.
     - Same-level items of a different kind still break into a separate list.
     - Lazy continuation lines go to the nested item, as CommonMark does.
     - `Math.min` never gets an empty array, because the item line at index `k` is non-empty.
   - Test: "an item indented under another starts a nested list" covers an unordered list with two nested items and an ordered list with one nested item.

6. **Tight punctuation after inline code: ADDRESSED.**
   - `.md code` padding is now `0 calc(var(--space) / 4) 0 calc(var(--space) / 2)`, which is 4px before and 2px after. This is CSS only, as the ruling asked.
   - `docs/design/after-panel-markdown.png` was retaken; the binary changed in the diff.
   - `DESIGN.md` documents both the padding and the nesting.

**Tests:** the report names the four new tests, says each was written first and failed first, and shows `pnpm check` (387 passed, Biome clean) and `pnpm e2e` (3 passed). Both claims match the diff.

### New Breakage in the Fix Diff

None at Critical or Important level.

One Minor imprecision (non-blocking):
- The `ponytail:` comment at the top of `src/ui/markdown.tsx` says a blank line inside a nested list "ends it".
- In fact it ends the whole outer list: `sibling(src[i + 1])` rejects the indented next item.
- The rest of the nested items then render as a separate top-level list.
- The behaviour is an accepted ceiling, but the comment understates it.

### Out-of-Scope Observations

- `(?<!\w)\*…\*(?!\w)` follows the ruling. It is stricter than CommonMark, which allows asterisk emphasis inside a word: `foo*bar*` and `*word*s` render as emphasis in CommonMark, and here they stay text. Non-blocking, since the ruling asked for this.
- Tables and the chip's `board:`/`doc:` label remain deferred, as ruled.

### Verdict

Fix round: all six findings are addressed, with no new Critical or Important breakage.
