#!/usr/bin/env bash
# Usage: dispatch-final-review.sh HEAD ; builds the whole-branch package from the merge base with main and spawns the Fable 5.1 reviewer
set -euo pipefail
HEAD=$1
W=$(cd "$(dirname "$0")" && pwd); cd "$W/../../.."
BASE=$(git merge-base main "$HEAD")
PKG="$W/review-final-${BASE:0:7}..${HEAD:0:7}.diff"
EXCL=(':!pnpm-lock.yaml' ':!docs/**' ':!*.svg')
{
  echo "# Commits $BASE..$HEAD"; git log --oneline "$BASE..$HEAD"; echo
  echo "# Stat"; git diff --stat "$BASE" "$HEAD" -- . "${EXCL[@]}"; echo
  echo "# Diff"; git diff -U10 "$BASE" "$HEAD" -- . "${EXCL[@]}"
} > "$PKG"
grep -E "deferred|Ruling:|parked" "$W/progress.md" > "$W/deferred-and-rulings.md" || true
OUT="$W/final-review-dispatch.md"
cat > "$OUT" <<EOT
You are a Senior Code Reviewer with expertise in software architecture, design patterns, and best practices. Your job is to review a completed branch against its design and plan and identify issues before they cascade into the next milestone.

## What Was Implemented

Milestone 2 of Blueprint, a local-first planning whiteboard that runs beside Claude Code: ghost proposals. Claude's edits to the board now arrive as proposals: shared Zod operation schemas (add_diagram, add_note, update, delete), an append-only proposal log with a store that replays it, two new in-process MCP tools (propose and revise) that validate element ids against the stored board and make a WebSocket round trip to the open tab before logging, decision and refine routes, decision notes and refine requests composed into the next message, send gating in the plan session (one send per turn, Stop drops the rest), the browser side (pure ghost placement/application/decision functions keyed on element customData, the official Mermaid importer rendering diagrams into editable shapes, the board applying proposals as ghosts and deciding them, a floating proposals bar with Accept, Reject, and Refine, and a refine chip in the panel). Two tasks were added during execution: the board export now lists connected arrows with their ids and the UI client throws typed errors with the HTTP status (decisions go to the server first), and two connecting operations (add_node and add_arrow with $<index> references to earlier add_node ops) let a proposal join new shapes to existing ones, which the spec's "add a cache between these two" scenario needs; revise can also retitle. Milestones 0 and 1 are on main and are not under review except where this branch changes them.

## Requirements and Plan

- Design (the binding authority): $PWD/docs/build-plan.md, especially sections 4 (steps 4 to 7), 5 (proposals.jsonl), 6.1 (ghost styling and customData), 6.4, 6.5 (write tools), 8 row 2, 9, 10.
- Implementation plan with its Global Constraints and Review Focus: $PWD/docs/superpowers/plans/2026-11-02-m2-proposals.md
- Deferred minor findings from the per-task reviews, parked findings, and the controller's rulings (one per line): $W/deferred-and-rulings.md
  Triage that list: say which deferred items must be fixed before merge and which can wait, and whether any ruling looks wrong.

## Git Range to Review

Base: $BASE (merge base with main)
Head: $HEAD
Diff file: $PKG

Read the diff file once; it holds the commit list, a stat summary, and the full diff with context for every source, test, and config file (the lockfile, docs, and SVGs are excluded). You may run read-only git commands and read files in the checkout for named risks, including milestone 0 code this branch builds on.

## The spec is a vision document

The spec says what the software must do. It does not enumerate every input, environment, or condition the software will meet. For behavior the spec is silent on, judge by what a reasonable person using this software would expect: that expectation is a requirement, and silence is not permission. Grade such findings by their effect on that person.

## Declined to judge

Before your verdict, list every behavior you considered and set aside as outside the plan or spec, one line each, with the reason. Nothing you set aside is dropped silently; the controller rules on each line.

## Read-Only Review

Your review is read-only on this checkout. Do not mutate the working tree, the index, HEAD, or branch state in any way. Do not run the full test suite; the per-task reports already carry that evidence. Run a focused command only when reading the code raises a specific doubt. Never start the server with a real Claude session: every real turn spends the user's plan allowance.

## You Do Not Dispatch Subagents

Do all of this review yourself. Never spawn a subagent or another reviewer. If the diff is too large for one pass, review it in passes and say so.

## What to Check

Plan alignment: does the branch implement milestone 1's "done when" row and every requirement of the listed design sections; are deviations justified improvements or departures. Code quality: separation of concerns, error handling, type safety, DRY without premature abstraction, edge cases. Architecture: the proposal lifecycle end to end (validate, round trip, log, ghost, decide, revise, refine), what happens on reload or restart with ghosts pending, the send gating change in the session, the anti-goal that AI edits never land without an accept, the failure paths (bad Mermaid, unknown ids, no tab, timeouts, torn log), and consistency between the server's pending set and the ghosts on the board. Testing: real behavior not mocks, the Review Focus items in the plan, whether the pure ghost functions and the importer tests model what Excalidraw really does (bound text, groups, soft deletes). Production readiness for a personal local tool: obvious bugs, anything a reasonable person would hit in the first hour of asking for diagrams and changes.

## Calibration

Categorize by actual severity; not everything is Critical. Acknowledge what was done well before listing issues. Flag significant deviations from the plan specifically. If you find issues with the plan or design itself, say so.

## Output Format

### Strengths
### Issues
#### Critical (Must Fix)
#### Important (Should Fix)
#### Minor (Nice to Have)
For each issue: file:line, what is wrong, why it matters, how to fix if not obvious.
### Deferred-list triage
### Declined to judge
### Recommendations
### Assessment
Ready to merge? Yes | No | With fixes
Reasoning: one or two sentences.
EOT
bb thread spawn --project proj_8nemg33n3h --parent-self --provider claude-code --model claude-fable-5-1 --reasoning-level high --permission-mode auto --environment env_kmibyqzefs --title "M2 final whole-branch review" --prompt-file "$OUT" --json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['id'])"
