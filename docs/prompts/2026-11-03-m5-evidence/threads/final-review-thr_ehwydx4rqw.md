I have everything I need. Here is the review.

## Review of milestone 5 (083b649..a10d0f6)

### Strengths

- **The fake SDK is well contained.** `src/server/index.ts:34` imports it only when the variable is set, the path is logged, and the kind of session is inferred from the real options (output format for the split, the blueprint server for the plan, nothing for a run). The route-level test proves the plan, split, runs, and sessions routes all use the fake.
- **The write step is sandboxed correctly.** `src/server/fake/sdk.ts:165` resolves against the session cwd and rejects `..`, absolute paths, and the cwd itself before touching disk. The run session's cwd is the worktree, so a scenario can only write into the worktree.
- **The Markdown renderer is a sound security boundary.** Every string becomes a text node, only http, https, and mailto links become anchors, links carry `target="_blank"` and `rel="noreferrer"`, and the tests pin script, img onerror, and javascript: cases. I timed the inline regex on adversarial inputs (4000 asterisks, 3000 unclosed links, 3000 unclosed underscores). Worst case was 10 ms.
- **The safety fix is right and better than the plan.** The plan asked for an "Allow for this session" label. The branch found that the broker's `updatedPermissions: []` kept nothing, and so the label would have lied. Offering only Allow once and Deny when there is no rule to keep is the honest behaviour, and `src/server/agent/broker.ts:71` makes a stale "always" from another tab fall to a single allow rather than a fake rule.
- **An ask shows the command verbatim.** `summarizeTool(..., full=true)` bypasses both the 60-character cut and path relativization for Bash, so the user approves exactly what Claude would run.
- **Playwright flows assert on real state.** No fixed sleeps. The accept flow reads the board file and checks the labels came out as `["Login", "Home"]` on one line each, which would catch the wrap regression this branch fixed. The launch flow checks the worktree's branch with git.
- **The restyle is token-complete and accessible.** All raw hex values sit in `:root`, every interactive element has a `focus-visible` ring, the muted, ai, warn, ok, and danger inks all clear 4.5:1 on their surfaces, and the working pulse respects reduced motion.
- **Small correctness fixes land cleanly.** A failed run's `endedAt` no longer moves on a re-derived failure message, the compile skips an unreadable doc the way it skips a broken board, and the restored run transcript shows `Start task <slug>` instead of the full prompt.

### Issues

#### Critical (Must Fix)

None.

#### Important (Should Fix)

1. **The demo videos and README screenshot predate six user-visible fixes.** `docs/demo/*.webm` and `docs/design/after-*.png` were last written at 4582cf2. After that, 5cbc8a9 and a10d0f6 changed what an ask shows, 91ca1ca changed task and run cards to render inline Markdown, 901f9e1 changed where a cited shape lands, and 59549c4 changed the proposed node size. Milestone 5's "done when" row is "the demo is recorded" and the review asks whether the videos show the product as it is. They do not. Fix: run `pnpm demo` once more and re-shoot the after screenshots that the board and task changes affect (`README.md:7`, DESIGN.md's table).

2. **`pnpm e2e` and `pnpm demo` fail on a fresh clone because the README never installs a browser.** `README.md:142` lists both commands, but nothing in `package.json` or the README runs `pnpm exec playwright install chromium`. Playwright 1.64 on a machine without its Chromium exits with "Executable doesn't exist". This is Review Focus 5 (setup from a fresh clone) and the first thing a grader hits after `pnpm check`. Fix: one line in the Development section, or a `postinstall` guarded by an environment check.

3. **At 1280 by 800 the whiteboard runs in Excalidraw's phone layout.** `src/ui/styles.css:80` and `:81` give the rail 240 px and the panel 360 px, leaving the board 680 px, and Excalidraw switches to its compact layout below 730 px (`MQ_MAX_WIDTH_PORTRAIT`). Commit 901f9e1 confirms this and adapted the focus inset to it rather than questioning it. The widths are pre-existing, but this is the last MVP review, Review Focus 4 names 1280 by 800 as a size that must not regress, and the demo videos are recorded at that size, so a viewer sees the phone toolbar. Fix: a media query that narrows the rail and panel below about 1360 px (for example 200 px and 320 px, which gives the board 760 px), or a collapsible rail. Design-level finding; the design doc should name the minimum window the layout is built for.

#### Minor (Nice to Have)

4. **DESIGN.md still says the permission dialog has three choices.** `DESIGN.md:92`. After e024279 it has two or three depending on whether the SDK suggested a rule. One sentence to update.

5. **The compile flow's wait on the Split button can pass before the split starts.** `e2e/flows.spec.ts:163` asserts the "Split into tasks" button is enabled right after clicking it. If the check runs before the UI flips to "Splitting…" it passes vacuously. The later `toHaveCount(2)` still polls, so it cannot flake, but the intermediate assertion gives no evidence. Wait for the "Splitting…" button first, then for "Split into tasks" to return.

6. **The fake reaches into the MCP server's private registry without a guard.** `src/server/fake/sdk.ts:49`: if a future SDK renames `_registeredTools`, `toolsOf(...)[name]` throws a TypeError inside the generator and the whole fake session dies rather than reporting a tool error. The deferred `?? {}` is the right one-liner.

7. **The spec's second-level headings render as h4.** `src/ui/markdown.tsx:123` shifts every heading down two levels because the panel's title is an h2. The spec view has no h2 above it, so its `##` sections become h4 and the document outline skips h2 and h3. Visually correct through the CSS, semantically off for a screen reader. An optional `headingBase` prop would fix it.

8. **A tool result is truncated before its proposal id is read.** `src/server/agent/events.ts:211` slices to 120 characters and `:220` then parses the proposal id from the slice. The propose tool answers with a short JSON object today, so it works, but the order is fragile. Parse first, then slice.

9. **The event mapper's tool-name map grows for the life of a session.** `src/server/agent/events.ts:116`. Entries are a few bytes each, so it needs no fix now, but a `delete` on tool_result would keep it bounded.

### Deferred-list triage

Fix before merge:

- None of the deferred items block the merge on their own. The two items I would fold into the same fix round are the demo re-record (Important 1, which the Task 2 review already flagged as "a final demo re-record moves into Task 4" and which the later fixes then invalidated again) and the `?? {}` guard (Minor 6), because both are cheap and the first is milestone evidence.

Can wait:

- The say step's message order and the duplicated return type in the fake (cosmetic).
- No unit test for the font wait (jsdom has no `document.fonts`, and the e2e label assertion covers the behaviour).
- Blank white video openings (cosmetic, and a re-record does not change it).
- Markdown tables and the chip kind label (the spec and Claude's replies work without them).

Rulings:

- Seeding a `login` element for the compile flow: right. Without it the spec's citation cannot resolve and the flow cannot prove the click lands on the board.
- Playwright outside the sandbox and the tsconfig and biome edits: right and unavoidable.
- Fragment per line, one code-ratio token, CommonMark-like italics, one level of nested lists: right. The blank-line limitation is documented in the renderer and is the kind of thing a reader sees as a slightly odd list, not a broken one.
- BoardView announces its board on mount: right, and the test pins it. I checked that `useSendToServer` queues messages sent before the socket opens, so the early send cannot be lost.
- The restored-transcript behaviour (user words after the run prompt) accepted: right. `shownRunPrompt` does exactly what the live transcript did.
- Task 4 item 0 reduced to a visual confirmation and then fixed properly in 6692890 and 59549c4: right, and the e2e asserts the labels.
- No ruling looks wrong.

### Declined to judge

- The destination of Allow always rules (session versus settings file) is a milestone 1 behaviour and a named risk in design section 10; this branch does not change it.
- A symlink inside the session cwd pointing outside it would pass the fake's write guard; the fake runs only scenarios the user points it at.
- When the open board is deleted on disk, the sidebar drops it but the open view stays mounted with the stale scene; Task 4 item 1 asked only for the sidebar.
- Other-session transcripts relativize paths against the repository root rather than that session's own cwd; those sessions are read-only listings.
- The real SDK may echo user messages that the fake only saves; the server's mapper ignores plain user text in both cases, so callers do not depend on it.
- The e2e fixture rebuilds the whole project per worker, which makes `pnpm e2e` slow; correctness is unaffected.
- `corepack enable` is not shipped on Node 25; the README targets Node 22.
- The README's claim that Claude Code auto-approves read-only Bash commands describes the CLI's behaviour, not Blueprint's.
- The compile prompt now asks Claude to read the README and package manifest for the stack; whether that adds asks in the plan session depends on the real CLI's read permissions and I did not run a real session.

### Recommendations

- Re-record the demo and re-shoot the affected screenshots as the last commit on this branch, so the evidence matches the code it ships with.
- Add the browser install line to the README and run the e2e once from a clean `/tmp` clone to close Review Focus 5 honestly.
- Decide the minimum window the layout targets and either narrow the rail and panel below it or document that the board goes compact; put the answer in DESIGN.md.
- Update the DESIGN.md permission dialog sentence and apply the `?? {}` guard while you are there.

### Assessment

Ready to merge? **With fixes**

Reasoning: the code is sound, the safety and sandbox boundaries hold, and the tests are real, but the milestone's deliverable is evidence, and the recorded demo and the README's e2e instructions do not yet match the product on this branch.
