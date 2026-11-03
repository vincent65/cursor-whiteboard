### Spec Compliance
- Spec compliant, with one small token deviation (Minor 1).
- `DESIGN.md` has everything the brief asks for:
  - The feel in exactly three sentences.
  - The type scale.
  - All nine required color roles: surface, text, muted, accent, ok, warn, danger, ghost, and AI-made as `--ai`.
  - The spacing and radius scales.
  - One section for each of the seven named components.
  - A before-and-after table that links the screenshots.
- `src/ui/markdown.tsx:166` exports `Markdown({ text })`. It also takes an optional `renderCitation`, which fix round 0 asked for. `TranscriptList.tsx:8-12` uses it for assistant text.
- Raw hex values appear only inside `:root`. Every radius and shadow uses a token, and so does every font size except one (Minor 1). I checked this by pulling the new stylesheet out of the diff and grepping outside `:root`.
- The brief's Markdown tests are all in `test/ui/markdown.test.tsx`:
  - One test per construct.
  - `<script>` and `<img onerror>` render as text (lines 99-110).
  - Links get `target="_blank"` and `rel="noreferrer"` (lines 86-92).
- Screenshots: all 11 PNGs are 1280 by 800 (checked with `sips`). The five required views each have a before and after shot.
- No em dash in `DESIGN.md`, `markdown.tsx` or `styles.css`. Each sentence in `DESIGN.md` is on its own line. No "Claude Code" text appears in `src/ui`.
- The fonts the stylesheet names (`Assistant-{Regular,SemiBold,Bold}.woff2` and `CascadiaCode-Regular.woff2`) exist in Excalidraw's `dist/prod/fonts`. `scripts/copy-excalidraw-assets.mjs` copies them into `/fonts`.
- No stale class names are left. A grep of src, test and e2e finds `.notice` used only by BoardView, SpecView and DocView, all of which the stylesheet still styles. `.spec-editor` and `.cm-*` no longer appear in `styles.css`.
- Extra work, all disclosed and reasonable:
  - TasksView sources now use the `CitationLink` chip.
  - `DocView.tsx` changed, though it was not on the brief's file list.
  - `@codemirror/language` and `@lezer/highlight` became direct dependencies. They were already installed transitively, so the lockfile adds no new packages.
- Cannot verify from the diff: the claims "`pnpm check` pristine, 383 tests", "`pnpm build` only chunk warning" and "`pnpm e2e` 3/3 three times". The report gives only summaries and pastes no output.

### Strengths
- **Safe renderer.** It builds React text nodes only, with no `innerHTML`. Only `http:`, `https:` and `mailto:` links become anchors (`markdown.tsx:19`, `:35-44`), and a test pins the `javascript:` case.
- **No infinite loop.** Every block branch consumes at least one line, and the paragraph loop always takes its first line (`markdown.tsx:150-159`).
- **Known limits are labelled.** A `ponytail:` comment names the missing constructs (`markdown.tsx:9`).
- **Spec view is much simpler.** Dropping CodeMirror removed about 60 lines of decoration and click code. A test now covers live reload (`SpecView.test.tsx:84-96`).
- **DocView cleanup.** It lost its inline styles and its old `ponytail:` debt. Its `HighlightStyle` correctly replaces basicSetup's fallback style (`DocView.tsx:32-46`).
- **Accessibility.** Contrast was measured (`--warn` was darkened to `#9a5c08`). Reduced motion is respected, and focus-visible rings are in place.
- **Screenshots look right.** In the two I opened (panel and spec), headings, lists, quotes, the scrolling code block, the warn callout and the citation chip all render as `DESIGN.md` describes.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
1. **Duplicate React keys whenever two lines of one block both contain inline markup** (`src/ui/markdown.tsx:61-68`, with keys assigned at `:30`).
   - `inline()` keys its elements by their index in its own output array. `lines()` then spreads several of those arrays into one list, separated by `<br key={out.length}>`.
   - So `"**Note:** one\n**Also:** two"` produces `strong key=0`, `br key=1`, `strong key=0`.
   - Claude often writes one sentence per line with bold or code, so the panel will hit this on ordinary output.
   - I ran a scratch vitest in `$TMPDIR`, outside the repo. React logged `Encountered two children with the same key, '0' ... may cause children to be duplicated and/or omitted`.
   - The suite misses it because no test puts inline elements on two lines of the same paragraph or list item. The repo already guards against key warnings elsewhere (`TasksView.test.tsx:171-172`, `expect(error).not.toHaveBeenCalled()`).
   - Fix: wrap each line in `<Fragment key={n}>`. Add a test that spies on `console.error` for a multi-line paragraph with bold on each line.

#### Minor (Nice to Have)
1. **Two font sizes are hard-coded ratios, not tokens.**
   - `styles.css` sets `.md code { font-size: 0.88em }`, which breaks the brief's "every font size from a `--token`".
   - DocView's highlight style uses `fontSize: "0.9em"` for monospace (`DocView.tsx:41`).
   - The two ratios disagree. Use one token, for example `--fs-code-ratio`, in both places.
2. **Link URLs that contain `)` get cut short.** The href pattern `[^\s)]+` (`markdown.tsx:17`) turns `[x](https://en.wikipedia.org/wiki/Foo_(bar))` into a broken link with a stray `)` after it.
3. **Single-asterisk italics can span unrelated asterisks.** The pattern `\*(\S(?:.*?\S)?)\*` matches across words, so `a*b and c*d` becomes italic. This is unlike CommonMark.
4. **The spec view now loses detail on nested lists, tables and rules.**
   - Previously CodeMirror showed the spec's raw Markdown exactly. Now nested list items collapse into their parent as `<br>` text, and tables show as pipes.
   - This is a known limit (`markdown.tsx:9`), but it now applies to the generated spec, not only to chat.
   - Worth confirming that the compile prompt never emits nested lists.
5. **The chip label drops `board:` or `doc:`** (`plan/citations.tsx:16`). The report already flags this. Only the tooltip says which kind a citation is.
6. **Spacing glitch in the screenshot.** In `after-panel-markdown.png`, the inline code's side padding leaves a visible gap before the period after `[[board:main#login]]`.
7. **Test evidence is summary-only.** The report gives no pasted test or e2e output, so its verification claims cannot be checked from the report.

### Assessment
Task quality: Needs fixes

Reasoning: The task meets the brief, and the renderer, tokens and docs are well-made. However, the Markdown renderer gives two elements the same React key on common sentence-per-line output (confirmed with a scratch run), which React warns can drop or duplicate content. It needs a one-line fix and a regression test before this task can be trusted.
