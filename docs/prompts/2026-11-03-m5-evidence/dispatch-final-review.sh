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

Milestone 5 of Blueprint, a local-first planning whiteboard that runs beside Claude Code: evidence and polish, the last MVP milestone. A fake Agent SDK selected by the BLUEPRINT_FAKE_SDK environment variable replays a scenario file (say, tool, write, and ask steps; structured output for the split; in-memory sessions) so Blueprint runs without a subscription; Playwright drives the built CLI against it through three flows (plan-ask-accept, compile-split, launch) and records the demo videos in docs/demo/; a design pass wrote DESIGN.md, moved styles.css onto tokens, added a hand-written React Markdown renderer with citation chips, and renders the spec as a document; a polish task cleared fourteen backlog items (including a safety fix: an ask without suggested rules offers only Allow once and Deny); the README covers setup, the login caveat, the loop, the fake mode, the .blueprint layout, and known limitations; a final acceptance on the real login ran the whole loop and fixed six things it saw. Milestones 0 to 4 are on main and are not under review except where this branch changes them; this is also the last review before the MVP is called complete, so judge the product as a whole where this branch touches it.

## Requirements and Plan

- Design (the binding authority): $PWD/docs/build-plan.md, especially sections 2 (anti-goals), 7, 8 row 5, 9, 10, 11.
- Implementation plan with its Global Constraints and Review Focus: $PWD/docs/superpowers/plans/2026-11-03-m5-evidence.md
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

Plan alignment: does the branch implement milestone 1's "done when" row and every requirement of the listed design sections; are deviations justified improvements or departures. Code quality: separation of concerns, error handling, type safety, DRY without premature abstraction, edge cases. Architecture: the fake SDK as shipped code (can it activate by accident, can a scenario write outside its cwd, does it match the real SDK where callers depend on it), the Markdown renderer as a security boundary (no HTML execution, safe links), the restyle (layout regressions, contrast, focus), the permission dialog semantics after the safety fix, and whether the README tells the truth about setup and limits. Testing: real behavior not mocks, the Review Focus items in the plan, whether the Playwright flows wait only on visible state and would catch a real regression, and whether the demo videos show the product as it is. Production readiness for a personal local tool: obvious bugs, anything a reasonable person would hit in the first hour after cloning the repository and following the README.

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
bb thread spawn --project proj_8nemg33n3h --parent-self --provider claude-code --model claude-fable-5-1 --reasoning-level high --permission-mode auto --environment env_kmibyqzefs --title "M5 final whole-branch review" --prompt-file "$OUT" --json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['id'])"
