import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test as base } from "@playwright/test";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const SCENARIO = fileURLToPath(new URL("scenario.json", import.meta.url));
const PORT_LINE = /Blueprint running at (http:\/\/\S+)/;

export type App = { root: string; url: string };
// Writes files into the new repository before its one commit and the server's start.
type Seed = (root: string) => Promise<void> | void;

// No global git identity needed, and no hooks or signing from the user's config.
const git = (root: string, ...args: string[]) =>
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Blueprint E2E",
      "-c",
      "user.email=e2e@blueprint.invalid",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    { cwd: root, stdio: "pipe" },
  );

// Resolves with the URL the server prints, or rejects with its output if it exits first.
function serverUrl(child: ChildProcess): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";
    const read = (chunk: Buffer) => {
      output += chunk;
      const m = PORT_LINE.exec(output);
      if (m) resolve(m[1]);
    };
    child.stdout?.on("data", read);
    child.stderr?.on("data", read);
    child.once("exit", (code) =>
      reject(
        new Error(`Blueprint exited (${code}) before starting:\n${output}`),
      ),
    );
  });
}

export const test = base.extend<
  // start: a temporary repository with one commit, and Blueprint serving it with the
  // fake SDK. The page is not navigated; the test goes to app.url itself.
  { start: (seed?: Seed) => Promise<App> },
  // cli: the built CLI, built once per worker.
  { cli: string }
>({
  cli: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright reads the fixture's dependencies from this pattern
    async ({}, use) => {
      execFileSync("pnpm", ["build"], { cwd: REPO, stdio: "pipe" });
      await use(join(REPO, "dist", "cli", "index.js"));
    },
    { scope: "worker" },
  ],
  start: async ({ cli }, use) => {
    const started: { root: string; child?: ChildProcess }[] = [];
    await use(async (seed) => {
      // realpath: macOS's tmpdir is a symlink, and git reports worktrees by real path.
      const root = await realpath(
        await mkdtemp(join(tmpdir(), "blueprint-e2e-")),
      );
      // Registered first, so a seed or git step that throws still leaves no directory.
      const entry: (typeof started)[number] = { root };
      started.push(entry);
      git(root, "init", "--quiet", "--initial-branch=main");
      await seed?.(root);
      git(root, "add", "--all");
      git(root, "commit", "--quiet", "--allow-empty", "-m", "Initial commit");
      const child = spawn(process.execPath, [cli, "--no-open", "--port", "0"], {
        cwd: root,
        env: { ...process.env, BLUEPRINT_FAKE_SDK: SCENARIO },
      });
      entry.child = child;
      return { root, url: await serverUrl(child) };
    });
    for (const { root, child } of started) {
      if (child && child.exitCode === null && child.signalCode === null) {
        child.kill();
        await once(child, "exit");
      }
      await rm(root, { recursive: true, force: true });
    }
  },
});

export { expect } from "@playwright/test";
