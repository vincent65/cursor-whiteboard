import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  createSdkMcpServer,
  type Options,
  type SDKMessage,
  type SDKUserMessage,
  tool,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { SdkEventMapper } from "../../../src/server/agent/events.js";
import { transcriptFrom } from "../../../src/server/agent/session.js";
import { splitSpec } from "../../../src/server/agent/split.js";
import { createFakeSdk } from "../../../src/server/fake/sdk.js";
import { startServer } from "../../../src/server/index.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "blueprint-fake-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const task = (slug: string, dependsOn: string[] = []) => ({
  slug,
  title: `Build ${slug}`,
  body: "",
  dependsOn,
  files: [],
  acceptance: [],
  sources: [],
});

async function fake(scenario: Record<string, unknown>) {
  const path = join(dir, "scenario.json");
  await writeFile(
    path,
    JSON.stringify({ plan: [], run: [], split: { tasks: [] }, ...scenario }),
  );
  return createFakeSdk(path);
}

const user = (text: string): SDKUserMessage => ({
  type: "user",
  message: { role: "user", content: text },
  parent_tool_use_id: null,
});

async function* prompts(...texts: string[]) {
  for (const t of texts) yield user(t);
}

async function collect(messages: AsyncIterable<SDKMessage>) {
  const out: SDKMessage[] = [];
  for await (const m of messages) out.push(m);
  return out;
}

// What the panel would show for these messages.
const events = (messages: SDKMessage[]) => {
  const mapper = new SdkEventMapper();
  return messages.flatMap((m) => mapper.map(m));
};

const sayRule = (match: string, text: string, costUsd?: number) => ({
  match,
  steps: [{ do: "say", text }],
  ...(costUsd === undefined ? {} : { costUsd }),
});

describe("the scenario file", () => {
  test("a bad step is named in the error", async () => {
    const bad = fake({
      plan: [
        {
          match: "x",
          steps: [{ do: "say", text: "ok" }, { do: "jump" }],
        },
      ],
    });
    await expect(bad).rejects.toThrow(/plan\[0\]\.steps\[1\]/);
  });

  test("a match that is not a regular expression is named in the error", async () => {
    const bad = fake({ run: [{ match: "(", steps: [] }] });
    await expect(bad).rejects.toThrow(/run\[0\]\.match/);
  });

  test("a file that is not JSON names the file", async () => {
    const path = join(dir, "broken.json");
    await writeFile(path, "{");
    expect(() => createFakeSdk(path)).toThrow(path);
  });
});

describe("query", () => {
  test("a say rule streams its text and ends with a result costing costUsd", async () => {
    const sdk = await fake({
      run: [sayRule("^nope", "wrong"), sayRule("hello", "Hi there.", 0.25)],
    });
    const msgs = await collect(
      sdk.query({
        prompt: prompts("well hello"),
        options: { includePartialMessages: true },
      }),
    );
    expect(msgs[0]).toMatchObject({ type: "system", subtype: "init" });
    const sessionId = (msgs[0] as { session_id: string }).session_id;
    expect(msgs.some((m) => m.type === "stream_event")).toBe(true);
    expect(
      events(msgs).map((e) => [e.kind, "text" in e ? e.text : undefined]),
    ).toEqual([
      ["assistant_text", "Hi there."],
      ["assistant_text", "Hi there."],
      ["result", undefined],
    ]);
    expect(msgs.at(-1)).toMatchObject({
      type: "result",
      subtype: "success",
      session_id: sessionId,
      total_cost_usd: 0.25,
      result: "Hi there.",
    });
  });

  test("each result reports the query's running cost", async () => {
    const sdk = await fake({ run: [sayRule(".", "ok", 0.5)] });
    const msgs = await collect(sdk.query({ prompt: prompts("a", "b") }));
    const costs = msgs.flatMap((m) =>
      m.type === "result" ? [m.total_cost_usd] : [],
    );
    expect(costs).toEqual([0.5, 1]);
  });

  test("a message no rule matches ends the turn with an error", async () => {
    const sdk = await fake({ run: [sayRule("^only this$", "ok")] });
    const msgs = await collect(sdk.query({ prompt: prompts("something") }));
    expect(msgs.at(-1)).toMatchObject({
      type: "result",
      subtype: "error_during_execution",
      is_error: true,
      errors: [expect.stringContaining("no run rule matches")],
    });
  });

  test("plan rules serve a session with the blueprint server; run rules any other", async () => {
    const sdk = await fake({
      plan: [sayRule(".", "from plan")],
      run: [sayRule(".", "from run")],
    });
    const blueprint = createSdkMcpServer({ name: "blueprint", tools: [] });
    const plan = await collect(
      sdk.query({
        prompt: prompts("hi"),
        options: { mcpServers: { blueprint } },
      }),
    );
    const run = await collect(sdk.query({ prompt: prompts("hi") }));
    expect(plan.at(-1)).toMatchObject({ result: "from plan" });
    expect(run.at(-1)).toMatchObject({ result: "from run" });
  });

  test("a tool rule calls the blueprint tool with parsed input and reports its result", async () => {
    const seen: unknown[] = [];
    const blueprint = createSdkMcpServer({
      name: "blueprint",
      tools: [
        tool(
          "echo",
          "Echo",
          { word: z.string(), times: z.number().default(2) },
          async (args) => {
            seen.push(args);
            return {
              content: [{ type: "text", text: args.word.repeat(args.times) }],
            };
          },
        ),
        tool("boom", "Fails", {}, async () => {
          throw new Error("kaboom");
        }),
      ],
    });
    const sdk = await fake({
      plan: [
        {
          match: ".",
          steps: [
            {
              do: "tool",
              server: "blueprint",
              name: "echo",
              input: { word: "ab" },
            },
            { do: "tool", server: "blueprint", name: "boom", input: {} },
            { do: "tool", server: "blueprint", name: "echo", input: {} },
            { do: "tool", server: "blueprint", name: "nope", input: {} },
          ],
        },
      ],
    });
    const msgs = await collect(
      sdk.query({
        prompt: prompts("go"),
        options: { mcpServers: { blueprint } },
      }),
    );
    expect(seen).toEqual([{ word: "ab", times: 2 }]);
    const shown = events(msgs).flatMap((e) =>
      e.kind === "tool_use"
        ? [[e.tool]]
        : e.kind === "tool_result"
          ? [[e.ok, e.summary]]
          : [],
    );
    expect(shown).toEqual([
      ["mcp__blueprint__echo"],
      [true, "abab"],
      ["mcp__blueprint__boom"],
      [false, "kaboom"],
      ["mcp__blueprint__echo"],
      [false, expect.stringContaining("word")],
      ["mcp__blueprint__nope"],
      [false, "no blueprint tool named nope"],
    ]);
    expect(msgs.at(-1)).toMatchObject({ type: "result", subtype: "success" });
  });

  test("a write rule writes under cwd and refuses a path outside it", async () => {
    const cwd = join(dir, "repo");
    const sdk = await fake({
      run: [
        {
          match: ".",
          steps: [
            { do: "write", path: "src/a.txt", content: "A\n" },
            { do: "write", path: "../escape.txt", content: "no" },
          ],
        },
      ],
    });
    const msgs = await collect(
      sdk.query({ prompt: prompts("go"), options: { cwd } }),
    );
    expect(await readFile(join(cwd, "src", "a.txt"), "utf8")).toBe("A\n");
    expect(existsSync(join(dir, "escape.txt"))).toBe(false);
    const shown = events(msgs).flatMap((e): unknown[][] =>
      e.kind === "tool_use"
        ? [[e.tool, e.summary]]
        : e.kind === "tool_result"
          ? [[e.ok]]
          : [],
    );
    expect(shown).toEqual([
      ["Write", `editing ${join(cwd, "src", "a.txt")}`],
      [true],
      ["Write", `editing ${join(dir, "escape.txt")}`],
      [false],
    ]);
  });

  test("a write fills {{board:<name>:first}} with that board's first labelled shape at write time", async () => {
    const cwd = join(dir, "repo");
    const boards = join(cwd, ".blueprint", "boards");
    await mkdir(boards, { recursive: true });
    const rect = (id: string, label?: string) => [
      {
        id,
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        ...(label && { boundElements: [{ id: `${id}-t`, type: "text" }] }),
      },
      ...(label
        ? [
            {
              id: `${id}-t`,
              type: "text",
              x: 0,
              y: 0,
              width: 50,
              height: 25,
              text: label,
              containerId: id,
            },
          ]
        : []),
    ];
    const board = (elements: unknown[]) =>
      JSON.stringify({ type: "excalidraw", version: 2, elements });
    await writeFile(
      join(boards, "main.excalidraw.json"),
      board([...rect("blank"), ...rect("drawn", "Login"), ...rect("b", "B")]),
    );
    const sdk = await fake({
      run: [
        {
          match: ".",
          steps: [
            {
              do: "write",
              path: "spec.md",
              content:
                "[[board:main#{{board:main:first}}]] [[board:main#{{board:main:first}}]] [[board:gone#{{board:gone:first}}]]",
            },
          ],
        },
      ],
    });
    await collect(sdk.query({ prompt: prompts("go"), options: { cwd } }));
    // A board that does not exist leaves its placeholder, so the citation reads as dropped.
    expect(await readFile(join(cwd, "spec.md"), "utf8")).toBe(
      "[[board:main#drawn]] [[board:main#drawn]] [[board:gone#{{board:gone:first}}]]",
    );
  });

  test("an ask rule goes through canUseTool and reports allow or deny", async () => {
    const canUseTool = vi
      .fn<NonNullable<Options["canUseTool"]>>()
      .mockResolvedValueOnce({ behavior: "allow" })
      .mockResolvedValueOnce({ behavior: "deny", message: "not today" });
    const ask = { do: "ask", tool: "Bash", input: { command: "ls" } };
    const sdk = await fake({ run: [{ match: ".", steps: [ask, ask] }] });
    const msgs = await collect(
      sdk.query({ prompt: prompts("go"), options: { canUseTool } }),
    );
    expect(canUseTool).toHaveBeenCalledTimes(2);
    const [name, input, opts] = canUseTool.mock.calls[0];
    expect([name, input]).toEqual(["Bash", { command: "ls" }]);
    expect(opts.signal).toBeInstanceOf(AbortSignal);
    const toolUse = events(msgs).find((e) => e.kind === "tool_use");
    expect(opts.toolUseID).toBe(toolUse?.id);
    const results = events(msgs).flatMap((e) =>
      e.kind === "tool_result" ? [[e.ok, e.summary]] : [],
    );
    expect(results).toEqual([
      [true, expect.any(String)],
      [false, "not today"],
    ]);
  });

  test("interrupt ends a turn waiting on canUseTool with an error result", async () => {
    let signal: AbortSignal | undefined;
    // Stops the turn while the ask waits on the user.
    const canUseTool: Options["canUseTool"] = (_t, _i, o) => {
      signal = o.signal;
      setTimeout(() => void q.interrupt());
      return new Promise(() => {});
    };
    const sdk = await fake({
      run: [
        {
          match: ".",
          steps: [
            { do: "ask", tool: "Bash", input: {} },
            { do: "say", text: "never said" },
          ],
        },
      ],
    });
    const q = sdk.query({ prompt: prompts("go"), options: { canUseTool } });
    const msgs = await collect(q);
    expect(signal?.aborted).toBe(true);
    expect(msgs.at(-1)).toMatchObject({
      type: "result",
      subtype: "error_during_execution",
    });
    expect(JSON.stringify(msgs)).not.toContain("never said");
  });

  test("with outputFormat it returns the split's tasks as structured output", async () => {
    const tasks = [task("api"), task("ui", ["api"])];
    const sdk = await fake({ split: { tasks } });
    const out = await splitSpec({ query: sdk.query, cwd: dir }, "## Goals");
    expect(out.tasks).toEqual(tasks);
    expect(out.costUsd).toBe(0.01);
  });

  test("resume keeps the session and its transcript, in memory", async () => {
    const sdk = await fake({ run: [sayRule(".", "noted")] });
    const first = await collect(sdk.query({ prompt: prompts("one") }));
    const id = (first[0] as { session_id: string }).session_id;
    const second = await collect(
      sdk.query({ prompt: prompts("two"), options: { resume: id } }),
    );
    expect(second[0]).toMatchObject({ subtype: "init", session_id: id });
    const shown = transcriptFrom(await sdk.getSessionMessages(id)).map((e) => [
      e.kind,
      "text" in e ? e.text : undefined,
    ]);
    expect(shown).toEqual([
      ["user", "one"],
      ["assistant_text", "noted"],
      ["user", "two"],
      ["assistant_text", "noted"],
    ]);
    expect(await sdk.getSessionMessages("unknown")).toEqual([]);
    expect(await sdk.listSessions()).toEqual([]);
    // The CLI refuses a session it does not have.
    await expect(
      collect(sdk.query({ prompt: prompts("x"), options: { resume: "gone" } })),
    ).rejects.toThrow("gone");
  });
});

describe("startServer with BLUEPRINT_FAKE_SDK", () => {
  const run = promisify(execFile);
  const git = (cwd: string, ...args: string[]) => run("git", args, { cwd });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test("a bad scenario stops the server, naming the step", async () => {
    const path = join(dir, "bad.json");
    await writeFile(
      path,
      JSON.stringify({
        plan: [],
        run: [{ match: ".", steps: [{}] }],
        split: { tasks: [] },
      }),
    );
    vi.stubEnv("BLUEPRINT_FAKE_SDK", path);
    await expect(startServer({ root: dir, port: 0 })).rejects.toThrow(
      /run\[0\]\.steps\[0\]/,
    );
  });

  test("the plan session, the split, the runs, and the sessions routes all use the fake", async () => {
    const root = join(dir, "repo");
    await mkdir(root);
    await git(root, "init", "-q");
    await git(root, "config", "user.name", "Test");
    await git(root, "config", "user.email", "test@example.com");
    await git(root, "config", "commit.gpgsign", "false");
    await writeFile(join(root, "README.md"), "hi\n");
    await git(root, "add", ".");
    await git(root, "commit", "-q", "-m", "init");
    const path = join(dir, "scenario.json");
    await writeFile(
      path,
      JSON.stringify({
        plan: [sayRule(".", "Planned.")],
        run: [
          {
            match: ".",
            steps: [
              { do: "write", path: "out.txt", content: "done\n" },
              { do: "say", text: "PR: https://github.com/o/r/pull/7" },
            ],
          },
        ],
        split: { tasks: [task("only")] },
      }),
    );
    vi.stubEnv("BLUEPRINT_FAKE_SDK", path);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const server = await startServer({ root, port: 0 });
    const base = `http://127.0.0.1:${server.port}/api`;
    const post = (url: string, body?: unknown) =>
      fetch(`${base}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const get = async (url: string) => (await fetch(`${base}${url}`)).json();
    try {
      expect(log).toHaveBeenCalledWith(`Using the fake SDK from ${path}`);

      expect((await post("/agent/send", { text: "hello" })).status).toBe(202);
      await vi.waitFor(async () => {
        const state = await get("/agent/state");
        expect(state.status).toBe("idle");
        expect(state.transcript).toContainEqual(
          expect.objectContaining({ kind: "assistant_text", text: "Planned." }),
        );
      });
      const { sessionId } = await get("/agent/state");
      // The real SDK has no such session on disk; the fake keeps it in memory.
      const saved = await fetch(`${base}/sessions/${sessionId}/transcript`);
      expect(saved.status).toBe(200);

      await writeFile(join(root, ".blueprint", "spec.md"), "## Goals\n");
      expect((await post("/agent/split")).status).toBe(202);
      await vi.waitFor(async () => {
        expect(
          (await get("/tasks")).map(
            (t: { task: { slug: string } }) => t.task.slug,
          ),
        ).toEqual(["only"]);
      });

      const launched = await post("/runs", {
        taskSlug: "only",
        permissionMode: "acceptEdits",
      });
      expect(launched.status).toBe(201);
      await vi.waitFor(async () => {
        const [r] = await get("/runs");
        expect(r).toMatchObject({
          status: "done",
          prUrl: "https://github.com/o/r/pull/7",
        });
      });
      const out = join(root, ".blueprint", "worktrees", "only", "out.txt");
      expect(await readFile(out, "utf8")).toBe("done\n");
    } finally {
      await server.close();
    }
  });
});
