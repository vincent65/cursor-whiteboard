### Task 5: README

**Files:**
- Create: `README.md`

**Contents** (each sentence on its own line): what Blueprint is in three sentences with one screenshot from `docs/design/`; requirements (macOS or Linux, Node 22.1 or later, git, Claude Code installed and logged in once with `claude`, optionally `gh` for pull requests); install and run from a clone (`pnpm install`, `pnpm build`, `node dist/cli/index.js` in a repository, or `pnpm link --global` for a `blueprint` command); the login caveat in plain words (Blueprint drives the user's own Claude Code login through the Agent SDK; Anthropic's terms reserve claude.ai login for first-party products; this is a personal tool and is not offered as a service); a walkthrough of the loop (board, ask, accept or refine, compile, split, launch, watch) linking the demo videos; trying it without a subscription with `BLUEPRINT_FAKE_SDK=e2e/scenario.json`; what lives in `.blueprint/` and what is committed; known limitations (read-only Bash is auto-approved by Claude Code; a task runs once and a failed run is retried by messaging it; squash and rebase merges need the launch override; a run whose session and worktree are both unusable needs manual cleanup; Windows is untested; one Blueprint per repository); development commands (`pnpm dev`, `pnpm check`, `pnpm e2e`, `pnpm demo`).

- [ ] **Step 1: Write it.**
- [ ] **Step 2: Follow it from a fresh clone** into `/tmp` with the fake SDK and confirm every command works as written; fix the README where it does not.
- [ ] **Step 3: Commit** `docs: README with setup, the login caveat, and the walkthrough`

---

