import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { assertSlug, ExistsError } from "../files.js";

const run = promisify(execFile);
// No shell: arguments reach git as they are.
const git = (root: string, args: string[]) => run("git", args, { cwd: root });

const branchExists = (root: string, branch: string) =>
  git(root, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]).then(
    () => true,
    () => false,
  );

// A new worktree on a new branch, both from HEAD; refuses either one already there
// (ExistsError).
export async function createWorktree(
  root: string,
  slug: string,
): Promise<{ worktree: string; branch: string }> {
  assertSlug(slug);
  const worktree = join(root, ".blueprint", "worktrees", slug);
  const branch = `blueprint/${slug}`;
  const there = await access(worktree).then(
    () => true,
    () => false,
  );
  if (there) throw new ExistsError(`worktree ${worktree} already exists`);
  if (await branchExists(root, branch))
    throw new ExistsError(`branch ${branch} already exists`);
  await git(root, ["worktree", "add", worktree, "-b", branch, "HEAD"]);
  return { worktree, branch };
}

export async function isAncestor(
  root: string,
  branch: string,
): Promise<boolean> {
  if (!(await branchExists(root, branch))) return false;
  try {
    await git(root, ["merge-base", "--is-ancestor", branch, "HEAD"]);
    return true;
  } catch (err) {
    // Exit 1 is git's "no"; anything else is a real failure.
    if ((err as { code?: unknown }).code === 1) return false;
    throw err;
  }
}

export async function head(root: string): Promise<string> {
  return (await git(root, ["rev-parse", "HEAD"])).stdout.trim();
}
