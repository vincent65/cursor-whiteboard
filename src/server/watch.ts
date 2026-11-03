import { basename, join } from "node:path";
import { watch } from "chokidar";
import type { FileStore } from "./files.js";

type Change = { kind: "board" | "doc"; name: string };

const SUFFIXES = [
  ["board", ".excalidraw.json"],
  ["doc", ".md"],
] as const;

function classify(path: string): Change | undefined {
  const file = basename(path);
  for (const [kind, suffix] of SUFFIXES)
    if (file.endsWith(suffix))
      return { kind, name: file.slice(0, -suffix.length) };
}

// Reports external edits to boards and docs; echoes of the store's own writes
// are skipped by content so a client saving a file is not told to reload it.
export function watchPlan(
  store: FileStore,
  onChange: (ev: Change) => void,
): () => Promise<void> {
  const watcher = watch([join(store.dir, "boards"), join(store.dir, "docs")], {
    ignoreInitial: true,
    // Polling: native events (FSEvents) can lag by seconds under load and
    // fail in sandboxes; the plan directory is small, so stat polling is
    // cheap and has a bounded latency.
    usePolling: true,
    interval: 100,
    awaitWriteFinish: { stabilityThreshold: 100 },
    // Skips the store's temp files, which vanish mid-write.
    ignored: (path, stats) => !!stats?.isFile() && !classify(path),
  });
  const report = async (path: string) => {
    const change = classify(path);
    if (!change || (await store.isOwnWrite(path))) return;
    onChange(change);
  };
  const onEvent = (path: string) => {
    report(path).catch((err) => console.error("watch report failed", err));
  };
  watcher.on("add", onEvent).on("change", onEvent);
  return () => watcher.close();
}
