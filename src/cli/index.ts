#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FileStore } from "../server/files.js";
import { startServer } from "../server/index.js";
import { parseArgs } from "./args.js";
import { openBrowser } from "./open.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  await new FileStore(root).init();
  if (args.command === "init") {
    console.log(`Initialized .blueprint/ in ${root}`);
    return;
  }
  const server = await startServer({
    root,
    port: args.port,
    uiDir: fileURLToPath(new URL("../ui", import.meta.url)),
  });
  const url = `http://localhost:${server.port}`;
  console.log(`Blueprint running at ${url}`);
  if (args.open) openBrowser(url);
}

// realpath: the installed bin is a symlink to this file.
if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
