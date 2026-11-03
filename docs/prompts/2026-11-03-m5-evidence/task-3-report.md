# Task 3 report: design pass and restyle

Status: DONE_WITH_CONCERNS (minor; see the end).
Commit: `010816a feat(ui): design tokens, the restyle, and rendered Markdown`, on top of BASE `ba9bd0e`.

## What I implemented

- `src/ui/markdown.tsx`: `Markdown({ text })`, a hand parser into React nodes with no dependency and no `innerHTML`.
  It covers paragraphs, headings, strong and emphasis (`*`, `_`, `**`, `__`, with no emphasis inside words for underscores), inline code, fenced code (backtick or tilde, an unclosed fence runs to the end), unordered and ordered lists (with `start`), links, block quotes (recursive), and backslash escapes.
  Everything else stays as text.
  Every string goes in as a text node, so `<script>` and `<img onerror>` are shown as text.
  Links get `target="_blank"` and `rel="noreferrer"`, and only `http:`, `https:`, and `mailto:` hrefs become links; anything else, such as `javascript:`, stays as its raw text.
  A single newline is a `<br>`, which keeps the old `pre-wrap` behaviour for Claude's sentence-per-line output.
  Headings render as `h3` to `h6` (Markdown level plus 2), below the panel's `h2`.
  Known ceiling, marked with a `ponytail:` comment: no nested lists, tables, or images; an indented item joins the list.
- `TranscriptList` renders assistant text through `Markdown` inside `.msg-assistant` (now a `div`).
  This applies to the panel, run cards, and other sessions alike.
- `src/ui/styles.css` rewritten onto tokens: 19 color tokens, a type scale (`--fs-xs` 12, `--fs-sm` 13, `--fs-md` 15, `--fs-lg` 17), four radii, one shadow, and two fonts.
  Outside `:root` there is no raw hex, no raw font size, no raw radius, and no raw shadow.
  The direction: Prussian blue (`--accent`) for your actions, non-photo blue for Claude (`--ghost` dashed line and tint for proposals not yet yours, `--ai` for Claude's ink), and status tokens `--ok`, `--warn`, `--danger`, `--muted` shared by the panel status strip and the run pills.
  The UI face is Assistant and code is Cascadia Code, both already served from `/fonts` by the Excalidraw asset copy, so nothing new is downloaded or depended on.
- Class changes: `PermissionDialog` uses `.ask` and `.ask-text` (it was `.notice`, which lied: the panel and run cards each restyled it with descendant rules).
  `DocView`'s inline styles moved to `.doc`, `.doc-editor`, `.notice`, and `.button`, which removes its old `ponytail:` debt and gives the conflict banner hover and focus states.
  The shared CodeMirror theme in `DocView.tsx` now colors the gutter from tokens (spec and docs).
- Sessions view: `.sessions-page` is one column up to 1120px, and `.run-grid` uses `auto-fit` with a 400px minimum, so a lone card takes the full width and two sit side by side; the rate-limit note and Other sessions share the same edges.
- Sidebar section names are sentence case, not tracked capitals; "New board" and "New doc" are quiet `+` rows.
- `DESIGN.md` at the repo root, each sentence on its own line, with the feel, type scale, color roles, spacing and radius scales, one section per named component, Claude's Markdown, and the before and after table.
- `docs/design/`: ten screenshots, before and after, at 1280 by 800.

## TDD evidence

- Wrote `test/ui/markdown.test.tsx` (14 tests) first; it failed because `src/ui/markdown` did not exist.
- Implemented the renderer; 14 of 14 passed.
- I adjusted one of my own new expectations before implementing: a list item's continuation line is a `<br>`, consistent with paragraphs.
- `test/ui/ClaudePanel.test.tsx` asserted a literal `\n` in the assistant row (`pre-wrap`); it now asserts `Two boxes.<br>One arrow.`, the same line break as rendered Markdown.

## Verification

- `pnpm check`: pristine; 381 tests pass; biome reports no errors or warnings (I fixed three `noDescendingSpecificity` warnings with `:where(blockquote)`).
- `pnpm build`: only the pre-existing chunk size warning.
- `pnpm e2e` three times in a row: 3 passed, 3 passed, 3 passed (run outside the sandbox, as in Task 2).

## Manual observations

I drove the built CLI on the fake SDK in a scratch git repository with a scratch Playwright script and a scratch scenario (both in `.superpowers/sdd/2026-11-03-m5-evidence/task-3-evidence/`, ignored).
The scratch scenario is `e2e/scenario.json` plus a rule whose answer is rich Markdown followed by a Bash ask, so the panel can be caught mid-answer; `e2e/scenario.json` itself is unchanged.

Before:
- Assistant Markdown showed raw `##`, `**`, backticks, and fences.
- The look was a generic system-ui, Tailwind-blue kit; the permission dialog in the panel was an unmarked grey band; the proposals bar did not relate to the ghosts it decides.
- Sidebar labels were tracked capitals.
- Sessions: with two runs the grid already had two columns, but a single run sat in a half-width column (the controller's observation in the demo).

After:
- The panel renders headings, bold, italics, inline code, a numbered list, a quote, a scrolling code block, and a link.
- The proposals bar is dashed non-photo blue with the summary in `--ai`; the refine chip matches it, and the selection chip is solid ink.
- The permission dialog is a warn callout with a 4px left edge, in both the panel and the run card; Needs you is bold warn in the status strip and a warn pill on the card.
- Citations in the spec and task sources are accent tags with a ghost underline; the e2e check that the citation is underlined still holds.
- A doc page (extra check, not committed: `task-3-evidence/doc.png`) fills the height with the token gutter, so the `DocView` class move did not break its layout.
- Contrast: every text token is at least 4.5 to 1 on its surface; I darkened `--warn` to `#9a5c08` after measuring 4.29 on its tint.

## Files changed

- Created: `DESIGN.md`, `src/ui/markdown.tsx`, `test/ui/markdown.test.tsx`, `docs/design/{before,after}-{board-proposal,panel-markdown,spec,tasks,sessions}.png`.
- Modified: `src/ui/styles.css`, `src/ui/panel/TranscriptList.tsx`, `src/ui/panel/PermissionDialog.tsx`, `src/ui/docs/DocView.tsx`, `test/ui/ClaudePanel.test.tsx`.

## Self-review findings

- No `dangerouslySetInnerHTML`, no new dependency, no em dash, and no "Claude Code" in UI copy.
- `INLINE` is a global regex used only through `matchAll`, which copies it, so it carries no `lastIndex` state between calls.
- The CSS has no ordering conflict that biome flags; the `.task-card > * + *` margin is overridden for `.task-action` by a two-class selector, on purpose.
- I removed `--fs-xl` after writing it, because nothing used it.

## Concerns

1. CodeMirror's default highlight style still underlines Markdown headings in the spec and doc editors (visible in `after-spec.png`).
   Restyling it needs `HighlightStyle` from `@codemirror/language`, which is only a transitive dependency, so I left it and noted it in `DESIGN.md`.
2. `DocView.tsx` was not on the brief's file list; I changed it because its inline styles were the last raw radius outside the tokens and its own `ponytail:` comment asked for this once a button class existed.
3. Excalidraw's toolbar keeps its own purple; overriding its `--color-primary` variables is possible but is the canvas library's UI, which I read as out of scope.
4. The tool-result row with raw propose JSON (`{"proposalId":...}`) and absolute paths in tool rows are still visible in the screenshots; both are Task 4 items.
5. The demo videos in `docs/demo/` predate the restyle; the final re-record is assigned to Task 4.

## Fix round 0

Commits:
- `68613ef feat(ui): the spec reads as a document, with citation chips`
- `a75c7fb feat(ui): the doc editor's own highlight style, without heading underlines`

### 1. The spec as a document

- `Markdown` takes an optional `renderCitation(c: Citation)`.
  The inline pass recognises `[[board:…#…]]` and `[[doc:…#…]]` (the same pattern as `src/export/citations.ts`) and hands the parsed citation to the hook, or leaves the raw text when no hook is given, so the panel is unchanged.
  Citations inside inline code stay code.
- `src/ui/plan/citations.ts` became `citations.tsx`: `citationHash` is unchanged, and a new `CitationLink` renders the chip (`<a class="cite" href={citationHash(c)} title={raw}>page#id</a>`).
  `citationMarks` existed only for the CodeMirror decorations, so it and its test are gone.
- `SpecView` no longer mounts CodeMirror; it renders `<article class="spec-doc"><Markdown renderCitation=…/></article>`.
  The dropped-citations line, Split, the splitting state, and live reload on `file-changed` are unchanged.
- The tasks view's sources use the same `CitationLink`, so a citation looks the same in the spec and on a task card.
  This changed the link names in `TasksView.test.tsx` from `[[board:main#a1]]` to `main#a1`.
  You did not ask for this one; I made it so a citation does not look one way in the spec and another on a task card.
- CSS: `.spec-doc` sets a 72-character measure with a line height of 1.6, `--fs-xl` (22px, restored) for the top heading, and `--fs-lg` for the second level; `.cite` is a mono chip on `--accent-tint` with an accent border on hover and a focus ring.
- Found and fixed while checking the screenshots: `.md :is(ul, ol)`, `.md :is(h3…h6)`, and `.md blockquote` reset `margin` to 0 and so cancelled the 8px sibling gap, which made lists sit tight against the paragraph above them in the panel too.
  Margins now come only from the two sibling rules.
- e2e compile flow: the citation locator is now `getByRole("link", { name: "main#login" })` with `title` `[[board:main#login]]`, replacing the CodeMirror text and underline check.

TDD: I wrote the new tests first and ran them before the implementation: 6 failed (the Markdown citation hook, the SpecView document and chip, the chip click changing `location.hash` to `#/boards/main?focus=a1`, live reload replacing the shown headings, and the two TasksView link names).
All of them pass after the change.

### 2. The doc editor's headings

- Added `@codemirror/language@^6.13.1` and `@lezer/highlight@^1.2.5` as direct dependencies, at the versions already installed (lockfile: 6 lines, no new packages).
  `@lezer/highlight` was needed as well because `@codemirror/language` does not re-export `tags`.
  `pnpm add` had to run outside the sandbox, because the sandbox cannot write pnpm's global store.
- `DocView` adds a `HighlightStyle`: `heading1` at `--fs-xl`, `heading2` at `--fs-lg`, all headings 700 weight with no underline, strong, emphasis, strikethrough, links and URLs in `--accent`, monospace in Cascadia Code, and marks and quotes in `--muted`.
  It replaces basicSetup's fallback default style, so it covers every tag a doc uses.
  `theme` is no longer exported, because the spec view was its only other user.

### Verification

- `pnpm check`: pristine, 383 tests pass; I fixed a `noDescendingSpecificity` warning on the new spec rule with `:where`.
- `pnpm e2e` three times: 3 passed, 3 passed, 3 passed.
- I retook all the after screenshots, because the citation chip and the list spacing change the tasks and panel shots too; `docs/design/after-doc.png` is new and is referenced from `DESIGN.md`.
- Observed: the spec shows "Spec" at 22px, "Goals" and "Acceptance criteria" at 17px, bulleted lists, and a `main#login` chip; the doc editor shows `# Notes` and `## Caching` bold without underlines, the marks muted, the link in accent, and the code in mono.
- `DESIGN.md` gains a "Spec view and its citations" section, a "Doc editor" section, the `--fs-xl` row, and the doc row in the screenshot table.

### Concerns

- Splitting the work into two commits put `DESIGN.md` in the second commit, so the first commit's spec change is documented only from the second commit on.
- The chip label drops the `board:` or `doc:` kind; doc citations still read as docs because their page ends in `.md`, and the raw form is in the tooltip.

## Fix round 1

These apply the rulings in `task-3-findings-1.md`.
Commits:
- `27d8e64 fix(ui): Markdown keys each line, keeps parentheses in URLs, skips intraword asterisks, and nests lists`
- `a9c8a32 style(ui): one token for the code font ratio, and tight punctuation after inline code`

### What changed

1. Important, duplicate keys: `lines()` now wraps each line's nodes in `<Fragment key={n}>`, with the `<br>` inside the fragment, so markup on two lines of one block no longer shares a key.
   Test: a paragraph and a list item with bold on each line, rendered with `console.error` spied; it is never called.
2. `--fs-code-ratio: 0.9em` is used by `.md code` (was 0.88em) and by the doc editor's monospace highlight (was 0.9em).
3. Link URLs allow one level of balanced parentheses: `(?:[^\s()]|\([^\s()]*\))+`.
   Test: `[x](https://en.wikipedia.org/wiki/Foo_(bar))` keeps the whole href.
4. Single-asterisk emphasis now needs a non-word character before the opening `*` and after the closing `*`.
   Test: `a*b and c*d` stays plain text, and `*word*` is still emphasis.
5. Nested lists: an item line indented two or more spaces past the list's first item belongs to the item above, and `listItem` renders the item's text and then, from its first indented item on, the dedented lines through `blocks()`, so nesting goes as deep as the indentation.
   Test: an unordered list with two nested items, and an ordered list with a nested ordered item.
   The `ponytail:` comment now says that a blank line inside a nested list ends it.
6. `.md code` padding is 4px before and 2px after, so `` `x`. `` reads tight; `after-panel-markdown.png` was retaken, along with the other after shots, which look the same.
   `DESIGN.md` gains the token row and two sentences under Claude's Markdown.

TDD: I wrote the four tests for items 1, 3, 4, and 5 first; all four failed (React's "Encountered two children with the same key" for item 1, and assertion failures for the rest), then passed after the change.
Items 2 and 6 are CSS only and were checked in the rebuilt app's screenshot.

### `pnpm check`

```
> blueprint@ check /Users/vincentyip/programming/cursor-whiteboard
> tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.server.json && biome check . && vitest run
Checked 142 files in 155ms. No fixes applied.
 RUN  v5.0.5 /Users/vincentyip/programming/cursor-whiteboard
 Test Files  53 passed (53)
      Tests  387 passed (387)
   Start at  01:29:49
   Duration  11.10s (tests 36%, environment 27%, setup 18%, import 13%, transform 5%, worker 1%)
    Isolate  53 workers spawned · ~603ms startup each (spawn + environment, per file)
             at least ~2.95s faster with isolate: false — reuses workers across files instead of one per file
```

### `pnpm e2e`

```
> blueprint@ e2e /Users/vincentyip/programming/cursor-whiteboard
> playwright test --project=e2e

Running 3 tests using 1 worker

  ✓  1 [e2e] › e2e/flows.spec.ts:60:1 › plan, ask, and accept (3.2s)
  ✓  2 [e2e] › e2e/flows.spec.ts:100:1 › compile and split (1.9s)
  ✓  3 [e2e] › e2e/flows.spec.ts:170:1 › launch a run (991ms)

  3 passed (9.3s)
```

### Concerns

- The inline code chip is now 2px narrower on its right side than its left, as the ruling asks; at this size it does not show.
- The deferred items stay deferred: tables render as text, and the chip label omits `board:` or `doc:`.
