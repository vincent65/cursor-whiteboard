// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import type { ServerMessage } from "../../src/shared/messages";
import type { RunView } from "../../src/shared/runs";
import * as api from "../../src/ui/api";
import { SessionsView } from "../../src/ui/sessions/SessionsView";

vi.mock("../../src/ui/api", () => ({
  listRuns: vi.fn(),
  listSessions: vi.fn(async () => []),
  runTranscript: vi.fn(async () => []),
  sessionTranscript: vi.fn(async () => []),
  runMessage: vi.fn(async () => "u9"),
  runStop: vi.fn(async () => {}),
  runResume: vi.fn(async () => {}),
  runDone: vi.fn(async () => {}),
  runPermission: vi.fn(async () => {}),
}));

const handlers = new Set<(m: ServerMessage) => void>();
vi.mock("../../src/ui/server-events", () => ({
  useServerEvent: (h: (m: ServerMessage) => void) => {
    useEffect(() => {
      handlers.add(h);
      return () => {
        handlers.delete(h);
      };
    });
  },
}));
const emit = (m: ServerMessage) =>
  act(() => {
    for (const h of handlers) h(m);
  });

const at = "2026-11-02T00:00:00.000Z";

const run = (
  id: string,
  slug: string,
  startedAt: string,
  title = slug,
): RunView => ({
  id,
  taskSlug: slug,
  title,
  sessionId: `s-${id}`,
  worktree: `/repo/.blueprint/worktrees/${slug}`,
  branch: `blueprint/${slug}`,
  status: "working",
  permissionMode: "acceptEdits",
  prUrl: null,
  markedDone: false,
  failure: null,
  costUsd: 0,
  startedAt,
  endedAt: null,
  pending: [],
  lastText: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  handlers.clear();
});

test("SessionsView routes run.event and run.status to the matching card only", async () => {
  const user = userEvent.setup();
  vi.mocked(api.listRuns).mockResolvedValue([
    run("r1", "auth-api", "2026-11-02T01:00:00.000Z", "Auth API"),
    run("r2", "db-schema", "2026-11-02T02:00:00.000Z"),
  ]);
  vi.mocked(api.runTranscript).mockResolvedValue([
    { kind: "user", id: "u1", text: "Design the schema", at },
  ]);
  render(<SessionsView />);

  expect(
    screen.getByText("Runs share your Claude subscription's rate limits."),
  ).toBeInTheDocument();
  // Newest first; a run whose task file is gone is titled by its slug.
  await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(2));
  const [second, first] = screen.getAllByRole("article");
  expect(second).toHaveAccessibleName("db-schema");
  expect(first).toHaveAccessibleName("auth-api");
  expect(within(first).getByRole("heading")).toHaveTextContent("Auth API");
  expect(within(second).getByRole("heading")).toHaveTextContent("db-schema");

  emit({
    type: "run.event",
    runId: "r1",
    event: {
      kind: "permission",
      id: "p1",
      tool: "Bash",
      summary: "ls",
      canAlways: true,
      at,
    },
  });
  emit({ type: "run.status", runId: "r1", status: "needs_you" });
  expect(within(first).getByRole("status")).toHaveTextContent("Needs you");
  expect(within(second).getByRole("status")).toHaveTextContent("Working");
  expect(within(second).queryByRole("alertdialog")).toBeNull();
  await user.click(within(first).getByRole("button", { name: "Allow once" }));
  expect(api.runPermission).toHaveBeenCalledWith("r1", "p1", {
    behavior: "allow",
  });
  await waitFor(() =>
    expect(within(first).queryByRole("alertdialog")).toBeNull(),
  );

  emit({ type: "run.status", runId: "r1", status: "failed", message: "boom" });
  expect(within(first).getByRole("status")).toHaveTextContent("Failed: boom");
  expect(within(second).getByRole("status")).toHaveTextContent("Working");

  emit({
    type: "run.event",
    runId: "r2",
    event: {
      kind: "assistant_text",
      id: "a1",
      text: "Tables are in.",
      partial: false,
      at,
    },
  });
  expect(within(second).getByText("Tables are in.")).toBeInTheDocument();
  expect(within(first).queryByText("Tables are in.")).toBeNull();

  // The transcript loads on first expand, with live events on top of it.
  expect(api.runTranscript).not.toHaveBeenCalled();
  await user.click(
    within(second).getByRole("button", { name: "Show transcript" }),
  );
  expect(api.runTranscript).toHaveBeenCalledExactlyOnceWith("r2");
  expect(await within(second).findByText("Design the schema")).toBeVisible();
  const texts = within(second)
    .getAllByText(/Design the schema|Tables are in\./)
    .map((el) => el.textContent);
  expect(texts).toEqual([
    "Tables are in.",
    "Design the schema",
    "Tables are in.",
  ]);

  await user.type(
    within(second).getByRole("textbox", { name: "Message db-schema" }),
    "Add an index{Enter}",
  );
  expect(api.runMessage).toHaveBeenCalledWith("r2", "Add an index");
  await user.click(within(second).getByRole("button", { name: "Stop" }));
  expect(api.runStop).toHaveBeenCalledWith("r2");
  emit({ type: "run.status", runId: "r2", status: "idle" });
  await user.click(within(second).getByRole("button", { name: "Mark done" }));
  expect(api.runDone).toHaveBeenCalledWith("r2");

  // runs.changed refetches the list.
  vi.mocked(api.listRuns).mockResolvedValue([
    {
      ...run("r1", "auth-api", "2026-11-02T01:00:00.000Z", "Auth API"),
      status: "done",
      prUrl: "https://github.com/o/r/pull/1",
    },
    run("r2", "db-schema", "2026-11-02T02:00:00.000Z"),
  ]);
  emit({ type: "runs.changed" });
  expect(
    await within(first).findByRole("link", { name: "PR" }),
  ).toHaveAttribute("href", "https://github.com/o/r/pull/1");
  expect(api.listRuns).toHaveBeenCalledTimes(2);
});

test("SessionsView lists other sessions with a read-only transcript, or says there are none", async () => {
  const user = userEvent.setup();
  vi.mocked(api.listRuns).mockResolvedValue([]);
  vi.mocked(api.listSessions).mockResolvedValue([
    {
      sessionId: "o1",
      summary: "Fix the login bug",
      lastModified: Date.now() - 5 * 60_000,
      cwd: "/repo",
      gitBranch: "fix/login",
    },
    {
      sessionId: "o2",
      summary: "Explore the codebase",
      lastModified: Date.now() - 3 * 86_400_000,
      cwd: "/repo",
      gitBranch: null,
    },
  ]);
  vi.mocked(api.sessionTranscript).mockResolvedValue([
    { kind: "user", id: "u1", text: "Why does login fail?", at },
  ]);
  const { unmount } = render(<SessionsView />);

  expect(
    await screen.findByText("No runs yet. Launch one from the tasks view."),
  ).toBeInTheDocument();
  const list = screen.getByRole("region", { name: "Other sessions" });
  const row = await within(list).findByRole("button", {
    name: /Fix the login bug/,
  });
  expect(row).toHaveTextContent("5 minutes ago");
  expect(row).toHaveTextContent("fix/login");
  expect(
    within(list).getByRole("button", { name: /Explore the codebase/ }),
  ).toHaveTextContent("3 days ago");
  expect(api.sessionTranscript).not.toHaveBeenCalled();
  await user.click(row);
  expect(api.sessionTranscript).toHaveBeenCalledExactlyOnceWith("o1");
  expect(await within(list).findByText("Why does login fail?")).toBeVisible();
  expect(within(list).queryByRole("textbox")).toBeNull();
  unmount();

  vi.mocked(api.listSessions).mockResolvedValue([]);
  render(<SessionsView />);
  expect(
    await screen.findByText("No other Claude sessions in this repository."),
  ).toBeInTheDocument();
});

test("SessionsView clears a failed load on the next good one and shows a failed transcript in its card", async () => {
  const user = userEvent.setup();
  vi.mocked(api.listRuns).mockRejectedValueOnce(new Error("runs unreadable"));
  render(<SessionsView />);
  expect(await screen.findByRole("alert")).toHaveTextContent("runs unreadable");

  vi.mocked(api.listRuns).mockResolvedValue([
    run("r1", "auth-api", "2026-11-02T01:00:00.000Z"),
  ]);
  emit({ type: "runs.changed" });
  const card = await screen.findByRole("article", { name: "auth-api" });
  expect(screen.queryByRole("alert")).toBeNull();

  // A transcript that fails to load says so in its own card, not at the top.
  vi.mocked(api.runTranscript).mockRejectedValueOnce(new Error("no session"));
  await user.click(
    within(card).getByRole("button", { name: "Show transcript" }),
  );
  expect(await within(card).findByRole("alert")).toHaveTextContent(
    "no session",
  );
  expect(screen.getAllByRole("alert")).toHaveLength(1);

  // Opening it again retries, and the old failure goes as the retry starts.
  let answer: (events: []) => void = () => {};
  vi.mocked(api.runTranscript).mockReturnValueOnce(
    new Promise((r) => {
      answer = r;
    }),
  );
  await user.click(
    within(card).getByRole("button", { name: "Hide transcript" }),
  );
  await user.click(
    within(card).getByRole("button", { name: "Show transcript" }),
  );
  expect(api.runTranscript).toHaveBeenCalledTimes(2);
  expect(within(card).queryByRole("alert")).toBeNull();
  await act(async () => answer([]));
  expect(within(card).getByText("Nothing yet.")).toBeInTheDocument();
});

test("an other session's transcript retry clears its old failure", async () => {
  const user = userEvent.setup();
  vi.mocked(api.listRuns).mockResolvedValue([]);
  vi.mocked(api.listSessions).mockResolvedValue([
    {
      sessionId: "o1",
      summary: "Fix the login bug",
      lastModified: Date.now(),
      cwd: "/repo",
      gitBranch: null,
    },
  ]);
  vi.mocked(api.sessionTranscript)
    .mockRejectedValueOnce(new Error("session gone"))
    .mockResolvedValueOnce([
      { kind: "user", id: "u1", text: "Why does login fail?", at },
    ]);
  render(<SessionsView />);
  const row = await screen.findByRole("button", { name: /Fix the login bug/ });
  await user.click(row);
  expect(await screen.findByRole("alert")).toHaveTextContent("session gone");
  await user.click(row);
  await user.click(row);
  expect(await screen.findByText("Why does login fail?")).toBeVisible();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("a good runs load keeps the other sessions' failure, and an outdated runs failure is ignored", async () => {
  vi.mocked(api.listSessions).mockRejectedValueOnce(
    new Error("sessions unreadable"),
  );
  let first: (list: RunView[]) => void = () => {};
  vi.mocked(api.listRuns).mockReturnValueOnce(
    new Promise((r) => {
      first = r;
    }),
  );
  render(<SessionsView />);
  const others = screen.getByRole("region", { name: "Other sessions" });
  expect(await within(others).findByRole("alert")).toHaveTextContent(
    "sessions unreadable",
  );

  // The runs arrive after the sessions failed; that failure stays.
  await act(async () => first([]));
  expect(
    await screen.findByText("No runs yet. Launch one from the tasks view."),
  ).toBeInTheDocument();
  expect(within(others).getByRole("alert")).toHaveTextContent(
    "sessions unreadable",
  );

  // An older load that fails after a newer one landed says nothing.
  let older: (err: Error) => void = () => {};
  vi.mocked(api.listRuns)
    .mockReturnValueOnce(
      new Promise((_, reject) => {
        older = reject;
      }),
    )
    .mockResolvedValueOnce([]);
  emit({ type: "runs.changed" });
  emit({ type: "runs.changed" });
  await act(async () => older(new Error("stale failure")));
  expect(screen.queryByText("stale failure")).toBeNull();
  expect(screen.getAllByRole("alert")).toHaveLength(1);
});

test("an other session's transcript reloads on runs.changed: at once when open, on next open when closed", async () => {
  const user = userEvent.setup();
  vi.mocked(api.listRuns).mockResolvedValue([]);
  vi.mocked(api.listSessions).mockResolvedValue([
    {
      sessionId: "o1",
      summary: "Fix the login bug",
      lastModified: Date.now(),
      cwd: "/repo",
      gitBranch: null,
    },
  ]);
  vi.mocked(api.sessionTranscript).mockResolvedValueOnce([
    { kind: "user", id: "u1", text: "Why does login fail?", at },
  ]);
  render(<SessionsView />);
  const row = await screen.findByRole("button", { name: /Fix the login bug/ });
  await user.click(row);
  expect(await screen.findByText("Why does login fail?")).toBeVisible();

  vi.mocked(api.sessionTranscript).mockResolvedValueOnce([
    { kind: "user", id: "u1", text: "Why does login fail?", at },
    { kind: "user", id: "u2", text: "And the logout?", at },
  ]);
  emit({ type: "runs.changed" });
  expect(await screen.findByText("And the logout?")).toBeVisible();
  expect(api.sessionTranscript).toHaveBeenCalledTimes(2);

  await user.click(row);
  emit({ type: "runs.changed" });
  expect(api.sessionTranscript).toHaveBeenCalledTimes(2);
  vi.mocked(api.sessionTranscript).mockResolvedValueOnce([
    { kind: "user", id: "u3", text: "Fixed?", at },
  ]);
  await user.click(row);
  expect(await screen.findByText("Fixed?")).toBeVisible();
  expect(api.sessionTranscript).toHaveBeenCalledTimes(3);
});
