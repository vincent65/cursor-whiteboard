import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { FileStore } from "../../src/server/files.js";
import { watchPlan } from "../../src/server/watch.js";

type Ev = { kind: "board" | "doc"; name: string };

let root: string;
let store: FileStore;
let events: Ev[];
let waiters: Map<string, (ev: Ev) => void>;
let stop: () => Promise<void>;

// Resolves on the next event for `name`, or rejects after `ms`.
function eventFor(name: string, ms = 1500): Promise<Ev> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(name);
      reject(new Error(`no event for ${name}`));
    }, ms);
    waiters.set(name, (ev) => {
      clearTimeout(timer);
      waiters.delete(name);
      resolve(ev);
    });
  });
}

// A file written while chokidar is still scanning counts as initial state,
// so probe until a write is reported before each test starts.
async function untilWatching(): Promise<void> {
  const probe = join(store.dir, "docs", "probe.md");
  for (let i = 0; i < 5; i++) {
    const seen = eventFor("probe", 1000).then(
      () => true,
      () => false,
    );
    await writeFile(probe, String(i));
    if (await seen) return;
  }
  throw new Error("watcher never reported the probe");
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "blueprint-watch-"));
  store = new FileStore(root);
  await store.init();
  await store.createDoc("a");
  events = [];
  waiters = new Map();
  stop = watchPlan(store, (ev) => {
    events.push(ev);
    waiters.get(ev.name)?.(ev);
  });
  await untilWatching();
});

afterEach(async () => {
  await stop();
  await rm(root, { recursive: true, force: true });
});

test("watcher reports an external doc write and ignores the server's own write", async () => {
  await store.writeDoc("a", "x");
  await sleep(300);
  expect(events.filter((ev) => ev.name === "a")).toEqual([]);

  const next = eventFor("b");
  await writeFile(join(store.dir, "docs", "b.md"), "y");
  expect(await next).toEqual({ kind: "doc", name: "b" });
});

test("watcher maps board files to kind board and strips the extension", async () => {
  const next = eventFor("main");
  await writeFile(join(store.dir, "boards", "main.excalidraw.json"), "{}");
  expect(await next).toEqual({ kind: "board", name: "main" });
});
