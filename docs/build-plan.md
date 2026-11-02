# Blueprint MVP design

Status: draft for Vincent's review, written 2026-11-01.
This document supersedes the earlier build plan, which assumed a hosted app and Anthropic Managed Agents; that version is archived at `docs/archive/2026-11-01-build-plan-managed-agents.md`.
It is written so a builder can plan the MVP from it without coming back to Vincent.

Every decision is tagged.
`[Vincent]` was decided by Vincent in conversation.
`[my call]` was chosen here and Vincent can veto it.
`[builder]` is left to whoever builds it.
Open decisions are collected in section 11.

## 1. Intent

Blueprint is an open-source, local-first planning workspace for people who build with Claude Code. `[Vincent]`
You run it inside a repository on your own machine and it opens in the browser.
You think on a whiteboard and in Markdown docs, paste in screenshots and snippets as context, and ask Claude for descriptions and diagrams from a panel inside the whiteboard.
Claude's edits to the board arrive as ghost proposals that you accept, reject, or refine.
When the plan is ready, Blueprint compiles it into a specification and tasks, launches one Claude Code session per task in its own worktree, and shows those sessions in a sessions view where you can watch, message, and stop them.

Every model call runs inside Claude Code on the user's own login. `[Vincent]`
Blueprint holds no credentials, calls no API, and uses no external credits.
Vincent accepted that Anthropic's Agent SDK documentation reserves claude.ai login for first-party products, on the basis that this is a personal tool.

The why comes from the tech spec in `docs/tech-spec/tech-spec.md`.
Coding agents make engineers faster but remove them from the problem-solving step, and plan modes produce text written for agents that engineers skim.
A whiteboard keeps the engineer in that step.
A compiler with citations turns the whiteboard into something an agent can build from.
A sessions view keeps the agents visible instead of buried in terminals.

## 2. Goals, non-goals, and anti-goals

Goals for the MVP:

- Plan on a whiteboard and in docs, with pasted-in context, stored as plain files in the repository.
- Ask Claude from inside the whiteboard; descriptions and diagrams land on the board as editable shapes through ghost proposals. `[Vincent]`
- Compile the plan into a spec and tasks that cite the shapes and headings they came from.
- Launch, watch, message, and stop one Claude Code session per task from the sessions view, as a web UI and not a terminal. `[Vincent]`
- Fit the user's existing Claude Code: every session is an ordinary Claude Code session, and the repository's CLAUDE.md, skills, hooks, and MCP servers apply as they would in a terminal.

Non-goals for the MVP: multiple users, hosting, accounts, cloud sessions, pushing plan changes into running sessions, the authorship metric, rich-text document editing, custom shape types, and Codex.

Anti-goals, which would make the MVP a failure even if it worked:

- Anything that requires an API key or sends plan data to a service Blueprint runs. `[Vincent]`
- A UI that looks or behaves like a terminal. `[Vincent]`
- AI edits applied to the board without an accept step. `[Vincent]`

## 3. Constraints

- Platforms: macOS and Linux first, wherever Claude Code runs. Windows is untested in the MVP.
- Runtime: Node 22 or later, the active LTS line; Node 20 reached end of life in April 2026 and the current toolchain (Vitest, jsdom, chokidar) requires 22. The Agent SDK bundles its own Claude Code binary, which is the default; a setting points Blueprint at the user's installed one instead. `[my call]`
- Licenses: Excalidraw and its Mermaid importer are MIT. The Agent SDK is under Anthropic's commercial terms. The product must not be branded as Claude Code; "Claude Agent" or "powered by Claude" are allowed.
- One Blueprint process serves one repository, started from that repository's root.
- Plan data must be plain files in the repository so git, teammates, and other tools can read them.
- Login risk: the SDK reads the user's Claude Code login today. If a future SDK release stops doing that, drive the user's installed binary through the same streaming JSON protocol the SDK uses. This is a day-one verification, not a design change.

## 4. Architecture

Blueprint is one npm package with three parts.

```
Browser at localhost:4242                 Local server (Node)                           Claude Code
+---------------------------+  WebSocket  +-----------------------------------+  SDK   +------------------+
| Board (Excalidraw)        |<----------->| FileStore   .blueprint/ on disk   |<------>| plan session     |
| Docs (CodeMirror)         |             | Export      board.md, board.png   |        | run session x N  |
| Claude panel              |             | Sessions    query, resume, stop   |        | one per worktree |
| Sessions view             |             | BoardTools  in-process MCP server |        +------------------+
| Proposals toolbar         |             | Proposals   ghost store + log     |
+---------------------------+             +-----------------------------------+
```

- The browser UI is React with Vite.
  It holds the board, the docs editor, the Claude panel, the sessions view, and the proposals toolbar.
- The local server is Node with Hono and a WebSocket.
  It owns the files under `.blueprint/`, the deterministic export, the sessions, the board tools, and the proposal store.
- Claude Code runs as subprocesses the server starts through the Agent SDK, one per session, with the repository or a worktree as the working directory.

The main loop, from a question to a shape on the board:

1. The user selects shapes, types in the Claude panel, and submits.
2. The browser sends the text and the selected element IDs to the server.
3. The server prefixes the text with a selection header listing each selected element's ID, kind, and label, and pushes the message into the plan session's streaming input.
4. Claude calls `get_selection` or `get_board` for context, then `propose` with a list of operations: add a diagram from Mermaid, add a note, update an existing element, or delete one.
5. The server stores the proposal and forwards it to the browser, which renders Mermaid into Excalidraw elements, applies the operations as ghosts, and acknowledges. The tool call returns to Claude only after that acknowledgement, so a Mermaid parse failure or an unknown element ID reaches Claude as a tool error and it can retry.
6. The user accepts, rejects, or refines. Refine sends a new panel message that references the proposal, Claude calls `revise`, and the ghosts are replaced in place.
7. On accept, added elements become normal and updated ones keep their new values, all tagged as AI-made, and the proposal is logged. On reject, added elements are deleted and updated or deleted ones return to their snapshot.

## 5. Storage

Everything lives under `.blueprint/` in the repository. `[Vincent]`

```
.blueprint/
  boards/<name>.excalidraw.json   board scenes, committed
  assets/<sha256>.<ext>           pasted images and files, committed
  docs/<name>.md                  Markdown docs, committed
  spec.md                         compiled specification, committed
  tasks/<nn>-<slug>.md            one task per file with frontmatter, committed
  sessions.json                   Blueprint's index of its sessions, committed
  proposals.jsonl                 every proposal and its outcome, committed
  export/                         regenerated board Markdown and PNG, ignored
  worktrees/<slug>/               one worktree per run, ignored
```

- Board files are Excalidraw's scene JSON without its embedded `files` map; images are extracted to `assets/` and referenced by hash, so board files stay small and diffs stay readable. `[my call]`
- Git provides spec versions and diffs; Blueprint keeps no version table.
- `blueprint init` creates the directory and appends the ignored paths to `.gitignore`.
- Element IDs in board files are the stable identities everything cites; nothing regenerates them.

The session index has this shape:

```json
{
  "plan": { "sessionId": "uuid", "updatedAt": "iso" },
  "runs": [
    {
      "id": "run_01", "taskSlug": "03-auth", "sessionId": "uuid",
      "worktree": ".blueprint/worktrees/03-auth", "branch": "blueprint/03-auth",
      "status": "working", "prUrl": null, "costUsd": 0.42,
      "startedAt": "iso", "endedAt": null
    }
  ]
}
```

Run status is one of `working`, `needs_you`, `idle`, `done`, `failed`, and `interrupted`.

## 6. Components

### 6.1 Board

- Excalidraw, embedded as a React component. `[Vincent]`
  It supplies shapes, colors, arrows with bindings, frames, free drawing, text, image paste, undo, zoom, and PNG export.
- Element kinds Blueprint interprets: rectangle, ellipse, and diamond with bound text as nodes; arrows with start and end bindings as edges; frames as groups; text as labels or loose notes; images and freehand strokes as loose context.
- Every element Blueprint creates carries `customData` with `origin: "ai"` and the proposal ID. Elements the user draws carry nothing, which is how human and AI work are told apart later.
- Selection changes are sent to the server and shown as chips above the panel input.
- Autosave writes the scene 500 milliseconds after the last change. `[my call]`
  A PNG export of the whole board is written 2 seconds after the last change, which is cheap at MVP board sizes. `[my call]`
  Ceiling: large boards make both heavy; the upgrade is per-element patches and export on demand.
- Ghost styling for proposals: opacity 40, dashed stroke, a shared group ID per proposal so the elements move together, and not locked so the user can nudge them before accepting. `[my call]`
- Claude must never edit board files directly; proposals are the only path. A `PreToolUse` hook denies file writes under `.blueprint/boards/`. `[my call]`

### 6.2 Docs

- Markdown files edited with CodeMirror 6 in Markdown mode. `[Vincent]`
- Claude may edit doc files directly with its own file tools; the server watches the directory and the editor reloads.
  If the editor has unsaved local changes when a file changes on disk, a banner offers keep mine or take theirs. `[my call]`
- Headings get slugs the citation grammar can reference.

### 6.3 Export

Pure functions with no I/O and no model, in their own module with golden tests.
This is the quality lever for the whole product, so it gets the most tests.

- Board to `BoardGraph`:

```ts
const Node = z.object({
  id: z.string(), kind: z.enum(["box", "ellipse", "diamond", "text", "image", "frame"]),
  label: z.string(), frameId: z.string().nullable(), asset: z.string().optional(),
  bounds: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
  origin: z.enum(["human", "ai"]),
});
const Edge = z.object({
  id: z.string(), from: z.string().nullable(), to: z.string().nullable(),
  label: z.string(), arrowheads: z.object({ start: z.boolean(), end: z.boolean() }),
});
const BoardGraph = z.object({
  board: z.string(), nodes: z.array(Node), edges: z.array(Edge),
  loose: z.array(z.object({ id: z.string(), kind: z.enum(["draw", "line"]) })),
});
```

- `BoardGraph` to Markdown: a heading per board, a Mermaid flowchart of connected nodes and edges, bullet lists of unconnected text grouped by frame, and a list of images with their asset paths.
  Mermaid node IDs are derived from element IDs through a sanitizing map, and the map is emitted as an HTML comment so citations can be resolved back. `[builder]`
- Doc to Markdown: the file as is.
- Citation grammar, used by the spec and resolved by the UI for highlighting: `[[board:<name>#<elementId>]]` and `[[doc:<file>#<heading-slug>]]`.
- Citation index: the set of valid IDs per page; unknown citations in a compiled spec are dropped with a warning.
- Golden tests: fixture scenes and docs in, expected Markdown out; every compile bug becomes a fixture.

### 6.4 Claude panel and the plan session

One plan session per repository, resumed across restarts by the ID in the session index.

- SDK options: `cwd` is the repository root; `permissionMode` is `default`; `canUseTool` routes prompts to the UI; `systemPrompt` is the Claude Code preset with an appended Blueprint section; `mcpServers` holds the in-process board tools; `hooks` report tool activity and turn ends; `includePartialMessages` is on so text streams; input is the streaming form so the panel can send follow-ups, and `interrupt` is the stop button.
- The appended system prompt covers: where the plan files are, that the board is read through the tools and never edited directly, that diagrams must be flowchart, sequence, class, ER, or state Mermaid because those import as editable shapes, that a selection header means "this" refers to those elements, and that long descriptions go to a doc with a short note on the board.
- The panel renders user messages, streaming assistant text, tool calls as compact rows such as "reading the selection" and "proposing a diagram", permission dialogs, and a result line with cost.
  Calls to the structured output tool and to the board tools are shown as status, not as raw JSON.
- Permission dialogs show the tool, a summary of its input, and three choices: allow once, allow always, which adds a permission rule through the callback's update field, and deny with a message.
- Because the repository's CLAUDE.md, skills, hooks, and MCP servers load through the preset, the plan session behaves like the user's own Claude Code in that repository.

### 6.5 Board tools

An in-process SDK MCP server named `blueprint` with four tools, each with a Zod schema.

| Tool | Input | Returns |
|---|---|---|
| `get_board` | optional board name | the board's Markdown export and its PNG as an image block |
| `get_selection` | none | the `BoardGraph` fragment for the selected elements, their bounding box, and a PNG crop of them |
| `propose` | `{ title?, ops: Op[] }` | `{ proposalId }`, or a tool error naming the bad Mermaid or the unknown element ID |
| `revise` | `{ proposalId, ops: Op[] }` | the same |

Proposals are lists of operations, because the selection exists to modify things and not only to add beside them. `[Vincent, detailed here]`

```ts
const Op = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add_diagram"), mermaid: z.string(), near: z.array(z.string()).optional() }),
  z.object({ op: z.literal("add_note"), text: z.string(), near: z.array(z.string()).optional() }),
  z.object({ op: z.literal("update"), id: z.string(), label: z.string().optional(),
             strokeColor: z.string().optional(), backgroundColor: z.string().optional() }),
  z.object({ op: z.literal("delete"), id: z.string() }),
]);
const Propose = z.object({ title: z.string().optional(), ops: z.array(Op).min(1) });
```

How each operation looks while it is a ghost, and what accept and reject do:

| Operation | As a ghost | Accept | Reject |
|---|---|---|---|
| add_diagram, add_note | new elements at opacity 40 with dashed strokes, grouped per proposal | normal style, tagged AI-made | deleted |
| update | the element shows its new values with a dashed stroke and a pending badge, and its old values are snapshotted in the proposal | new values kept, tagged AI-made | snapshot restored |
| delete | the element at opacity 40 with a red dashed stroke | deleted | restored |

"Add a cache between these two" therefore arrives as a delete of the old arrow plus a diagram with the new node and its arrows, and the user sees exactly what would change before it does.

- PNG rendering needs a browser canvas, so `get_board`, `get_selection`, `propose`, and `revise` each make a round trip to the open browser tab over the WebSocket, with a timeout. If no tab is open, the read tools return text only and the write tools fail with a clear message.
- Placement: beside the selection's bounding box with an 80 pixel gap, or to the right of all content when nothing is selected. `[my call]`

### 6.6 Compile and tasks

- A Compile action in the panel sends a fixed instruction to the plan session: read the exports, write `spec.md` with the sections goals, architecture, interfaces, constraints, acceptance criteria, and open questions, and cite sources with the citation grammar. The user can argue with the result in the same conversation.
- Splitting runs as a separate one-shot query with structured output: the SDK validates the model's answer against a `TaskGraph` schema and retries on mismatch, and the server writes one task file per task.

```ts
const Task = z.object({
  slug: z.string(), title: z.string(), body: z.string(),
  dependsOn: z.array(z.string()), files: z.array(z.string()), acceptance: z.array(z.string()),
  sources: z.array(z.string()),
});
const TaskGraph = z.object({ tasks: z.array(Task) });
```

- The spec is read-mostly in the MVP: edits belong on the board and in docs, and recompiling overwrites `spec.md`, with git keeping history. `[my call]`
- Clicking a citation in the spec view highlights the cited elements or scrolls to the heading.

### 6.7 Runs and the sessions view

- Launch creates a worktree under `.blueprint/worktrees/<slug>` on a branch `blueprint/<slug>` from the current HEAD, then starts a run session with that worktree as `cwd`. `[my call]`
- Dependencies gate launch: a task launches only when every task it depends on has a run with status `done` whose branch is an ancestor of the current HEAD, checked locally with git, which means the user has merged and pulled. The launch dialog explains what is missing and offers an override that launches from HEAD anyway. No scheduler and no GitHub polling. `[my call]`
- Run sessions do not get the board tools; the task file and the spec are their context. `[my call]`
- The run prompt holds the task file, the spec, the branch name, and the definition of done: commit, push, open a pull request with the user's `gh` if it is installed, print the PR URL on its own line, and summarize. The server picks the URL out of the final message.
- Run permission mode defaults to `acceptEdits`, and everything that still prompts goes to a dialog in the sessions view. The launch dialog lets the user pick `default` or `bypassPermissions` instead. `[my call]`
- Each run streams into its own card: status, last message, tool activity, cost, branch, PR link, a message box, a stop button, and an open-in-terminal action that copies the resume command for that session ID.
- Status comes from the SDK stream and hooks: `working` while a turn runs, `needs_you` when a permission dialog is pending, `idle` after a turn ends, `done` when the result arrives with a PR or summary, `failed` on an error result, and `interrupted` when Blueprint restarts while a run was active. Interrupted runs offer a resume button that continues the same session ID.
- The sessions view also lists every other Claude Code session in the repository through the SDK's session listing, with a read-only transcript, so sessions started from a terminal are visible too.
- Several runs may be active at once; each is its own subprocess. The subscription's rate limits are shared across them, which the view says plainly.

### 6.8 Server

- Hono for HTTP and a WebSocket for everything live: board changes, selection, panel messages, session streams, proposals, permission requests, and file-change notices.
- A file watcher on `.blueprint/` so changes by Claude or by the user's editor reach the browser.
- One process, started by the `blueprint` command, which also opens the browser.

### 6.9 Packaging

- An npm package with a `blueprint` binary and two commands: `blueprint`, which initializes if needed, serves, and opens the browser, and `blueprint init`.
- The UI is built with Vite and shipped inside the package.
- A Claude Code plugin that exposes the same board tools to the user's own terminal sessions is a later addition, not part of the MVP.

## 7. UI

Three panes: a left rail with boards, docs, and sessions; the center with a board or a doc; the right with the Claude panel.
The sessions view takes the full width when selected.
A short design pass produces `DESIGN.md` before the first screen is built, because no mockups exist. `[my call]`
Visual elements that need care: the ghost styling and the floating Accept, Reject, and Refine toolbar; the selection chips; the permission dialog; the status strip; and the run cards.

## 8. Build order

Each milestone ends with something Vincent can click through.

| # | Milestone | Done when |
|---|---|---|
| 0 | Skeleton | `blueprint` serves the UI, boards and docs save and reload from `.blueprint/`, and the export has golden tests. No Claude yet. |
| 1 | Panel | The plan session runs through the SDK, text streams into the panel, permission dialogs work, the two read tools answer, and stop interrupts. "Describe what I selected" comes back as text. |
| 2 | Proposals | `propose` and `revise` work end to end, additions first and then updates and deletes: Mermaid becomes ghost shapes beside the selection, in-place changes show as ghost diffs, and accept, reject, and refine behave as specified. |
| 3 | Compile | `spec.md` and task files are produced, citations resolve, and clicking one highlights its source. |
| 4 | Runs | Launch per task in worktrees, the sessions view streams them, message and stop work, the PR link appears, and interrupted runs resume. |
| 5 | Evidence | Playwright covers plan to ask to accept, compile, and launch; the README explains setup and the login caveat; the demo is recorded. |

Milestone 1 includes the day-one check that the SDK session uses the user's login.

## 9. Testing

- Export: golden fixtures, run in CI.
- Server and UI: an in-process fake of the SDK that replays recorded message streams, selected by an environment variable, so tests and local UI work need no Claude.
- Playwright: the three flows above, against the fake.
- Real sessions: manual verification at each milestone, since every real turn spends the user's plan allowance.

## 10. Risks and things to verify at build time

- The SDK reading the user's login, verified in milestone 1 with a trivial query.
- The Mermaid importer needs DOM APIs, so it runs in the browser; the tool round trip is the consequence.
- Mermaid rejects some characters in node IDs, hence the sanitizing map.
- The permission callback's update field persisting allow-always rules beyond the session.
- Claude Code's own worktree isolation treating Blueprint's worktree as the project, since `cwd` points at it.
- Large pasted images and PNG export time on big boards.
- Windows paths and process spawning.

## 11. Decisions for Vincent

A fresh reviewer read this document cold.
Two of their questions only Vincent can answer; the rest were settled above and tagged `[my call]`.

1. **Dates.**
   When is the MVP due, and which milestones are non-negotiable for the course?
   Six milestones have no dates.
   If time runs short, the candidates to cut are the listing of other sessions, resume of interrupted runs, allow-always persistence, and the Playwright suite, and the README and demo move forward.
2. **Who runs it during the MVP window.**
   The login caveat was accepted on the basis of personal use, and the plan assumes only Vincent runs it.
   If classmates or graders will install it on their own machines, the plan needs install testing from scratch on Linux and macOS, a demo mode on the fake SDK for people without a subscription, and a README caveat written for them.

Calls made after the review, for Vincent to check while reading: proposals as operation lists with in-place ghost diffs (6.5), dependency gating by a local merge check with an override (6.7), no board tools in run sessions (6.7), the bundled binary as the default (3), and the spec as read-mostly (6.6).

## Appendix: paths considered and set aside

- A hosted app with a Fly.io runner, E2B sandboxes, and the Agent SDK, as in the tech spec: needs an API key and three services to run.
- Anthropic Managed Agents: the strongest hosted option, but it needs an API key, and the product is now local.
- A Claude Code plugin with the user's terminal as the only interface: fits existing workflows but puts asking outside the whiteboard.
- An embedded terminal panel inside the web app: no policy risk, but it feels like a terminal, which Vincent rejected.
- Injecting panel text into a user-run session through its inbox socket, a plugin monitor, or a channel: the same subscription use through a less documented or preview-gated door, with a terminal the user still has to keep open.
