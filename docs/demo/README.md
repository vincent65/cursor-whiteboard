# Demo videos

`pnpm demo` records these three flows at 1280 by 800 and writes them here.
Each one runs Blueprint against the fake SDK scenario in `e2e/scenario.json`, so no API key or Claude session is involved.
`pnpm e2e` runs the same flows without recording.

| Video | Flow |
| --- | --- |
| [01-plan-ask-accept.webm](01-plan-ask-accept.webm) | Create a board, draw two boxes, select them, ask in the panel, and accept the proposed flowchart. |
| [02-compile-split.webm](02-compile-split.webm) | Compile the plan into a spec, follow its citation to the cited box on the board, and split the spec into two tasks. |
| [03-launch-run.webm](03-launch-run.webm) | Launch the first task as a run on its own branch and worktree, allow the push it asks about, and see it finish with a PR link. |
