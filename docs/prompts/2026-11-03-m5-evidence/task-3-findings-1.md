# Task 3 findings, round 1 (from review thr_e2w7k5wa8q, with controller rulings)

## Important
1. Duplicate React keys when two lines of one block both contain inline markup (`inline()` keys by its own index; `lines()` concatenates). Ruling: wrap each line's nodes in `<Fragment key={n}>`; add a test that spies on `console.error` for a multi-line paragraph and a list item with bold on each line and asserts it is never called.

## Minor (fix in this round)
2. One token for the code font ratio (`--fs-code-ratio`), used by `.md code` and by DocView's monospace highlight.
3. Link URLs may contain balanced parentheses: `[x](https://en.wikipedia.org/wiki/Foo_(bar))` keeps the whole URL. Test it.
4. Single-asterisk italics follow CommonMark's flanking rule closely enough that `a*b and c*d` stays plain text (the opening `*` must not follow a word character, the closing `*` must not precede one). Test both the plain case and `*word*`.
5. Lists support one level of nesting (an item indented by two or more spaces under a list item becomes a nested list), since the compiled spec may use them. Test it.
6. Inline code followed by punctuation shows no gap: trim the trailing side padding so `` `x`. `` reads tight (CSS only), and retake `after-panel-markdown.png`.

## Deferred (do not address)
- Tables render as text; the chip label omits `board:`/`doc:` (the tooltip carries it).
