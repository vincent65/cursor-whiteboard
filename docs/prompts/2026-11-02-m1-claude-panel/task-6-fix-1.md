The task review of your Task 6 work found two Important issues. Fix them now, in this thread, on branch `m1-claude-panel`.

## Findings to address

- Important #1: The consume-loop error path orphans the live query (src/server/agent/session.ts:210-215). The `catch` sets `this.#run = undefined` without calling `run.input.end()` or `run.query.close()`. It also catches throws from `mapper.map`, `deps.onEvent`, `onStatus`, or `onSessionId`, so after a single throwing broadcast the CLI subprocess stays alive with a pending input generator, and because `#run` is already cleared the next `send` starts a second process and never reaps the first. Fix: call `this.#stopRun()` (end the input and close the query) in the catch instead of clearing `#run`. Add a test where `onEvent` throws once and assert the first run's `close` was called and a second `send` starts exactly one new query.
- Important #2: A query that ends without throwing wedges the session (src/server/agent/session.ts:182-209). If the `for await` loop finishes normally (the CLI exits cleanly or the SDK iterator returns), nothing resets `#run` or the status; the next `send` takes the `idle → working` branch and pushes into a queue nobody reads, so status stays `working` forever with no error. Fix: after the loop, if `this.#run === run`, stop the run and set status `error` with the message `Claude session ended`, so the next `send` restarts with `resume`. Add a test whose fake query returns after one turn and assert the status and that the next `send` starts a new query.

## What to do

- Make the fixes in `src/server/agent/session.ts` and add the two tests to `test/server/agent/session.test.ts`.
- Run the covering test file, then `pnpm check` once; output must be pristine.
- Commit with a conventional message and NO co-author or generated-with trailer, for example `fix(agent): close the query on loop errors and recover when it ends on its own`.
- Append a "Fix round 1" section to your report file /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-6-report.md with: what you changed, the covering tests, the command, and its output.
- Do not spawn subagents or reviewers. Do not address other observations beyond these two findings.

End your turn with ONLY the short status contract: Status, commits (short SHA + subject), one-line test summary, concerns, report path.
