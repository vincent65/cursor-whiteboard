#!/usr/bin/env bash
# Usage: dispatch-review.sh TASK BASE HEAD [reasoning] ; env REVIEW_MODEL overrides the model
set -euo pipefail
N=$1; BASE=$2; HEAD=$3; LEVEL=${4:-high}
W=$(cd "$(dirname "$0")" && pwd); cd "$W/../../.."
S=/Users/vincentyip/.claude/plugins/cache/claude-plugins-official/superpowers/7.0.0/skills/subagent-driven-development
PLAN=$(sed -n '1s/^# SDD ledger — plan: //p' "$W/progress.md")
PKG=$(bash "$S/scripts/review-package" "$PLAN" "$BASE" "$HEAD" | sed 's/^wrote //; s/:.*$//')
OUT="$W/task-$N-review-dispatch.md"
{
cat <<EOT
You are reviewing one task's implementation: first whether it matches its requirements, then whether it is well-built. This is a task-scoped gate, not a merge review; a broad whole-branch review happens separately after all tasks are complete.

## What Was Requested

Read the task brief: $W/task-$N-brief.md

Global constraints from the spec that bind this task:
EOT
cat "$W/constraints.md"
cat <<EOT

## What the Implementer Claims They Built

Read the implementer's report: $W/task-$N-report.md

## Diff Under Review

Base: $BASE
Head: $HEAD
Diff file: $PKG

Read the diff file once. It contains the commit list, a stat summary, and the full diff with context. The diff's context lines are the changed files: do not Read a changed file separately unless a hunk you must judge is cut off, and say so in your report. Do not re-run git commands. Do not crawl the broader codebase. Inspect code outside the diff only to evaluate a concrete risk you can name, and name both the risk and what you checked.

Your review is read-only on this checkout. Do not mutate the working tree, the index, HEAD, or branch state in any way.

## You Do Not Dispatch Subagents

Do all of this review yourself. Never spawn a subagent or another reviewer.

## Do Not Trust the Report

Treat the implementer's report as unverified claims, including its design rationales. Verify them against the diff. A stated rationale never downgrades a finding's severity.

## Tests

The implementer already ran the tests and reported results with TDD evidence. Do not re-run the suite to confirm. Run a focused test only when reading the code raises a specific doubt no existing run answers. Warnings or noise in the reported output are findings. If the report's evidence looks truncated, re-read the report file; if it is genuinely missing, report that as a gap.

## Part 1: Spec Compliance

Compare the diff against the brief: Missing (skipped or claimed without implementing), Extra (unrequested features, files, exports), Misunderstood (right thing built the wrong way). Check every test the brief lists exists and asserts what the brief says. Report anything you cannot verify from the diff alone as a warning item.

## Part 2: Code Quality

Separation of concerns, error handling, DRY without premature abstraction, edge cases; whether tests verify real behavior rather than mocks and cover the task's edge cases; whether each file has one responsibility and follows the plan's structure.

Point at evidence with file:line references for every finding.

## Calibration

Important means this task cannot be trusted until fixed: incorrect or fragile behavior, a missed requirement, or maintainability damage you would block a merge over. Polish is Minor. If the brief mandates something this rubric calls a defect, report it as Important, labeled plan-mandated. Acknowledge what was done well before listing issues.

## Output Format

Your final message is the report itself. Begin directly with the spec-compliance verdict; every line is a verdict, a finding with file:line, or a check you ran.

### Spec Compliance
- Spec compliant | Issues found: ...
- Cannot verify from diff: ...

### Strengths

### Issues
#### Critical (Must Fix)
#### Important (Should Fix)
#### Minor (Nice to Have)

### Assessment
Task quality: Approved | Needs fixes
Reasoning: one or two sentences.
EOT
} > "$OUT"
bb thread spawn --project proj_8nemg33n3h --parent-self --provider claude-code --model "${REVIEW_MODEL:-claude-opus-5-5}" --reasoning-level "$LEVEL" --permission-mode auto --environment env_kmibyqzefs --title "M5 Task $N: review" --prompt-file "$OUT" --json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['id'])"
