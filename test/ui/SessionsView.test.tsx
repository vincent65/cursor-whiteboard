// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import type { RunView } from "../../src/server/runs/manager";
import type { ServerMessage } from "../../src/shared/messages";
import * as api from "../../src/ui/api";
import { SessionsView } from "../../src/ui/sessions/SessionsView";

vi.mock("../../src/ui/api", () => ({
  listRuns: vi.fn(),
  listTasks: vi.fn(async () => []),
  listSessions: vi.fn(async () => []),
  runTranscript: vi.fn(async () => []),
  sessionTranscript: vi.fn(async () => []),
  runMessage: vi.fn(async () => "u9"),
  runStop: vi.fn(async () => {}),
  runResume: vi.fn(async () => {}),
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

const run = (id: string, slug: string, startedAt: string): RunView => ({
  id,
  taskSlug: slug,
  sessionId: `s-${id}`,
  worktree: `/repo/.blueprint/worktrees/${slug}`,
  branch: `blueprint/${slug}`,
  status: "working",
  permissionMode: "acceptEdits",
  prUrl: null,
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
    run("r1", "auth-api", "2026-11-02T01:00:00.000Z"),
    run("r2", "db-schema", "2026-11-02T02:00:00.000Z"),
  ]);
  vi.mocked(api.listTasks).mockResolvedValue([
    {
      file: "01-auth-api.md",
      task: {
        slug: "auth-api",
        title: "Auth API",
        body: "",
        dependsOn: [],
        files: [],
        acceptance: [],
        sources: [],
      },
    },
  ]);
  vi.mocked(api.runTranscript).mockResolvedValue([
    { kind: "user", id: "u1", text: "Design the schema", at },
  ]);
  render(<SessionsView />);

  expect(
    screen.getByText("Runs share your Claude subscription's rate limits."),
  ).toBeInTheDocument();
  // Newest first; the title comes from the task file when there is one.
  await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(2));
  const [second, first] = screen.getAllByRole("article");
  expect(second).toHaveAccessibleName("db-schema");
  expect(first).toHaveAccessibleName("auth-api");
  expect(within(first).getByRole("heading")).toHaveTextContent("Auth API");
  expect(within(second).getByRole("heading")).toHaveTextContent("db-schema");

  emit({
    type: "run.event",
    runId: "r1",
    event: { kind: "permission", id: "p1", tool: "Bash", summary: "ls", at },
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

  // runs.changed refetches the list.
  vi.mocked(api.listRuns).mockResolvedValue([
    {
      ...run("r1", "auth-api", "2026-11-02T01:00:00.000Z"),
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
