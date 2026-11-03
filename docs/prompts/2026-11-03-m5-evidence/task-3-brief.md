### Task 3: Design pass and restyle

**Files:**
- Create: `DESIGN.md`, `src/ui/markdown.tsx`
- Modify: `src/ui/styles.css`, `src/ui/panel/TranscriptList.tsx`, components whose class names change
- Test: `test/ui/markdown.test.tsx`, existing UI tests as class names change

**Interfaces:**
- `DESIGN.md` (each sentence on its own line): the product's feel in three sentences, the type scale, the color tokens with their roles (surface, text, muted, accent, ok, warn, danger, ghost, AI-made), spacing and radius scales, and one section per component that needs care: the ghost styling and proposals bar, selection and refine chips, the permission dialog, the status strip, the run cards, the spec view's citations, and the tasks view's cards. Use the frontend-design skill for the direction.
- `styles.css`: every color, font size, radius, and shadow comes from a `--token`; the 15 raw hex values are gone.
- `src/ui/markdown.tsx`: `export function Markdown({ text }: { text: string }): JSX.Element` builds React elements for the subset named above; raw HTML in the input renders as text. `TranscriptList` uses it for assistant text.
- Visual check: before and after screenshots of the board with a pending proposal, the panel mid-answer with Markdown, the spec view, the tasks view, and the sessions view, at 1280 by 800, saved under `docs/design/` and referenced from `DESIGN.md`.

- [ ] **Step 1: Write the failing Markdown tests** (each construct; `<script>` and `<img onerror>` render as text; a link gets `target="_blank"` and `rel="noreferrer"`)
- [ ] **Step 2: Implement the renderer, write `DESIGN.md`, restyle**, taking before and after screenshots with the built app on the fake SDK.
- [ ] **Step 3: `pnpm check` and `pnpm e2e`**, both green.
- [ ] **Step 4: Commit** `feat(ui): design tokens, the restyle, and rendered Markdown`

---

