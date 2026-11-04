# Blueprint design

## Feel

Blueprint is a drafting table set in a warm, quiet workspace in the spirit of Notion: white paper, warm grey rails, soft ink, and controls that only show their edges when you reach for them.
Your actions are in Prussian blue, the pigment a real blueprint is printed in, and Claude's work is in non-photo blue, the pencil a draftsman sketches with because it does not reproduce until someone inks it.
The chrome stays quiet so the hand-drawn board carries the personality, and the one bold move is that dashed, light-blue line meaning "Claude proposed this and it is not yours yet".

The tokens live at the top of [`src/ui/styles.css`](src/ui/styles.css).
Every color, font size, radius, and shadow in that file comes from one of them.

## Type

The interface is set in Inter, bundled from `@fontsource-variable/inter` and imported in `src/ui/main.tsx`, so it ships with the app and nothing loads from the network.
Code, branch names, task file names, and citation chips are set in Cascadia Code, served from `/fonts` after being copied in from Excalidraw's package at build time.
Text is antialiased and uses Inter's `cv11` single-storey a.

| Token             | Size   | Use                                                                         |
| ----------------- | ------ | --------------------------------------------------------------------------- |
| `--fs-xs`         | 12px   | Meta lines, sidebar section names, the composer hint, the turn's end        |
| `--fs-sm`         | 13px   | Tool rows, the status strip, inline errors                                  |
| `--fs-md`         | 14px   | Body text, buttons, inputs, sidebar links                                   |
| `--fs-doc`        | 15px   | Reading text in the spec and the doc editor                                 |
| `--fs-lg`         | 16px   | Card titles, empty-state titles, a third-level heading in the spec and docs |
| `--fs-xl`         | 20px   | A second-level heading in the spec and docs                                 |
| `--fs-2xl`        | 28px   | The top-level heading in the spec and docs                                  |
| `--fs-code-ratio` | 0.86em | Code inside text, relative to the text around it                            |

Body text uses a line height of 1.5, and reading text 1.65 at a 72-character measure.
Weights are 400 for text, 500 for buttons, links, and labels, 600 for titles, and 700 only for a document's top-level heading.
Headings of 20px and up are tracked in slightly, by 0.01em to 0.02em.
Section names in the sidebar are sentence case, not tracked capitals.

## Color

| Token             | Value                     | Role                                                              |
| ----------------- | ------------------------- | ----------------------------------------------------------------- |
| `--bg`            | `#ffffff`                 | Paper: the main area, the Claude panel, cards, inputs             |
| `--surface`       | `#f7f7f5`                 | The sidebar, folded strips, code blocks, a run's transcript       |
| `--hover`         | `rgb(55 53 47 / 0.06)`    | A row or quiet control under the pointer                          |
| `--selected`      | `rgb(55 53 47 / 0.09)`    | The open page in the sidebar, the selection chip                  |
| `--border`        | `#ebeae6`                 | Rules between regions and around cards                            |
| `--border-strong` | `#dcdad5`                 | Controls: buttons, inputs, the composer                           |
| `--text`          | `#37352f`                 | Ink for all body text                                             |
| `--muted`         | `#6b6a65`                 | Secondary text: descriptions, tool rows, icons, meta lines        |
| `--faint`         | `#9b9a97`                 | Hints only: placeholders, the composer hint, the turn's end       |
| `--on-accent`     | `#ffffff`                 | Text on an accent fill                                            |
| `--accent`        | `#1d4f8c`                 | Prussian blue: primary buttons, Send, focus rings, the brand mark |
| `--accent-hover`  | `#163f71`                 | A primary button under the pointer                                |
| `--accent-tint`   | `#e8eef6`                 | The focus halo around the composer, the citation chip             |
| `--ghost`         | `#5aaed8`                 | Non-photo blue line: the dashed edge of anything Claude proposed  |
| `--ghost-tint`    | `#edf6fb`                 | The fill behind a ghost line on the refine chip                   |
| `--ai`            | `#136f96`                 | AI-made: the proposal summary and the Working dot                 |
| `--ok`            | `#2c7a4b`                 | Idle in the panel, a run that is Done                             |
| `--warn`          | `#9a5c08`                 | Needs you, and a citation the spec dropped                        |
| `--warn-tint`     | `#fbf3e6`                 | The fill of a permission dialog                                   |
| `--danger`        | `#bd3a2a`                 | Errors and a failed run                                           |
| `--code-bg`       | `rgb(135 131 120 / 0.15)` | Inline code and branch tags                                       |
| `--bubble`        | `#f1f1ef`                 | Your messages in the transcript                                   |

Text colors meet a 4.5 to 1 contrast ratio on the surfaces they sit on, except `--faint`, which is kept to hints that also have a label or are repeated elsewhere.
`--ghost` is a line color only; text in the ghost family uses `--ai`.
Excalidraw's own toolbar keeps its own colors, and the canvas draws ghosts itself (see below).

## Spacing, radius, and shadow

Spacing is a multiple of `--space`, which is 8px: 4, 8, 12, 16, 20, 24, 32, and 40 pixels.
Rows inside a region are 8px apart, regions are padded 16px, and full pages are padded 40px on top and 32px at the sides.

| Token           | Value | Use                                                               |
| --------------- | ----- | ----------------------------------------------------------------- |
| `--radius-sm`   | 4px   | Inline code, branch tags, citation chips                          |
| `--radius`      | 6px   | Buttons, inputs, sidebar rows, icon buttons, the selection chip   |
| `--radius-lg`   | 10px  | Cards, suggestions, the welcome steps, the floating proposals bar |
| `--radius-xl`   | 14px  | The composer and your message bubble                              |
| `--radius-pill` | 999px | Status dots, status pills, the Send button                        |

`--shadow-sm` lifts cards and the composer off the paper by a hair; `--shadow-float` is only for the proposals bar, because only it floats over the canvas.
Hover and press changes ease over 120ms with `--ease`.

## Layout

The layout is built for a window at least 1280 by 800.
From 1360 px wide the rail is 240px and the Claude panel 360px; below that they narrow to 200px and 320px, so at 1280 the board is 760px wide.
Excalidraw keeps its desktop toolbar only while the board is at least 730px wide, and its phone toolbar needs about 480px, so narrower windows fold the side columns into 48px strips: the rail below 1100px and the panel below 860px.
Either side can also be folded or opened by hand, from the button in its header or strip; that choice holds until the window crosses its breakpoint again.
The folded panel stays mounted, so a half-typed message and the transcript survive, and its strip shows the session's status dot.

## Components

### Sidebar

The rail opens with the Blueprint mark and name; its fold button appears when the pointer is over the rail.
Each row is a Lucide icon at 16px in `--muted` and a label, 30px tall, on `--hover` under the pointer and `--selected` with a 600 weight when it is the open page.
Spec, Tasks, and Sessions sit under Plan, then Boards and Docs, each section name with a `+` icon button on its right.
The `+` opens a name field at the top of its list instead of a browser prompt: Enter creates, Escape or leaving it empty cancels, and a name with no letter or digit says so in `--danger` under the field.
An empty list reads "No boards yet" or "No docs yet" in `--faint`.
Folded, the rail is a strip of the same icons, with Boards and Docs opening the rail.

### Empty states

Every page that can be empty uses one component, [`src/ui/EmptyState.tsx`](src/ui/EmptyState.tsx): a 40px icon tile, a title in `--fs-lg`, a short description in `--muted` that says what the page is for, and the one step that fills it.
It sits centred in the page, a little above the middle, so the welcome page, the spec, the tasks, and the sessions read the same.
The first run gets a welcome page with three numbered steps and Create your first board, which opens the sidebar's name field.
The Claude panel's own empty state names what Claude can do here and offers two or three starting prompts; a click puts one in the composer rather than sending it.

### Composer and transcript

The composer is a white card with a `--radius-xl` corner, a 2-line field, and a footer with the Enter hint and a round Send button, which is `--accent` when there is something to send.
On focus the card's edge turns `--accent` with an `--accent-tint` halo.
The placeholder is "Ask Claude anything", or "Ask Claude anything about this board" on a board, in `--faint`.
Your messages are `--bubble` grey with ink text, Claude's are plain text, and tool activity is a run of small `--muted` rows set close together, each led by a 14px icon: a dot for a call, a check for a result, and a red cross for a failure.
A turn ends with its cost in `--faint` followed by a hairline, so turns read as sections.

### Ghost styling and the proposals bar

On the canvas a proposal is drawn as ghosts: added and changed elements at 40 percent opacity with a dashed stroke, and removed ones in red.
That is Excalidraw element styling, set in [`src/ui/board/ghosts.ts`](src/ui/board/ghosts.ts), and this design pass leaves it alone.
The proposals bar repeats the ghost's language around it: a paper fill with a dashed `--ghost` border, the summary in `--ai`, and the floating shadow.
Accept is the one primary button, because it is the action that turns a ghost into ink.
Reject and Refine are plain buttons beside it.

### Selection and refine chips

The selection chip is a solid `--selected` grey with ink text, because the selection is yours.
The refine chip is dashed in `--ghost` on `--ghost-tint` with `--ai` text, because it names one of Claude's proposals.
Both sit above the composer, wrap when they run out of room, and truncate a long label with an ellipsis.

### Permission dialog

Claude is waiting on you, so the dialog wears `--warn`: a `--warn-tint` fill inside a faint warn border with a `--radius-lg` corner.
The tool name is bold and the summary follows it on the same line.
It offers Allow once and Deny, plus Allow always when Claude Code suggested a rule to keep, so two or three choices.
They are plain buttons of equal weight, so neither Allow nor Deny is the easy default.
The same component appears in the panel, inset from its edges, and in a run card.

### Status strip

The panel header pairs the title with a dot and a word.
Idle is `--ok`, Working is `--ai` and pulses gently unless reduced motion is set, Needs you is `--warn` in bold, and Error is `--danger`.
Starting and Stopped have a neutral dot.

### Run cards

A run card is a paper card with a `--radius-lg` corner, its title in `--fs-lg`, and a status pill on the right.
The card has `--shadow-sm`. The pill uses the same dot colors as the status strip; Done is `--ok`, Failed is `--danger`, an idle run is `--muted` because it waits on you without being finished, and Interrupted is a hollow ring.
A run that needs you also gets a `--warn` pill border and fill, so it stands out in a grid.
The meta line holds the slug, the branch as a code tag, the running cost, and the PR link.
The sessions page is one column up to 1120px wide; cards fill it in a grid with a 400px minimum, so a lone card takes the whole width and two sit side by side.
The rate-limit note and the other sessions list share the grid's edges.

### Spec view and its citations

The spec is read-only, so it reads as a document, not an editor: the same Markdown renderer as the panel, on paper, centred at a 72-character measure, in `--fs-doc` with a line height of 1.65.
Its top-level heading is `--fs-2xl`, a second-level heading is `--fs-xl`, a third-level one `--fs-lg`, and blocks are 12px apart with 24px above each heading.
A citation such as `[[board:main#login]]` is a small link chip labelled `main#login`: Cascadia Code at `--fs-xs`, `--accent` on `--accent-tint`, a `--radius-sm` corner, and the raw citation as its tooltip.
A chip gains an `--accent` border on hover and opens the board element or doc heading it names.
A citation that no longer resolves is listed in the header in `--warn`.
Split into tasks is the one primary button, in the same header.

### Doc editor

Docs stay editable in CodeMirror, with a highlight style of its own in place of CodeMirror's default.
Text is `--fs-doc` at a 72-character measure with 48px side margins; headings are not underlined, and the first three levels are `--fs-2xl`, `--fs-xl`, and `--fs-lg`.
Markdown marks such as `#` and `**` are `--muted`, links are `--accent`, and code is Cascadia Code.
The gutter sits on `--surface` behind a `--border` rule.

### Tasks view cards

A task card has the same paper, border, and corner as a run card.
The file name sits on top in Cascadia Code at `--fs-xs`, then the title in `--fs-lg`, the dependencies, the acceptance list, and the sources as the same citation chips as the spec.
Launch opens its dialog inline in the card on a `--surface` inset, and the dialog's Launch is the primary button.

### Claude's Markdown

Assistant text is rendered by [`src/ui/markdown.tsx`](src/ui/markdown.tsx) into React elements, so HTML in Claude's text is shown as text.
Paragraphs, headings, emphasis, inline code, fenced code, lists, links, and block quotes are rendered; anything else stays as written.
A single newline is a line break, because Claude often writes a sentence per line.
Headings start at `h3` below the panel's own `h2`, and a top-level heading is `--fs-lg`.
Code blocks scroll sideways rather than wrap.
Inline code has less padding after than before, so punctuation that follows sits close.
An item indented two or more spaces under a list item starts a nested list.
Links are ink with a soft underline that darkens on hover, and open in a new tab with `rel="noreferrer"`, and only `http`, `https`, and `mailto` links become links.
A citation stays text unless the caller passes `renderCitation`, which the spec view uses for its chips.

## Before and after

Each pair was taken at 1280 by 800 with the built app on the fake SDK.

| View                               | Before                                          | After                                         |
| ---------------------------------- | ----------------------------------------------- | --------------------------------------------- |
| The board with a pending proposal  | [before](docs/design/before-board-proposal.png) | [after](docs/design/after-board-proposal.png) |
| The panel mid-answer with Markdown | [before](docs/design/before-panel-markdown.png) | [after](docs/design/after-panel-markdown.png) |
| The spec view                      | [before](docs/design/before-spec.png)           | [after](docs/design/after-spec.png)           |
| The tasks view                     | [before](docs/design/before-tasks.png)          | [after](docs/design/after-tasks.png)          |
| The sessions view                  | [before](docs/design/before-sessions.png)       | [after](docs/design/after-sessions.png)       |
| A doc in the editor                | (none taken)                                    | [after](docs/design/after-doc.png)            |

![The board with a pending proposal, after](docs/design/after-board-proposal.png)
