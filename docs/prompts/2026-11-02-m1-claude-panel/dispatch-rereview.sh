#!/usr/bin/env bash
# Usage: dispatch-rereview.sh TASK ROUND FIX_BASE HEAD FINDINGS_FILE [reasoning] ; env REVIEW_MODEL overrides the model
set -euo pipefail
N=$1; R=$2; FIX_BASE=$3; HEAD=$4; FINDINGS=$5; LEVEL=${6:-medium}
W=$(cd "$(dirname "$0")" && pwd); cd "$W/../../.."
S=/Users/vincentyip/.claude/plugins/cache/claude-plugins-official/superpowers/7.0.0/skills/subagent-driven-development
PLAN=$(sed -n '1s/^# SDD ledger — plan: //p' "$W/progress.md")
PKG=$(bash "$S/scripts/review-package" "$PLAN" "$FIX_BASE" "$HEAD" | sed 's/^wrote //; s/:.*$//')
OUT="$W/task-$N-rereview-$R-dispatch.md"
{
cat <<EOT
You are re-reviewing one task's fix round. A previous review produced findings; the implementer has attempted to fix them. Your job is to verdict each finding and inspect the fix diff, nothing else.

## The Task

Read the task brief: $W/task-$N-brief.md

## The Findings Under Verification

EOT
cat "$FINDINGS"
cat <<EOT

## The Fix

Read the implementer's report (fix reports are appended at the end): $W/task-$N-report.md

Fix base: $FIX_BASE (the head the previous review saw)
Head: $HEAD
Diff file: $PKG

Read the diff file once; it contains the fix commits, a stat summary, and the fix diff with context. Do not re-run git commands. Your review is read-only on this checkout: do not mutate the working tree, the index, HEAD, or branch state.

## You Do Not Dispatch Subagents

Do all of this review yourself. Never spawn a subagent or another reviewer.

## Scope

Verdict every finding. Inspect the fix diff for new problems the fix itself introduced. Do not re-review code the fix did not touch; anything you notice outside the fix diff goes under Out-of-Scope Observations and does not block this task.

## Tests

The implementer re-ran the covering tests and appended the output to the report. Treat the report as unverified claims: confirm the fix report names the covering tests and shows their output, and verify the claims against the diff. Do not re-run the suite to confirm. Run a focused test only when reading the code raises a specific doubt no existing run answers.

## Output Format

Your final message is the report itself. Begin directly with the first finding's verdict.

### Finding Verdicts
For each finding, in order: ADDRESSED or NOT ADDRESSED, with file:line evidence. "Attempted" is not addressed.

### New Breakage in the Fix Diff
Severity and file:line, or "None".

### Out-of-Scope Observations
Non-blocking, or "None".

### Verdict
Fix round: all findings addressed with no new Critical/Important breakage, or findings remain open (list them).
EOT
} > "$OUT"
bb thread spawn --project proj_8nemg33n3h --parent-self --provider claude-code --model "${REVIEW_MODEL:-claude-opus-5-5}" --reasoning-level "$LEVEL" --permission-mode auto --environment env_kmibyqzefs --title "M1 Task $N: re-review round $R" --prompt-file "$OUT" --json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['id'])"
