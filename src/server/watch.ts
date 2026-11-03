import { basename, dirname, join } from "node:path";
import { watch } from "chokidar";
import type { FileStore } from "./files.js";

type Change = {
  kind: "board" | "doc" | "spec" | "task";
  name: string;
  deleted?: true;
};

// Watched directory, the kind its files report, and the suffix they carry.
const DIRS = [
  ["boards", "board", ".excalidraw.json"],
  ["docs", "doc", ".md"],
  ["tasks", "task", ".md"],
] as const;

function classify(path: string): Omit<Change, "deleted"> | undefined {
  const file = basename(path);
  const dir = basename(dirname(path));
  if (file === "spec.md" && dir === ".blueprint")
    return { kind: "spec", name: "spec" };
  for (const [d, kind, suffix] of DIRS)
    if (dir === d && file.endsWith(suffix))
      return { kind, name: file.slice(0, -suffix.length) };
}

// Reports external edits and deletions of boards, docs, the spec, and task files; echoes of
// the store's own writes are skipped by content so a client saving a file is
// not told to reload it.
export function watchPlan(
  store: FileStore,
  onChange: (ev: Change) => void,
): () => Promise<void> {
  const paths = [
    ...DIRS.map(([d]) => join(store.dir, d)),
    join(store.dir, "spec.md"),
  ];
  const watcher = watch(paths, {
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
  const report = async (path: string, deleted: boolean) => {
    const change = classify(path);
    if (!change || (await store.isOwnWrite(path))) return;
    onChange(deleted ? { ...change, deleted } : change);
  };
  const onEvent = (deleted: boolean) => (path: string) => {
    report(path, deleted).catch((err) =>
      console.error("watch report failed", err),
    );
  };
  watcher
    .on("add", onEvent(false))
    .on("change", onEvent(false))
    .on("unlink", onEvent(true));
  return () => watcher.close();
}
