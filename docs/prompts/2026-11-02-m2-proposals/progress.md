# SDD ledger — plan: docs/superpowers/plans/2026-11-02-m2-proposals.md
- Workspace created on 2026-11-02 while milestone 1 finished; execution starts on branch m2-proposals after m1-claude-panel merges to main.

## Pre-flight scan (2026-11-02)

| Tasks | Produced vs consumed | Finding |
|---|---|---|
| 1 → 2 | `ProposalLogEntry` (event+proposal / event+id), `Proposal`, `Decision` | consistent |
| 2 → 3 | `ProposalStore.newId/get/pending/proposed/revised` | consistent; `decided/takeNotes` used by Task 4 |
| 3 → 4 | `createBoardTools({ store, hub, proposals })` | Task 4 constructs and loads the store before building tools |
| 3 → 8 | `proposal.apply` request `{ proposal, replace }`, response `{ elementIds }` | consistent |
| 1 → 5 | `Op`, `Proposal`, `Decision` in ghosts.ts | consistent |
| 5 → 7 | `Counts` | consistent |
| 5, 6 → 8 | `applyProposal(rendered: Map<number, El[]>)` fed by `renderMermaid`/`renderNote` returning Excalidraw elements | cast at the BoardView boundary, stated in Tasks 6 and 8 |
| 4 → 7 | `agentSend(text, selection?, proposalId?)`, `GET /api/agent/proposals`, `POST /api/agent/proposals/:id/decision { decision }` | consistent |
| 7 → 9 | `useRefine` target `{ id, title }` | consistent |
| 4 → 9 | `PlanSession.send(text, shown)`; header-stripping removal | conflict found: Task 4 told the implementer to edit ClaudePanel.tsx, which Task 9 owns — fixed in the plan (commit after d6886a1): Task 9 removes the code and test |
| 3 (self) | tests call handlers through the MCP server's private `_registeredTools` (M1 pattern) | rubric may call it fragile; ruling: keep the M1 pattern for consistency, deferred minor |
| 8 (self) | no unit test (Excalidraw cannot run in vitest) | accepted; logic lives in Tasks 5 to 7, manual check plus M5 Playwright |

Rulings: none beyond the two rows above.
- Execution started on branch m2-proposals from main 75105af
- Task 1: dispatched implementer thr_f82miq7dh6; BASE = 75105af
- Task 1: implementer DONE (commit 4979eb5, 140 tests); dispatched review thr_375m3a4f8f
- Task 1: review (thr_375m3a4f8f): Approved, 0 Important, 4 minor.
- Task 1: minor (deferred): schema-failure branch of readProposals untested; Zod error message is multi-line (use z.prettifyError); `Proposal` shape declared twice (type and schema); a torn trailing log line makes the log unreadable (Ruling: Task 4 keeps the server up and reports it, like sessions.json).
- Task 1: complete (commit 4979eb5, review clean)
- Task 2: dispatched implementer thr_sa6y4zzcm6; BASE = 4979eb5
- Task 2: implementer DONE_WITH_CONCERNS (commit 3b81289, 146 tests).
- Ruling: ProposalStore serializes proposed/revised/decided through one chain (a double-clicked Accept would otherwise log twice and queue two notes) and newId reserves ids it hands out — both beyond the brief, both accepted — costs nothing if wrong.
- Task 2: dispatched review thr_k4gmsjundb (plan docs commit for M4 sits between: 0b08bb0)
- Task 2: review (thr_k4gmsjundb): Approved, 0 Important, 4 minor.
- Task 2: minor (deferred): newId's seen.add untested for two calls before proposed; test-level `queued` bytes never reset (afterEach); load() outside the serial chain (comment it); revise does not check the board (Ruling: Task 3's revise tool checks hub.activeBoard against the record's board).
- Task 2: complete (commit 3b81289, review clean)
- Task 3: dispatched implementer thr_rtmwahrbd7; BASE = 0b08bb0
- Task 3: implementer DONE_WITH_CONCERNS (commit 163e0f3, 156 tests); src/server/agent/index.ts got a one-line `new ProposalStore(store)` to keep typechecking green (Ruling: accepted; Task 4 replaces it with the loaded store).
- Task 3: dispatched review thr_idqwuy3593
- Task 3: review (thr_idqwuy3593): Approved, 0 Important, 7 minor.
- Task 3: minor carried to Task 4 by ruling: revise/decide race (store marks an in-flight revise; decided refuses with 409), add-ghost ids must fail id validation, the pending line names only the board being read.
- Task 3: minor (deferred by design): ghosts drawn but unlogged after a timeout stay on the board with no record — the bar still shows them from the scene and a reject removes them (decision route 404 is tolerated); test fixture leak on failure; `revising undefined` when proposalId is missing.
- Task 3: complete (commit 163e0f3, review clean)
- Task 4: dispatched implementer thr_tf6seexqt2; BASE = 163e0f3
- Task 4: implementer DONE_WITH_CONCERNS (commit b0e701a, 167 tests; routes and the torn-log startup path checked against the built server); concerns are observations (try/finally covers a rejection, not a hang; a separate message template for a resumed run that fails before init).
- Task 4: dispatched review thr_th229emvwy
- Task 4: review (thr_th229emvwy): Needs fixes (1 Important: an append after a torn log tail corrupts the next line; 5 minor)
- Ruling: appendProposal guards the trailing newline and readProposals skips only a torn final line with a warning (every other bad line still throws); a restart test pins it — a torn tail is the realistic corruption and must never need hand editing — costs one skipped partial line if wrong.
- Ruling: fixed in the same round: beginRevise serialized with pendingOrThrow and called before checkIds; 409 mapped in statusFor; a comment naming the one-result-per-send assumption; deferred: close() hang coverage, notes lost on a synchronous send throw.
- Task 4: fix round 1/5 started (resume thr_tf6seexqt2); FIX_BASE = b0e701a
- Task 4: fix round 1/5 done (commit e5a3485, 173 tests); Ruling corrected: a torn non-JSON last line is truncated on append instead of newline-separated (my ruling would have left it as a middle line that throws on read) — the implementer's reasoning was right.
- Task 4: dispatched re-review thr_js9rsfi3ke
- Task 4: re-review 1 (thr_js9rsfi3ke): all 4 findings addressed, no new breakage; nits deferred (helper placement splits the error-class block; an unterminated last line that is valid JSON but fails the schema still throws on read, same as any corrupt line).
- Task 4: complete (commits b0e701a..e5a3485, review clean)
- Task 5: dispatched implementer thr_jmmbr674ce; BASE = e5a3485
- Task 5: implementer DONE_WITH_CONCERNS (commit 5d72597, 185 tests).
- Ruling: the proposal id is appended to groupIds (Excalidraw's outermost group is last), correcting the plan; accept restores an addition's rendered strokeStyle instead of forcing solid (dotted Mermaid arrows stay dotted); plan and constraints updated — fixed before review in a round 0.
- Task 5: concerns accepted as designed: accepted additions keep the proposal group; a label change on a shape without a text label throws so the tool error reaches Claude.
- Task 5: fix round 0 started (resume thr_jmmbr674ce)
- Task 5: fix round 0 done (commit d86a94c, 186 tests); dispatched review thr_uwnxdh9ss5 (diff e5a3485..d86a94c includes the plan docs commit 8e52994)
- Task 5: review (thr_uwnxdh9ss5): Needs fixes (2 Important: cross-proposal targets corrupt both proposals; wrapped label reject writes line breaks into originalText; 6 minor)
- Ruling: ops may not target another pending proposal's ghost (throw naming the proposal); label snapshots use originalText; an empty rendered group is an error; a delete ghost fades its bound text too (counted once); deferred: untested extra throws, arrow x as left edge, toEqual undefined-key cosmetics; plan test comment corrected.
- Task 5: fix round 1/5 started (resume thr_jmmbr674ce); FIX_BASE = d86a94c
- Deferred (final wave candidate): the server-side checkIds in tools.ts could also refuse targets that are update/delete ghosts of another pending proposal, failing before the browser round trip; the browser check from Task 5 is the safety net today.
- Task 5: fix round 1/5 done (commit 0f7adb1, 190 tests); minor (deferred): a proposal whose only op updates a bound text directly shows with zero counts.
- Task 5: dispatched re-review thr_g87msbxu7a (diff 568d6f4..0f7adb1)
- Task 5: re-review 1 (thr_g87msbxu7a): all 4 addressed, no new breakage; minor (deferred): "N added" counts shapes only (bound labels inside a diagram are not counted) — accepted as the better reading.
- Task 5: complete (commits 5d72597..0f7adb1, review clean)
- Task 6: dispatched implementer thr_dtkdxhg6n4; BASE = 0f7adb1
- Task 6: implementer DONE_WITH_CONCERNS (commit df61855, 194 tests); Ruling: vitest.config.ts gains server.deps.inline for @excalidraw/excalidraw (its roughjs import does not resolve under Vitest otherwise) and the test stubs FontFace beside canvas — both accepted as test-infrastructure enablers.
- Task 6: dispatched review thr_av8uheui87
- Task 6: review (thr_av8uheui87): Approved, 0 Important, 2 minor.
- Task 6: minor (deferred to the final wave): `renderMermaid` treats an empty `files` object as unsupported (`Object.keys(files ?? {}).length` is sturdier); the FontFace/canvas stubs live in the test file and should move to a shared jsdom setup when a second test needs them.
- Task 6: complete (commit df61855, review clean)
- Task 7: dispatched implementer thr_7rsw65cyz7; BASE = df61855
- Task 7: implementer DONE_WITH_CONCERNS (commit fab1e18, 197 tests); the bar is unmounted until Task 8, whose dispatch now carries the visual check; dispatched review thr_d9cuyrmwx3
- Task 7: review (thr_d9cuyrmwx3): Approved, 0 Important, 3 minor.
- Task 7: minor (deferred): api.ts proposal calls untested on the client side (server routes cover the contract); refine setter defaults to a no-op outside the provider (same pattern as selection); .button-primary hover barely changes (visual check in Task 8).
- Task 7: complete (commit fab1e18, review clean)
- Task 8: dispatched implementer thr_jhqrb824mq; BASE = fab1e18
- Task 8: implementer DONE_WITH_CONCERNS (commit a8d2db0, 197 tests; real-login check: reject, accept, reload rebuilding the bar, 404 path).
- Ruling: accepted beyond the brief — decisions bump element version/versionNonce in the shared patch helper (otherwise the scene version does not change, so nothing saves, undo skips it, and the bar does not refresh); the bar sits at bottom 64px so it clears Excalidraw's zoom, undo, and help controls.
- Finding (from the manual run, outside Task 8): the board Markdown gives no ids for connected arrows, so Claude cannot delete or update an arrow ("add a cache between these two" deleted both boxes instead). Ruling: a new Task 8b adds an Arrows section with ids to the export (goldens updated) and names it in the system prompt; the same task gives api.ts errors a status code so BoardView stops matching the 404 by message text.
- Task 8: dispatched review thr_dr85fmy9i8
- Task 8: review (thr_dr85fmy9i8): Approved, 0 Important, 5 minor.
- Ruling: decisions go to the server first (a 409 during a revise must apply nothing locally; a 404 applies locally with a warning) and decided titles are pruned — folded into Task 8b with the 404 status fix.
- Task 8: minor (deferred, for the final review): undo after a decision or after an apply is not synced with the server's pending set; ghosts are drawn while the disk-conflict banner is up.
- Task 8: complete (commit a8d2db0, review clean)
- Task 8b: dispatched implementer thr_gu27btsehv; BASE = 46336d8
- Task 8b: implementer DONE (commit f783aab, 201 tests); the 409 decision path is covered by the api error test only, acceptance exercises the real flow; dispatched review thr_6txen2gvgi
- Task 8b: review (thr_6txen2gvgi): Approved, 0 Important, 6 minor.
- Task 8b: minor (deferred, final-wave candidates): inner `arrow` shadows the new helper in markdown.ts; no in-flight guard on Accept/Reject (double click sends twice); stale `target` closure after the await (use the functional setter); the 404/409 branching has no test (extract `shouldApplyLocally(err)`); the prompt names only nodes and arrows as id sources (Unconnected arrows and Other elements also carry ids); Arrows bullets keep stored direction while the Mermaid line reverses start-only arrows.
- Task 8b: complete (commit f783aab, review clean)
- Task 9: dispatched implementer thr_azc2mck6xr; BASE = f783aab
- Task 9: implementer DONE_WITH_CONCERNS (commit d686b2e, 203 tests; manual check of the chip in the built app); minor (deferred): a Refine click on another proposal during an in-flight send is cleared when that send finishes; dispatched review thr_vdd2dc3hhc
- Task 9: review (thr_vdd2dc3hhc): Approved, 0 Important, 3 minor.
- Task 9: minor (deferred, final-wave candidates): a resolving send can clear a newer refine target (functional setter keyed on the sent id); the chip can name an already-decided proposal (BoardView clears it on its own decisions, not on other tabs' or Claude's); the selection-plus-refine combination is untested.
- Task 9: complete (commit d686b2e, review clean)
- Task 10: dispatched implementer thr_iuvg8b87ju; BASE = d686b2e
- Task 10: acceptance passed (DONE_WITH_CONCERNS, no commits): ghosts, placement, reject/accept, refine, restart all as specified; first ghost 11.7 s on the first turn then 2 to 5 s.
- Finding (acceptance): no op can connect a new shape to existing ones, so "add a cache between these two" redraws both boxes. Ruling: Task 11 adds `add_node` and `add_arrow` with `$<i>` references and lets `revise` retitle (acceptance concern 3); Claude refusing a pie chart in text is correct behaviour, not a defect; ToolSearch rows remain the M1 deferred item.
- Task 10: complete (acceptance passed; Task 11 added before the final review)
- Task 11: dispatched implementer thr_snaibdf3rw; BASE = 1546019
- Task 11: implementer DONE_WITH_CONCERNS (commit bfc6336, 212 tests; real-login run: the arrow turns red, Cache box and two bound arrows appear, accepted arrows follow a dragged box).
- Ruling: accepted beyond the brief — BoardView patches the targets' boundElements itself (Excalidraw 0.18.1's repairBindings does not), and arrow labels get a non-zero size so Excalidraw keeps them.
- Ruling: "between" placement — a new node joined by two arrows to two distinct existing elements is centered on the midpoint of their centers and ignores near; prompt gains one sentence — fixed before review in round 0.
- Task 11: fix round 0 started (resume thr_snaibdf3rw)
- Task 11: fix round 0 done (commit 74aed14, 214 tests); dispatched review thr_k9iu5j57sv (diff 1546019..74aed14 includes the plan docs commit 174b4dd)
- Task 11: review (thr_k9iu5j57sv): Needs fixes (1 Important: the bound-arrow listing is untested and scans the whole scene; 6 minor)
- Ruling: listBoundArrows moves into ghosts.ts as a tested pure function (skips deleted arrows and targets, identity-preserving); arrow ends get the cross-proposal guard and may not be deleted by the same proposal; $ refs match a strict regex; self-loops are rejected; the ref helpers live in a zod-free src/shared/refs.ts; plan sketch corrected.
- Task 11: fix round 1/5 started (resume thr_snaibdf3rw); FIX_BASE = 74aed14
- Task 11: fix round 1/5 done (commit 9dac292, 222 tests); dispatched re-review thr_2f73mns82d (diff 7a0c209..9dac292)
- Task 11: re-review 1 (thr_2f73mns82d): all 5 addressed, no new breakage; minor (deferred): applyProposal itself does not reject self-loops (only the server does).
- Task 11: complete (commits bfc6336..9dac292, review clean)
- All tasks complete; `pnpm check` (222 tests) and `pnpm build` confirmed by the controller locally.
- Final review: dispatched thr_wips97jyai on claude-fable-5-1 (base 75105af, head 9dac292)
- Final review (thr_wips97jyai): With fixes — 0 Critical, 5 Important (update ghosts exported as fact; orphaned proposals after a manual delete or undo; no in-flight guard on decisions; the restore seam untested; decision notes lost on a dropped send), 8 Minor; rulings upheld, with two notes (export hiding incomplete; the 404-applies-locally rule needs the in-flight guard beside it).
- Ruling: one fix wave of 10 items (Important 1-5, triage 6-7, minors 8-10); ghost normalization lives in the export module so the tools, the export route, and milestone 3's compile agree; the reconciliation posts a reject after a 1 s grace period; `onNotSent` lets the agent re-queue notes.
- Final fix wave: dispatched implementer thr_st8ui7gpc7 (fresh, Opus 5.5 high); FIX_BASE = 9dac292
- Final fix wave: done (10 commits 5a92a2e..dceb14a, 234 tests); concerns are observations (no BoardView component test; leaving the board within the 1 s grace keeps the proposal pending server-side; notes drop at the result, not the next send); dispatched re-review thr_jnb4cyiz7n
- Final re-review (thr_jnb4cyiz7n): all 10 addressed, no new Critical or Important breakage; `pnpm check` (234 tests) and `pnpm build` confirmed by the controller locally.
- Ruling (residual, carried to the M3 plan as Task 0): the browser reconcile has three narrow gaps (a 409 is not retried, its UI state is not cleaned, leaving the board within the 1 s grace keeps the orphan); a server-side backstop closes all three: on every board save, a pending proposal of that board with no ghost-tagged live element left is logged rejected (skipped while it is being revised) — costs one scan per save if wrong.
- Minor (deferred): `labelOf(out, cur.id) as El` hides an undefined for a label update on an element without a label; BoardView has no component test.
- Milestone 2 complete: fast-forward merge of m2-proposals into main, push, archive the workspace to docs/prompts/2026-11-02-m2-proposals/.
