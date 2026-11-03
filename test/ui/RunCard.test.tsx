// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PanelEvent } from "../../src/shared/panel";
import type { RunView } from "../../src/shared/runs";
import { RunCard } from "../../src/ui/sessions/RunCard";

const at = "2026-11-02T00:00:00.000Z";

const run = (over: Partial<RunView> = {}): RunView => ({
  id: "r1",
  taskSlug: "auth-api",
  title: "Auth API",
  sessionId: "s1",
  worktree: "/repo/.blueprint/worktrees/auth-api",
  branch: "blueprint/auth-api",
  status: "working",
  permissionMode: "acceptEdits",
  prUrl: null,
  markedDone: false,
  failure: null,
  costUsd: 0.5,
  startedAt: at,
  endedAt: null,
  pending: [],
  lastText: "Wrote the login handler.",
  ...over,
});

const handlers = () => ({
  onMessage: vi.fn(async () => {}),
  onStop: vi.fn(async () => {}),
  onResume: vi.fn(async () => {}),
  onDone: vi.fn(async () => {}),
  onPermission: vi.fn(async () => {}),
  onExpand: vi.fn(),
});

const transcript: PanelEvent[] = [
  { kind: "user", id: "u1", text: "Build the auth API", at },
  {
    kind: "assistant_text",
    id: "a1",
    text: "Starting on the routes.",
    partial: false,
    at,
  },
  {
    kind: "result",
    id: "res1",
    subtype: "success",
    costUsd: 0.25,
    durationMs: 1000,
    at,
  },
];

test("RunCard shows status, cost, PR link, and the right buttons per status", async () => {
  const user = userEvent.setup();
  const h = handlers();
  const { rerender } = render(
    <RunCard run={run()} transcript={transcript} {...h} />,
  );
  expect(screen.getByRole("heading", { name: "Auth API" })).toBeInTheDocument();
  expect(screen.getByText("auth-api")).toBeInTheDocument();
  expect(screen.getByText("blueprint/auth-api")).toBeInTheDocument();
  expect(screen.getByText("$0.5000 total")).toBeInTheDocument();
  expect(screen.getByText("Wrote the login handler.")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "PR" })).toBeNull();

  const status = () => screen.getByRole("status").textContent;
  const button = (name: string) => screen.queryByRole("button", { name });
  const cases: [Partial<RunView>, string, boolean, boolean, boolean][] = [
    [{ status: "working" }, "Working", true, false, false],
    [{ status: "needs_you" }, "Needs you", true, false, false],
    [{ status: "idle" }, "Idle", false, false, true],
    [{ status: "done" }, "Done", false, false, false],
    [{ status: "failed" }, "Failed", false, false, false],
    [{ status: "interrupted" }, "Interrupted", false, true, false],
  ];
  for (const [over, label, stop, resume, markDone] of cases) {
    rerender(<RunCard run={run(over)} transcript={transcript} {...h} />);
    expect(status()).toBe(label);
    expect(button("Stop") !== null).toBe(stop);
    expect(button("Resume") !== null).toBe(resume);
    expect(button("Mark done") !== null).toBe(markDone);
  }
  rerender(
    <RunCard
      run={run({ status: "failed", failure: "rate limited" })}
      transcript={transcript}
      {...h}
    />,
  );
  expect(status()).toBe("Failed: rate limited");

  rerender(
    <RunCard
      run={run({ status: "done", prUrl: "https://github.com/o/r/pull/7" })}
      transcript={transcript}
      {...h}
    />,
  );
  expect(screen.getByRole("link", { name: "PR" })).toHaveAttribute(
    "href",
    "https://github.com/o/r/pull/7",
  );

  rerender(
    <RunCard
      run={run({ status: "interrupted" })}
      transcript={transcript}
      {...h}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Resume" }));
  expect(h.onResume).toHaveBeenCalledOnce();
  // An idle run the user merged by hand can be marked done.
  rerender(
    <RunCard run={run({ status: "idle" })} transcript={transcript} {...h} />,
  );
  await user.click(screen.getByRole("button", { name: "Mark done" }));
  expect(h.onDone).toHaveBeenCalledOnce();
  rerender(<RunCard run={run()} transcript={transcript} {...h} />);
  await user.click(screen.getByRole("button", { name: "Stop" }));
  expect(h.onStop).toHaveBeenCalledOnce();

  await user.click(screen.getByRole("button", { name: "Copy resume command" }));
  expect(await navigator.clipboard.readText()).toBe(
    "cd /repo/.blueprint/worktrees/auth-api && claude --resume s1",
  );
  expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();

  // A worktree path with a space is quoted so the command still runs.
  rerender(
    <RunCard
      run={run({ worktree: "/My Repo/.blueprint/worktrees/auth-api" })}
      transcript={transcript}
      {...h}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Copied" }));
  expect(await navigator.clipboard.readText()).toBe(
    "cd '/My Repo/.blueprint/worktrees/auth-api' && claude --resume s1",
  );

  // The transcript is collapsed until asked for.
  expect(screen.queryByText("Build the auth API")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Show transcript" }));
  expect(h.onExpand).toHaveBeenCalledOnce();
  expect(screen.getByText("Build the auth API")).toBeInTheDocument();
  expect(screen.getByText("Starting on the routes.")).toBeInTheDocument();
  // A turn's end, not to be confused with the run's Done status.
  expect(screen.getByText("Turn done · $0.2500 total")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Hide transcript" }));
  expect(screen.queryByText("Build the auth API")).toBeNull();
});

test("RunCard's message box sends and the permission dialog answers with the run id", async () => {
  const user = userEvent.setup();
  const h = handlers();
  render(
    <RunCard
      run={run({
        status: "needs_you",
        pending: [
          {
            id: "p1",
            tool: "Bash",
            summary: "npm test",
            canAlways: false,
            at,
          },
          {
            id: "p2",
            tool: "Write",
            summary: "src/a.ts",
            canAlways: true,
            at,
          },
        ],
      })}
      transcript={[]}
      {...h}
    />,
  );
  // Only the oldest ask is shown.
  const dialog = screen.getByRole("alertdialog");
  expect(dialog).toHaveTextContent("Allow Bash: npm test");
  expect(screen.queryByText("src/a.ts")).toBeNull();
  // The SDK suggested no rule for this ask, so only once or deny.
  expect(screen.queryByRole("button", { name: /always|session/ })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Allow once" }));
  expect(h.onPermission).toHaveBeenCalledWith("p1", { behavior: "allow" });

  const box = screen.getByRole("textbox", { name: "Message auth-api" });
  await user.type(box, "Also add tests{Shift>}{Enter}{/Shift}please");
  expect(h.onMessage).not.toHaveBeenCalled();
  await user.type(box, "{Enter}");
  expect(h.onMessage).toHaveBeenCalledWith("Also add tests\nplease");
  expect(box).toHaveValue("");

  // A failed send puts the words back and says why.
  h.onMessage.mockRejectedValueOnce(new Error("run r1 not found"));
  await user.type(box, "again{Enter}");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "run r1 not found",
  );
  expect(box).toHaveValue("again");
});

test("RunCard's Stop reads Stopping… until the run leaves working and needs_you", async () => {
  const user = userEvent.setup();
  const h = handlers();
  const { rerender } = render(<RunCard run={run()} transcript={[]} {...h} />);
  await user.click(screen.getByRole("button", { name: "Stop" }));
  const stopping = screen.getByRole("button", { name: "Stopping…" });
  expect(stopping).toBeDisabled();

  rerender(
    <RunCard run={run({ status: "needs_you" })} transcript={[]} {...h} />,
  );
  expect(screen.getByRole("button", { name: "Stopping…" })).toBeDisabled();
  rerender(<RunCard run={run({ status: "idle" })} transcript={[]} {...h} />);
  expect(screen.queryByRole("button", { name: /Stop/ })).toBeNull();
  // A later turn gets a fresh Stop.
  rerender(<RunCard run={run()} transcript={[]} {...h} />);
  expect(screen.getByRole("button", { name: "Stop" })).toBeEnabled();
});

test("RunCard's transcript renders citations as chips", async () => {
  const user = userEvent.setup();
  render(
    <RunCard
      run={run()}
      transcript={[
        {
          kind: "assistant_text",
          id: "a1",
          text: "Done, as [[board:main#login]] asks.",
          partial: false,
          at,
        },
      ]}
      {...handlers()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Show transcript" }));
  expect(screen.getByRole("link", { name: "main#login" })).toHaveAttribute(
    "href",
    "#/boards/main?focus=login",
  );
});

test("RunCard's preview keeps the reply's line breaks, without blank lines", () => {
  const { container } = render(
    <RunCard
      run={run({
        lastText:
          "Added src/login.ts.\nhttps://github.com/o/r/pull/1\n\n  \nThe check is a stub.",
      })}
      transcript={[]}
      {...handlers()}
    />,
  );
  expect(container.querySelector(".run-last")?.textContent).toBe(
    "Added src/login.ts.\nhttps://github.com/o/r/pull/1\nThe check is a stub.",
  );
});

test("RunCard renders inline code in its title and preview, not backticks", () => {
  const { container } = render(
    <RunCard
      run={run({
        title: "`notes add` command",
        lastText: "Committed on `blueprint/add` as **1440336**.",
      })}
      transcript={[]}
      {...handlers()}
    />,
  );
  const title = screen.getByRole("heading", { name: "notes add command" });
  expect(title.querySelector("code")).toHaveTextContent("notes add");
  const last = container.querySelector(".run-last");
  expect(last?.textContent).toBe("Committed on blueprint/add as 1440336.");
  expect(last?.querySelector("code")).toHaveTextContent("blueprint/add");
  expect(last?.querySelector("strong")).toHaveTextContent("1440336");
});
