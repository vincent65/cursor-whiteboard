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

Milestone 3 of Blueprint, a local-first planning whiteboard that runs beside Claude Code: compile and tasks. A Compile action sends a fixed instruction into the plan session so Claude writes `.blueprint/spec.md` with six fixed sections and citations to board elements and doc headings; a Split action runs a separate one-shot structured-output query (a Zod TaskGraph schema) and writes one task file per task with JSON-valued YAML frontmatter in dependency order; the server serves the spec with unknown citations dropped and reported; the UI gains spec and tasks routes, a read-only CodeMirror spec view whose citations are clickable marks, a tasks view with cards, a Compile button in the panel, a Split button in the spec view, and `?focus=` routes that select and scroll to cited board elements or doc headings. Milestones 0 to 2 are on main and are not under review except where this branch changes them.

## Requirements and Plan

- Design (the binding authority): $PWD/docs/build-plan.md, especially sections 4, 5 (spec.md and tasks/), 6.3 (citations), 6.6, 7, 8 row 3, 9, 10.
- Implementation plan with its Global Constraints and Review Focus: $PWD/docs/superpowers/plans/2026-11-02-m3-compile.md
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

Plan alignment: does the branch implement milestone 1's "done when" row and every requirement of the listed design sections; are deviations justified improvements or departures. Code quality: separation of concerns, error handling, type safety, DRY without premature abstraction, edge cases. Architecture: the compile instruction and what Claude can do with its file tools while writing the spec, the one-shot split query (schema, retries, cost, no tools), task file writing (ordering, cycles, replacing the directory atomically enough), citation cleaning on read versus the file on disk, the focus routes, and how the spec and tasks views stay fresh through the watcher. Testing: real behavior not mocks, the Review Focus items in the plan, whether the fake structured-output results match the real SDK's result shape and whether the frontmatter round trip survives real Claude output (quotes, newlines, long bodies). Production readiness for a personal local tool: obvious bugs, anything a reasonable person would hit in the first hour of compiling and splitting a plan.

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
bb thread spawn --project proj_8nemg33n3h --parent-self --provider claude-code --model claude-fable-5-1 --reasoning-level high --permission-mode auto --environment env_kmibyqzefs --title "M3 final whole-branch review" --prompt-file "$OUT" --json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['id'])"
