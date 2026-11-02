# Blueprint build plan and architecture

Status: draft for Vincent's review, written 2026-11-01.
This document turns the tech spec in `docs/tech-spec/tech-spec.md` into a build plan.
It names the technical tenets, the components, the design decisions inside each, and the order to build them in.

Every decision is tagged.
`[spec]` means the tech spec already chose it.
`[my call]` means I chose it here and Vincent can veto it.
`[Vincent]` means only Vincent can decide it, because the answer changes what gets built.
The open `[Vincent]` decisions are collected in section 8.

## 1. What the product has to be good at

The vision has two halves, and every architectural choice below serves one of them.

**Translation.**
A person thinks in boxes, arrows, bullets, and half sentences.
Blueprint has to capture that with as little friction as a whiteboard, then hand an agent something precise enough to build from, without the person rewriting their thoughts as prose for a machine.
The hard part is not the editor.
The hard part is the path from a freeform canvas to a specification the agent trusts, with every claim traceable back to the box or sentence it came from.

**Session state.**
Once agents run, the person needs to see each one as a durable thing: what it is doing, what it has done, what it is waiting for, and what it costs.
They need to talk to it, change its instructions mid-flight, stop it, and come back after closing the laptop to find it where they left it.
That is a state management problem, not a chat problem.

## 2. Technical tenets

1. **Pages are the source of truth. Everything downstream is derived and regenerable.**
   Specs, tasks, and runs are produced from pages.
   Nothing flows backwards into pages without a human accepting it.
2. **Deterministic before probabilistic.**
   Code turns pages into an intermediate representation (IR).
   The model only ever reads the IR.
   Every model output is validated against a Zod schema before it is stored.
   This keeps the model's failure modes small and makes the rest testable with fixtures.
3. **Every AI output is a proposal until a human accepts it.**
   Assist edits, compiled specs, and task splits all pass an accept gate.
   The gate is what makes the authorship metric meaningful and keeps the engineer in the problem-solving loop.
4. **Stable identities everywhere.**
   Every block, shape, spec section, task, run, and event has an ID that survives edits.
   Provenance, diffs, and replay all depend on this.
   Retrofitting IDs later is painful, so they go in on day one.
5. **Own the state, rent the runtime.**
   Our database is the record of every run: its status, its messages, its event log, its pull request.
   The agent loop and the sandbox are rented from a platform.
   Our copy converges to the platform's truth through level-triggered reconciliation (on webhook, on page load, on a timer), not through a long-lived process that must never crash.
6. **Secrets never enter the sandbox.**
   GitHub tokens and API keys stay on our server or in the platform's credential proxy.
   The agent pushes a branch.
   Our server opens the pull request.
7. **One module per external system.**
   Anthropic Messages, Managed Agents, GitHub, and Supabase each sit behind one module with a small surface.
   Swapping a backend, for example adding Codex later, touches one module.

## 3. The biggest decision: how agents run

The tech spec runs agents on our own infrastructure.
A Node runner on Fly.io claims queued runs from Postgres, creates an E2B sandbox per task, drives the Claude Agent SDK inside it, and relays events back. `[spec]`

Since the spec was written I checked the current Anthropic platform docs.
Anthropic now offers **Managed Agents**: a server-managed agent session with a per-session container, an event stream, queued user messages, interrupts, appended system context mid-session, a GitHub repository mount with a git proxy that injects the token outside the sandbox, skills loaded from the repo's `.claude/skills`, a hard per-session dollar budget, webhooks on state transitions, and a Console trace viewer.
It is in beta.

This maps almost one to one onto "good session state management of agents", so I recommend it. `[Vincent]`

| Concern | Self-hosted runner (spec) | Managed Agents (recommended) |
|---|---|---|
| Services we deploy | Web app, runner on Fly.io, E2B sandboxes, a sandbox image with Claude Code | Web app only |
| Session persistence | Agent SDK session files live on the sandbox disk; a SessionStore adapter is needed to survive sandbox death | Server side; an idle session can be messaged days later |
| Messages mid-run | Agent SDK streaming input, relayed by our runner over a custom stdio protocol | `user.message` queues server side while running or idle |
| Plan updates mid-run | A custom message | `system.message` appends privileged context for this and later turns |
| Stop | Kill the sandbox | `user.interrupt`, then archive |
| Crash safety | We build leases, heartbeats, and a reaper | The platform reschedules on transient errors |
| Event log | We write every SDK message to Postgres | A durable event list with IDs, plus an SSE stream for live; we mirror into Postgres |
| GitHub token | Must be inside the sandbox for git push | Never enters the sandbox; the git proxy injects it |
| Cost control | We count tokens | A hard `budget` per session in dollars |
| Agent harness | The full Claude Code harness (CLAUDE.md, hooks, subagents) | The Anthropic toolset (bash, read, write, edit, glob, grep) plus repo skills; CLAUDE.md content must be injected by us |
| Codex adapter later | Possible: same runner, different CLI | Not on this platform; needs a self-hosted backend module |
| Maturity | Each piece is stable; the combination is ours to debug | Beta API that could change during the term |
| Debugging | Our dashboard only | Our dashboard plus the Console trace viewer |

Why this is the right trade for Blueprint:

- The product's value is the translation layer and the plan-to-agent loop, not a sandbox orchestrator.
  Weeks spent on leases and relay protocols are weeks not spent on compile quality.
- Robustness: four of the hardest bugs in the self-hosted design (lost sessions, split-brain runners, dropped events, token leakage into sandboxes) do not exist in the managed design.
- What we lose, the Claude Code harness, is partly recoverable.
  We mount the repo so `.claude/skills` loads, and we put the CLAUDE.md content into the agent's system prompt.
- The spec already defers Codex to after the alpha.
  Tenet 7 keeps the door open: the Managed Agents calls live in one module, and a self-hosted module can be added when Codex matters.

If Vincent prefers the self-hosted design, the rest of this document still holds.
Section 4.5 is the part that changes, and the mitigation for session loss is the Agent SDK's `sessionStore` adapter backed by Supabase Storage.

## 4. Components

Each component lists what it owns, the decisions inside it, and the known ceiling where a simple choice will eventually need an upgrade.

### 4.1 Plan pages: the capture surface

Owns: projects, pages (doc or board), assets, autosave, authorship tagging.

- Doc pages use Tiptap. `[spec]`
  Board pages use tldraw. `[spec]`
- Every Tiptap block node carries a stable `id` attribute through Tiptap's UniqueID extension. `[my call]`
  tldraw shapes already have stable IDs.
  Without block IDs the compiler cannot cite a paragraph.
- Authorship: AI-inserted text carries a Tiptap mark `ai` with the assist ID.
  AI-created shapes carry `meta.origin = "ai"` and `meta.assistId`. `[my call]`
  The IR counts words by mark, which gives the authorship metric for free.
  A human edit inside an AI span splits the mark, which is the behavior we want.
- Persistence: the whole Tiptap JSON and the whole tldraw store snapshot are saved as JSONB, debounced, with an integer `version` for optimistic concurrency and a 409 on a stale write. `[spec]`
  Ceiling: large boards make each save heavy.
  The upgrade is per-record patches from tldraw's store diff.
- Board semantics: plain tldraw shapes (geo, text, note, arrow, frame, image, draw). `[my call]`
  A custom "component" shape with typed fields would compile better but costs drawing freedom.
  Start plain and measure compile quality.
  Add the custom shape only if labels and arrows are not enough.
  The PNG covers the spatial semantics that text loses.

### 4.2 IR compiler: deterministic stage one

Owns: pages to IR, IR to model-readable text, IR to citation index.
Pure functions, no I/O, no model.

This is the component that most decides whether the translation is good, and it is the one we can test exhaustively, so it gets the most tests.

- Doc IR: Tiptap JSON to Markdown with an invisible anchor per block, written as an HTML comment carrying the block ID. `[my call]`
- Board IR: a `BoardGraph` with `nodes` (id, kind, label, bounds, parent frame, origin), `edges` (id, from, to, label, arrowheads), and `loose` items that are neither, such as freehand strokes and images. `[my call]`
  Arrow endpoints come from tldraw's binding records, not from geometry.
- Board text rendering: one Markdown section per board with a Mermaid flowchart of the connected nodes and edges, using shape IDs as Mermaid node IDs, plus a bullet list of unconnected text grouped by frame. `[spec, detailed here]`
  Alongside it, a PNG of the board from tldraw's export. `[spec]`
- Citation index: the set of valid IDs per page. `[my call]`
  After the model returns a spec, every cited ID is checked against this index and unknown IDs are dropped.
- Tests: golden fixtures.
  A saved board JSON and doc JSON go in, an expected Markdown comes out.
  Every compile bug becomes a fixture.

The `BoardGraph` is also the format AI Assist uses to propose diagrams (section 4.6).
IR to shapes and shapes to IR are inverses of each other and are tested as a round trip.

### 4.3 Context Compiler and SpecVersion

Owns: the LLM call that turns IR into a specification, spec versioning, and provenance.

- Model call: `claude-opus-5-5`, structured output against a Zod `Spec` schema, adaptive thinking, effort `high`, streamed so a long compile does not hit HTTP timeouts. `[spec]`
  Effort is set explicitly because this model's default is `medium`.
  Anthropic's server-side refusal fallback is on by default. `[my call]`
- Input: the rendered IR for every page, the board PNGs as image blocks, the repository file tree fetched from GitHub, and the previous spec version if one exists. `[spec, plus the previous version]`
- Output: `sections[]`, each with `id`, `kind` (goals, architecture, interfaces, constraints, acceptance, open questions), `title`, a Markdown `body`, and `sources[]` of page ID plus block or shape IDs. `[spec]`
  Stored as JSONB plus a rendered Markdown column for prompts and export.
- Versions are immutable rows numbered per project. `[spec]`
- Provenance UI: selecting a spec section highlights its source blocks and shapes on the page, and the reverse. `[my call]`
  This is what makes the translation trustworthy, and the citation schema already pays for it.
- Human edits to the spec: see open decision 2.
- Ceiling: one call for the whole project.
  The upgrade is a per-page compile with a merge step, which at a 1M token context window is far away.

### 4.4 Task Splitter

Owns: spec to tasks.

- Model call: `claude-opus-5-5`, structured output against a Zod `TaskGraph` schema. `[spec]`
- Each task has `title`, `body` (the task spec), `dependsOn[]`, `files[]` it will probably touch, and `acceptance[]`. `[spec]`
- The alpha ships without the splitter: one task equals the whole spec. `[my call, follows the alpha scope]`
- Dependency handling: store `dependsOn`.
  The launch endpoint refuses a task whose dependencies have no merged pull request, and the UI greys it out.
  No scheduler. `[my call]`
  Ceiling: automatic launch of dependents when a pull request merges, through a GitHub webhook.

### 4.5 Agent runs: session state management

Owns: launching, observing, messaging, updating, and stopping agent sessions, and the durable record of each run.
This section assumes Managed Agents (section 3).

**Setup, once.**
One Managed Agent definition: model `claude-opus-5-5` at effort `high`, the Anthropic toolset with the web tools off and the `auto` permission policy, and a system prompt that explains Blueprint's conventions.
The repo's CLAUDE.md is not in the definition, because it differs per project; each session overrides the system prompt to append it (see Launch below).
One environment with limited networking and package managers allowed.
Both are defined as files and synced with the `ant` CLI.
Their IDs are configuration.

**Launch.**
Insert a `runs` row, then create a session with the repo mounted through the user's GitHub token, a per-session system prompt override that appends the repo's CLAUDE.md, `metadata` of run and project IDs, a per-run dollar `budget` (default $10, editable at launch), and `initial_events` carrying one user message. `[my call on the default budget]`
That message holds the task spec, the full project spec, the branch name `blueprint/<task-slug>`, and the definition of done: push the branch and summarize.
Store the session ID on the run.

**Observe.**
Two channels feed the same `run_events` table, keyed by the platform's event ID.

- Live: a route handler proxies the session's SSE stream to the open dashboard tab and upserts each event as it passes through.
- Durable: a `syncRun(runId)` function lists the session's events and upserts them, then updates the run's status, cost, and last activity from the session object.
  It is called by the Anthropic webhook handler on every session state transition, by the dashboard when a run page loads, and by a cron every few minutes for runs that are not stopped.
  Any one of the three alone keeps the database correct.
  Together they make it prompt.

**Message.**
`POST /api/runs/:id/messages` writes a `run_messages` row and sends a `user.message`.
The platform queues it if the agent is busy.

**Plan update.**
`POST /api/specs/:id/push-update` diffs the newest spec version against the version each active run last saw, section by section, and renders the diff as text.
It sends a `system.message` with the diff followed by a `user.message` asking the agent to reconcile, then updates the run's `notifiedSpecVersionId`. `[spec, mechanism chosen here]`

**Permission asks.**
With the `auto` policy some tool calls pause for approval.
The dashboard shows the ask with allow and deny buttons.
Nothing is auto-approved. `[my call]`

**Pull request.**
When `syncRun` sees the session idle with `end_turn` and the run has no pull request, it checks GitHub for the branch and opens the pull request from our server with the user's token.
The body comes from the task spec and the agent's last message. `[my call]`
The agent never needs GitHub API access.

**Stop.**
`user.interrupt`, then archive the session.
Status becomes `stopped`.
The branch stays.

**Run status** is a small enum mirrored from the session: `running`, `idle`, `needs_attention` (idle with a pending ask), `stopped`, `failed`.
`pr_url` and `cost_cents` are separate columns.

**Testing and local development.**
The Managed Agents module has an in-memory fake that replays a recorded session's events, used by Vitest, Playwright, and `pnpm dev` without an API key. `[my call]`
Real sessions are for manual verification and the demo, which keeps development spend to a handful of runs per milestone.

Ceilings: one upstream SSE connection per open tab, which is fine for one user and fans out through Supabase Realtime if several people watch one run.
Plan updates go to every active run regardless of relevance; filtering by the task's cited sections comes later.
Live text previews are off initially; buffered messages arrive after every tool call, which is frequent enough.

### 4.6 AI Assist

Owns: selection-scoped help on a doc or board, delivered as proposals.

- Text: the model returns a replacement for the selected text, the client shows an inline diff, and accept applies it with the `ai` mark. `[spec]`
- Board: the model returns a `BoardGraph` fragment, the same type as the IR, never raw tldraw JSON. `[my call]`
  The client lays it out and creates semi-transparent shapes with `meta.origin = "ai"`.
  Accept makes them opaque; discard deletes them.
  Asking the model for tldraw shape JSON is brittle; the graph is small, typed, and already tested by the compiler.
- Advise: text only, shown in a side panel, never inserted. `[spec]`
- Model: `claude-opus-5-5`, effort `low` for wording edits, streamed. `[spec]`
- Every proposal is a row in `assists` with its status, which gives the authorship numbers and a debugging trail.

### 4.7 Auth and GitHub

- Supabase Auth with the GitHub provider and the `repo` scope. `[spec]`
  The provider token is only available on the OAuth callback, so the callback handler stores it encrypted in a `github_tokens` table that only the service role can read. `[my call]`
- Repository metadata, file trees, and pull request creation go through the GitHub REST API from our server.
- Ceiling: OAuth app tokens are broad.
  The upgrade is a GitHub App with short-lived installation tokens.

### 4.8 Shared core

Zod schemas (`Spec`, `TaskGraph`, `BoardGraph`, `Proposal`, run events), the IR compiler, and the Drizzle schema.
With no separate runner service there is no second deployable, so this is a folder inside the single Next.js app, not a workspace package. `[my call, changes the spec's monorepo]`
Promote it to a monorepo when a second deployable appears.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `projects` | id, owner_id, name, repo_full_name, default_branch | RLS by owner |
| `pages` | id, project_id, kind (doc, board), title, content jsonb, version, updated_at | whole-document saves |
| `assets` | id, project_id, storage_path, mime | Supabase Storage |
| `assists` | id, page_id, selection jsonb, instruction, action, proposal jsonb, status | proposed, accepted, discarded |
| `spec_versions` | id, project_id, number, origin (compile, human_edit), ir jsonb, sections jsonb, markdown, created_at | immutable |
| `tasks` | id, spec_version_id, title, body, depends_on uuid[], files text[], acceptance jsonb, status | |
| `runs` | id, task_id, spec_version_id, notified_spec_version_id, session_id, status, branch, pr_url, cost_cents, started_at, ended_at | |
| `run_events` | event_id (pk), run_id, type, payload jsonb, occurred_at | mirrored from the platform |
| `run_messages` | id, run_id, kind (user, plan_update), body, event_id, created_at | what we sent |
| `github_tokens` | user_id (pk), token (encrypted), scopes | service role only |

## 6. Build order

Each milestone ends with something a user can click through.
The first one is deliberately thin and end to end, because the riskiest integrations (Managed Agents and GitHub) should fail in week one, not week eight.

| # | Milestone | Done when |
|---|---|---|
| 0 | Walking skeleton | Sign in with GitHub, create a project on a repo, write one doc page, press Compile, see a spec, press Launch, watch events stream, get a pull request link. No board, no assist, no split. |
| 1 | Board and IR | Draw boxes and arrows on a board page; compile cites shapes; clicking a spec section highlights them. Golden tests for the IR. |
| 2 | Session management | Message a running agent, answer a permission ask, stop a run, close the tab and come back to the same state, see cost per run. Webhook, page-load, and cron sync all in place. |
| 3 | Assist | Refine and advise on a text selection with an inline diff; draw a diagram from a selected region as ghost shapes; authorship ratio shown per project. |
| 4 | Tasks and parallel runs | Split a spec into tasks, launch several, see them side by side, dependencies gate launch. |
| 5 | Plan updates | Edit pages during a run, recompile, push the section diff into active sessions, see the agent acknowledge it. |
| 6 | Hardening and evidence | Playwright for the three flows, metrics capture for the four success metrics, prompt log in `docs/prompts/`, CLAUDE.md exported from Blueprint itself. |

Milestones 0 to 2 are the alpha in the spec's terms.
Each milestone gets its own implementation plan when it starts.

Sequencing by team size: solo, build the milestones strictly in order, milestone 0 end to end first. `[my call]`
With two people, the Zod schemas are the contract and are built first; inside each milestone the editor and IR track can then run in parallel with the runs track.
No mockups exist in the repo, so milestone 0 starts with a short design pass that produces a `DESIGN.md` for the three-pane layout, and every later screen is built to it. `[my call]`

## 7. Constraints and things to verify at build time

- Managed Agents is beta.
  Pin the SDK version and keep its calls in one module.
- Whether a `system.message` alone wakes an idle session or needs a `user.message` with it.
  The plan assumes the pair.
- Whether GitHub REST calls from inside the sandbox are proxied.
  The plan does not rely on it.
- tldraw requires a license key to remove its watermark in production.
  Fine for a course project.
- The licensing of Tiptap's UniqueID extension in the version we pick.
- Vercel function duration for the compile call and the SSE proxy.
  Both stream; the browser reconnects to the proxy and the database dedupes.

## 8. Decisions for Vincent

Most important first.
A fresh reviewer read this document cold and these are the questions that survived; everything else they raised is settled above and tagged `[my call]`.

1. **Managed Agents instead of the Fly.io runner with E2B and the Agent SDK, and how firm the Codex promise is.**
   See section 3.
   This changes milestones 0 and 2 and removes two services.
   The hinge is Codex: the proposal and the tech spec both promise a Codex adapter after the alpha, and Codex cannot run on Managed Agents.
   If Codex is a committed final deliverable, the self-hosted backend has to be built anyway, Managed Agents becomes a second backend instead of a replacement, and the case for it weakens.
   If Codex is a stretch goal, the recommendation stands.
2. **Dates.**
   Neither document has them.
   When is the alpha due, when is the final, and which milestones must be done by each?
   The plan assumes milestones 0 to 2 are the alpha.
   If the alpha is close, milestone 2 shrinks to launch and watch, and messaging, permission asks, and cron sync move to the final.
3. **Who signs in on the deployed alpha: only you, or classmates and graders too, on whose Anthropic key and GitHub token?**
   The row-level security and the "new user launches in under 30 minutes" metric imply other people sign in.
   If they do, the plan needs a sign-in allowlist and per-user spend caps on your shared Anthropic key.
   If it is only you, neither is built.
   Per-repo CLAUDE.md is handled either way by the per-session system prompt override.
4. **Is the compiled spec editable?**
   The tech spec and the dataflow diagram say the user reviews and edits it, and the data model already has a `human_edit` origin.
   If it is a second editing surface, human edits must survive recompiles, so the compiler receives the previous version with edited sections flagged and is told to preserve them unless the pages contradict them.
   If instead the spec is read-mostly and edits belong on pages, that logic is not needed and the UI gets a "send to page" action instead.
   I lean read-mostly for the alpha, because it keeps tenet 1 clean.
5. **Is Assist in the alpha?**
   The proposal's MVP and the spec's phase 1 include it.
   The alpha scope you set in October does not.
   The build order above puts it after session management, which also means the authorship metric cannot be measured until then.
