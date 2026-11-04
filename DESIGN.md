# Blueprint design

Blueprint should feel like a quiet, warm workspace (in the spirit of Notion) with a drafting table in the middle.

- **Your actions are Prussian blue**, the ink a real blueprint is printed in.
- **Claude's work is non-photo blue**, the pencil a draftsman sketches with before inking. A dashed light-blue line means "Claude proposed this; it isn't yours yet."
- **The chrome stays quiet** so the hand-drawn board carries the personality.

All tokens live at the top of [`src/ui/styles.css`](src/ui/styles.css). Every color, size, radius, and shadow in that file comes from a token.

## Type

- **Inter** for the interface, bundled from `@fontsource-variable/inter`, so nothing loads from the network.
- **Cascadia Code** for code, branch names, task files, and citation chips, copied from Excalidraw's package at build time.

| Token             | Size   | Use                                              |
| ----------------- | ------ | ------------------------------------------------ |
| `--fs-xs`         | 12px   | Meta lines, sidebar section names, a turn's cost |
| `--fs-sm`         | 13px   | Tool rows, status, inline errors, prompt pills   |
| `--fs-md`         | 14px   | Body text, buttons, inputs, sidebar rows         |
| `--fs-doc`        | 15px   | Reading text in the spec and document editor     |
| `--fs-lg`         | 16px   | Card and empty-state titles, third-level heads   |
| `--fs-xl`         | 20px   | Second-level headings in the spec and documents  |
| `--fs-2xl`        | 28px   | Top-level headings in the spec and documents     |
| `--fs-code-ratio` | 0.86em | Inline code, relative to the text around it      |

- Line height is 1.5 for UI text and 1.65 for reading text, at a 72-character measure.
- Weights: 400 text, 500 buttons and labels, 600 titles, 700 only for a document's top heading.
- Section names are sentence case, never tracked capitals.

## Color

| Token                          | Value                             | Use                                             |
| ------------------------------ | --------------------------------- | ----------------------------------------------- |
| `--bg`                         | `#ffffff`                         | Paper: main area, Claude panel, cards, inputs   |
| `--surface`                    | `#f7f7f5`                         | Sidebar, code blocks, insets                    |
| `--hover` / `--selected`       | ink at 6% / 9%                    | Row under the pointer / the open page           |
| `--border` / `--border-strong` | `#ebeae6` / `#dcdad5`             | Dividers and cards / controls                   |
| `--text`                       | `#37352f`                         | Body text                                       |
| `--muted`                      | `#6b6a65`                         | Secondary text and icons                        |
| `--faint`                      | `#9b9a97`                         | Hints only, such as placeholders                |
| `--accent` / `--accent-hover`  | `#1d4f8c` / `#163f71`             | Primary buttons, Send, focus rings              |
| `--accent-tint`                | `#e8eef6`                         | Focus halo, citation chips, selected tools      |
| `--ghost` / `--ghost-tint`     | `#5aaed8` / `#edf6fb`             | Dashed edge of Claude's proposals; Pip          |
| `--ai`                         | `#136f96`                         | Claude's own text, such as the proposal summary |
| `--ok` / `--warn` / `--danger` | `#2c7a4b` / `#9a5c08` / `#bd3a2a` | Done / needs you / errors                       |
| `--warn-tint`                  | `#fbf3e6`                         | Permission dialog fill                          |
| `--code-bg`                    | warm grey at 15%                  | Inline code and branch tags                     |
| `--bubble`                     | `#f1f1ef`                         | Your messages                                   |

Text meets 4.5:1 contrast on its surface. `--faint` is the exception and is used only for hints that are labelled elsewhere. `--ghost` is a line color; text in that family uses `--ai`.

## Spacing, radius, shadow, motion

- Spacing is a multiple of 8px. Rows are 8px apart, regions are padded 16px, pages 40px on top and 32px at the sides.
- Radius: `--radius-sm` 4px (code, chips), `--radius` 6px (buttons, inputs, rows), `--radius-lg` 10px (cards, bars), `--radius-xl` 14px (composer, message bubbles), `--radius-pill` for dots, pills, and round buttons.
- Shadow: `--shadow-sm` lifts cards and the composer slightly. `--shadow-float` is for dialogs over the board.
- Motion: hovers and presses take 120ms with `--ease`. Side panels slide in over 180ms. Claude's handoffs ease in: the proposals bar fades in and rises 8px over 200ms, and a permission request fades in and rises 4px over 160ms. Under reduced motion, nothing moves; entrances only fade.

## Layout

- Built for 1280×800 and up. From 1360px the sidebar is 240px and the Claude panel 360px; below that, 200px and 320px.
- Excalidraw keeps its desktop toolbar only while the board is at least 730px wide. To protect that, the sidebar folds to a 48px icon strip below 1250px, and the Claude panel folds away below 1100px.
- A folded Claude panel is a round 56px Pip button at the board's bottom-right corner. Pip hops on it while Claude works.
- Opening a folded side by hand in a narrow window slides it over the board instead of taking a column, so the board and toolbar don't move. Picking a page from the floating sidebar, or pressing Escape in either floating side, folds it again.
- Folding or unfolding moves keyboard focus to the control that replaced the one you pressed. A folded panel opens by itself for Refine and for permission asks.
- A choice to fold or open holds until the window crosses that side's breakpoint. The folded panel stays mounted, so half-typed messages survive.
- In Excalidraw's phone layout (very narrow windows), undo and redo stack in a small column on the board's left instead of a bar across the bottom.

## Components

### Sidebar

- Pip and the Blueprint name at the top, with the fold button always visible.
- Plan (Spec, Tasks, Sessions), then Boards and Documents. Rows are 30px with a 16px Lucide icon.
- **+** next to Boards or Documents opens a name field in the list: Enter creates, Escape or an empty field cancels. A taken name, a name without a letter or digit, or a server error shows under the field.
- Empty lists read "No boards yet" and "No documents yet".
- The interface always spells out "document"; routes and files keep `doc`.

### Empty states

- One component, [`src/ui/EmptyState.tsx`](src/ui/EmptyState.tsx): a title, one line on what the page is for, and the action that fills it. No icons.
- Centered a little above the middle, so every empty page looks the same.
- First run shows a welcome page with three numbered steps and **Create your first board**.
- The Claude panel's empty state offers two or three starting prompts as small grey pills under a faint "Try" label. Clicking one fills the composer; it doesn't send.

### Composer and transcript

- The composer is a white card with a round Send button. Enter sends; Shift+Enter adds a line. While Claude works, Send becomes Stop.
- Placeholder: "Ask Claude anything" (or "…about this board" on a board).
- Your messages are grey bubbles; Claude's are plain text. Tool activity is small grey rows with a dot (call), check (result), or red cross (failure).
- Each turn ends with its cost and a hairline.
- While a turn runs, a live row shows Pip hopping, a shimmering label (the running tool, or a drafting verb such as "Sketching…"), and elapsed time (9s, 4m 30s, 1h 5m).
- The header shows status only when it needs attention: Needs you, Error, Starting, Stopped. Idle and Working are announced to screen readers only.

### Pip

Pip is Blueprint's mascot and logo ([`src/ui/Pip.tsx`](src/ui/Pip.tsx)): a small sheet of blueprint paper in `--ghost` with a folded corner, a faint grid, dot eyes, pink cheeks, and a smile. It's the sidebar logo and the favicon, blinks every few seconds, and hops while Claude works.

### The board (Excalidraw)

Blueprint draws boards with Excalidraw but presents them as its own:

- **Look:** Excalidraw's CSS variables are set to Blueprint's type and colors: Inter, warm greys, Prussian blue, a lighter panel shadow, and a brighter `#3b7ddd` selection outline.
- **Icons:** Lucide icons replace Excalidraw's in the toolbar (20px), menus (16px), zoom, and undo. [`src/ui/board/icons.css`](src/ui/board/icons.css) is generated by `scripts/board-icons.mjs`. Tool number badges are hidden; tooltips still show shortcuts.
- **Removed:** the main menu, Library, Help button, dark mode, and file actions (open, save to file, reset). Find (Cmd+F) and image export (Cmd+Shift+E) still work. The properties panel has no Sloppiness section and no scrollbar.
- **Wording:** [`src/ui/board/rebrand.ts`](src/ui/board/rebrand.ts) rewrites "Excalidraw" to "Blueprint" in Excalidraw's own text, such as "Mermaid to Blueprint". It never touches text outside Excalidraw's containers, find results, or link addresses.
- **Colors and opacity:** a pnpm patch (`patches/`) sets the quick-pick colors (ink, Prussian blue, green, orange, red, and soft tints for fills) and steps opacity by 1%. The slider shows its value as a percentage.
- **More tools:** frame and laser pointer, then Web Embed, then Mermaid import (reordered in the patch, so keyboard order matches).
- **Snapping:** moved shapes snap to their neighbors (Alt+S toggles it), and a single shape rotated to within 5° of a quarter turn lands on it ([`src/ui/board/snap.ts`](src/ui/board/snap.ts)). Arrows, lines, and shapes with arrows attached keep the exact angle you leave them at.

### Proposals

- Proposed shapes are ghosts: 40% opacity with dashed strokes, and removals in red ([`src/ui/board/ghosts.ts`](src/ui/board/ghosts.ts)).
- The proposals bar floats above the board's footer: a plain white bar with a small dashed `--ghost` swatch, the proposal's name in ink and its counts in grey, and Reject and Refine as quiet buttons. It sizes to its content, stays clear of the properties panel, the Pip button, and a floating panel, and shows its full summary as a tooltip when squeezed. **Accept** is the only primary button.
- The selection chip above the composer is solid grey (it's yours). The refine chip is dashed light blue (it names Claude's proposal).

### Permission dialog

Shown in the panel and on run cards when Claude needs approval: a warm amber card with the tool name and summary, and equal-weight buttons for Allow once, Deny, and Allow always (when Claude Code suggests a rule).

### Spec, tasks, and sessions

- **Spec:** read-only Markdown at a 72-character measure. Citations are small blue chips that open the cited shape or heading; citations that no longer resolve are listed in amber. **Split into tasks** is the page's primary button.
- **Tasks:** cards with the file name, title, dependencies, acceptance criteria, and source chips. **Launch** opens an inline dialog with a permission mode select styled like the other controls.
- **Sessions:** run cards in a grid (400px minimum) with a status pill, branch, cost, and PR link. A run that needs you gets an amber pill. Other Claude Code sessions in the repository are listed below.

### Documents

CodeMirror with Blueprint's own highlighting: `--fs-doc` text at a 72-character measure, unstyled headings at the three heading sizes, muted Markdown marks, and Cascadia Code for code. A new, empty document opens with the cursor in it.

### Claude's Markdown

[`src/ui/markdown.tsx`](src/ui/markdown.tsx) renders Claude's text as React elements, so HTML shows as text. It supports paragraphs, headings (from `h3`), emphasis, code, lists (including nested), links (`http`, `https`, `mailto` only, opening in a new tab), and quotes. A single newline is a line break. Code blocks scroll sideways.

## Screenshots

The images in [`docs/design/`](docs/design/) predate the current look; retake them before relying on them.
