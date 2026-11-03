import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { ExistsError } from "../../../src/server/files.js";
import {
  createWorktree,
  head,
  isAncestor,
} from "../../../src/server/runs/git.js";

const run = promisify(execFile);
const git = (cwd: string, ...args: string[]) => run("git", args, { cwd });

let repo: string;

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), "blueprint-git-"));
  await git(repo, "init", "-q");
  await git(repo, "config", "user.name", "Test");
  await git(repo, "config", "user.email", "test@example.com");
  await git(repo, "config", "commit.gpgsign", "false");
  await writeFile(join(repo, "README.md"), "hi\n");
  await git(repo, "add", ".");
  await git(repo, "commit", "-q", "-m", "init");
});

afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
});

test("createWorktree makes the branch and directory from HEAD and refuses a second time", async () => {
  const start = await head(repo);
  expect(start).toMatch(/^[0-9a-f]{40}$/);
  const { worktree, branch } = await createWorktree(repo, "auth");
  expect(worktree).toBe(join(repo, ".blueprint", "worktrees", "auth"));
  expect(branch).toBe("blueprint/auth");
  expect(existsSync(join(worktree, ".git"))).toBe(true);
  expect(await head(worktree)).toBe(start);

  // Both refusals are conflicts (409), not server bugs.
  const again = createWorktree(repo, "auth");
  await expect(again).rejects.toThrow(`worktree ${worktree} already exists`);
  await expect(again).rejects.toBeInstanceOf(ExistsError);
  // The branch alone is enough to refuse.
  await rm(worktree, { recursive: true, force: true });
  await git(repo, "worktree", "prune");
  const branchTaken = createWorktree(repo, "auth");
  await expect(branchTaken).rejects.toThrow(
    "branch blueprint/auth already exists",
  );
  await expect(branchTaken).rejects.toBeInstanceOf(ExistsError);
  await expect(createWorktree(repo, "../escape")).rejects.toThrow(
    "invalid name",
  );
});

test("isAncestor is false for a missing branch, true after merging it", async () => {
  expect(await isAncestor(repo, "blueprint/nope")).toBe(false);

  const { worktree, branch } = await createWorktree(repo, "auth");
  // A fresh branch points at HEAD, so it already is one.
  expect(await isAncestor(repo, branch)).toBe(true);
  await writeFile(join(worktree, "auth.ts"), "export {};\n");
  await git(worktree, "add", ".");
  await git(worktree, "commit", "-q", "-m", "auth");
  expect(await isAncestor(repo, branch)).toBe(false);

  await git(repo, "merge", "-q", "--no-ff", "-m", "merge auth", branch);
  expect(await isAncestor(repo, branch)).toBe(true);
});

test("isAncestor re-throws a git failure that is not its no", async () => {
  await git(repo, "branch", "blueprint/auth");
  // An unborn HEAD makes merge-base fail with 128, not with its "no" of 1.
  await git(repo, "checkout", "-q", "--orphan", "empty");
  await expect(isAncestor(repo, "blueprint/auth")).rejects.toThrow(/HEAD/);
});
