#!/usr/bin/env python3
# Archives the M2 SDD workspace into docs/prompts/2026-11-02-m2-proposals/ (markdown, scripts, thread outputs, README).
import os, re, shutil, subprocess
W = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(W, "..", "..", ".."))
OUT = os.path.join(ROOT, "docs", "prompts", "2026-11-02-m2-proposals")
os.makedirs(os.path.join(OUT, "threads"), exist_ok=True)
for f in sorted(os.listdir(W)):
    if f.endswith((".md", ".sh", ".py")) and not f.startswith("review-"):
        shutil.copy(os.path.join(W, f), os.path.join(OUT, f))
ledger = open(os.path.join(W, "progress.md")).read().splitlines()
seen = {}
for line in ledger:
    for tid in re.findall(r"thr_[a-z0-9]+", line):
        if tid in seen:
            continue
        m = re.search(r"Task (\d+|final)", line)
        task = f"task-{m.group(1)}" if m else "final"
        if "re-review" in line or "rereview" in line:
            kind = "rereview"
        elif "review" in line:
            kind = "review"
        elif "fix" in line and "implementer" not in line:
            kind = "fix"
        else:
            kind = "implementer"
        seen[tid] = f"{task}-{kind}"
for tid, label in seen.items():
    out = subprocess.run(["bb", "thread", "output", tid], capture_output=True, text=True).stdout
    with open(os.path.join(OUT, "threads", f"{label}-{tid}.md"), "w") as fh:
        fh.write(out)
open(os.path.join(OUT, "README.md"), "w").write(
"""# Milestone 2 orchestration log

Artifacts from the subagent-driven execution of docs/superpowers/plans/2026-11-02-m2-proposals.md on 2026-11-02.
progress.md is the controller's ledger with every ruling and deferred finding.
task-N-brief.md is the task text handed to each implementer, task-N-dispatch.md the full prompt, task-N-report.md the implementer's report, task-N-findings-R.md the findings sent into fix round R, and task-N-fix-R.md the fix-round message.
final-review-dispatch.md, final-findings.md, and final-fix-dispatch.md are the whole-branch review and its fix wave.
threads/ holds the final message of every implementer, reviewer, and re-reviewer thread, named by task and role.
Review packages (diffs) are not archived; git history is the record.
""")
print(f"archived {len(seen)} thread outputs to {OUT}")
