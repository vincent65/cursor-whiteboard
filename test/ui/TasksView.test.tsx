// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import type { ServerMessage } from "../../src/shared/messages";
import type { RunView } from "../../src/shared/runs";
import type { TaskFile } from "../../src/shared/tasks";
import * as api from "../../src/ui/api";
import { TasksView, useSplitCost } from "../../src/ui/plan/TasksView";

vi.mock("../../src/ui/api", () => ({
  getSpec: vi.fn(),
  listTasks: vi.fn(),
  listRuns: vi.fn(),
  gate: vi.fn(),
  launchRun: vi.fn(),
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

const task = (slug: string, over: Partial<TaskFile["task"]> = {}) => ({
  slug,
  title: `Build ${slug}`,
  body: "",
  dependsOn: [],
  files: [],
  acceptance: [],
  sources: [],
  ...over,
});

const files: TaskFile[] = [
  { file: "01-db.md", task: task("db") },
  {
    file: "02-auth.md",
    task: task("auth", {
      dependsOn: ["db", "config"],
      acceptance: ["Login works", "Logout works"],
      sources: ["[[board:main#a1]]", "[[doc:notes.md#caching]]"],
    }),
  },
];

// Like App: keeps the split cost while another route is open.
function Shell({ open }: { open: boolean }) {
  const cost = useSplitCost();
  return open ? <TasksView cost={cost} /> : null;
}

const run = (taskSlug: string): RunView => ({
  id: `r-${taskSlug}`,
  taskSlug,
  title: `Build ${taskSlug}`,
  sessionId: "s1",
  worktree: `/repo/.blueprint/worktrees/${taskSlug}`,
  branch: `blueprint/${taskSlug}`,
  status: "done",
  permissionMode: "acceptEdits",
  prUrl: null,
  markedDone: false,
  failure: null,
  costUsd: 0,
  startedAt: "2026-11-02T00:00:00.000Z",
  endedAt: null,
  pending: [],
  lastText: null,
});

const card = async (file: string) => {
  const article = (await screen.findByText(file)).closest("article");
  if (!article) throw new Error("no card");
  return within(article);
};

beforeEach(() => {
  vi.resetAllMocks();
  handlers.clear();
  vi.mocked(api.listRuns).mockResolvedValue([]);
  vi.mocked(api.getSpec).mockResolvedValue({
    text: "",
    dropped: [],
    labels: { "board:main#a1": "Login" },
  });
  location.hash = "#/tasks";
});

test("TasksView renders cards with dependencies and source links, and the empty state", async () => {
  vi.mocked(api.listTasks).mockResolvedValueOnce([]);
  render(<TasksView cost={null} />);
  expect(
    await screen.findByRole("region", { name: "No tasks yet" }),
  ).toBeInTheDocument();

  vi.mocked(api.listTasks).mockResolvedValueOnce(files);
  await emit({ type: "split.status", state: "done", costUsd: 0.4213 });

  const card = (await screen.findByText("02-auth.md")).closest("article");
  if (!card) throw new Error("no card");
  const c = within(card);
  expect(c.getByRole("heading", { name: "Build auth" })).toBeInTheDocument();
  expect(c.getByText("Depends on: db, config")).toBeInTheDocument();
  expect(c.getAllByRole("listitem").map((li) => li.textContent)).toEqual(
    expect.arrayContaining(["Login works", "Logout works"]),
  );
  // A source chip shows its shape's label, and falls back to the id without one.
  expect(c.getByRole("link", { name: "Login" })).toHaveAttribute(
    "href",
    "#/boards/main?focus=a1",
  );
  expect(c.getByRole("link", { name: "notes.md#caching" })).toHaveAttribute(
    "href",
    "#/docs/notes?focus=caching",
  );

  const first = (await screen.findByText("01-db.md")).closest("article");
  expect(first && within(first).queryByText(/Depends on/)).toBeNull();
  expect(screen.queryByText(/No tasks yet/)).toBeNull();
});

test("the split cost shows even when the split finished on another route", async () => {
  vi.mocked(api.listTasks).mockResolvedValue(files);
  const { rerender } = render(<Shell open={false} />);
  await emit({ type: "split.status", state: "done", costUsd: 0.4213 });

  rerender(<Shell open />);
  expect(await screen.findByText("Splitting cost $0.42")).toBeInTheDocument();
});

test("TasksView reloads when a task file changes on disk", async () => {
  vi.mocked(api.listTasks).mockResolvedValueOnce([]);
  render(<TasksView cost={null} />);
  await screen.findByRole("region", { name: "No tasks yet" });

  vi.mocked(api.listTasks).mockResolvedValueOnce(files);
  await emit({ type: "file-changed", kind: "task", name: "01-db" });
  expect(await screen.findByText("01-db.md")).toBeInTheDocument();
});

test("TasksView shows a split error until the next split", async () => {
  vi.mocked(api.listTasks).mockResolvedValue([]);
  render(<TasksView cost={null} />);
  await screen.findByRole("region", { name: "No tasks yet" });

  await emit({ type: "split.status", state: "error", message: "boom" });
  expect(screen.getByRole("alert")).toHaveTextContent("boom");
  await emit({ type: "split.status", state: "running" });
  expect(screen.queryByRole("alert")).toBeNull();
});

test("a repeated acceptance line or source renders each time without a key warning", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(api.listTasks).mockResolvedValueOnce([
    {
      file: "01-db.md",
      task: task("db", {
        acceptance: ["It works", "It works"],
        sources: ["[[board:main#a1]]", "[[board:main#a1]]"],
      }),
    },
  ]);
  render(<TasksView cost={null} />);

  expect(await screen.findAllByText("It works")).toHaveLength(2);
  expect(await screen.findAllByRole("link", { name: "Login" })).toHaveLength(2);
  expect(error).not.toHaveBeenCalled();
  error.mockRestore();
});

test("TasksView opens the dialog and launches with the chosen mode", async () => {
  const user = userEvent.setup();
  vi.mocked(api.listTasks).mockResolvedValue(files);
  vi.mocked(api.gate).mockResolvedValue({
    ok: false,
    branch: "blueprint/auth",
    missing: [{ slug: "db", reason: "no run" }],
  });
  vi.mocked(api.launchRun).mockResolvedValue(run("auth"));
  render(<TasksView cost={null} />);

  await user.click(
    (await card("02-auth.md")).getByRole("button", { name: "Launch" }),
  );
  expect(api.gate).toHaveBeenCalledWith("auth");
  const dialog = await screen.findByRole("dialog", {
    name: "Launch Build auth",
  });
  const d = within(dialog);
  expect(d.getByText("db: no run")).toBeInTheDocument();

  await user.selectOptions(d.getByRole("combobox"), "bypassPermissions");
  await user.click(d.getByRole("checkbox", { name: "Launch anyway" }));
  await user.click(d.getByRole("button", { name: "Launch" }));
  expect(api.launchRun).toHaveBeenCalledWith({
    taskSlug: "auth",
    permissionMode: "bypassPermissions",
    override: true,
  });
  expect(location.hash).toBe("#/sessions");
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("a task that already has a run links to the sessions view instead of launching", async () => {
  vi.mocked(api.listTasks).mockResolvedValue(files);
  vi.mocked(api.listRuns).mockResolvedValueOnce([run("db")]);
  render(<TasksView cost={null} />);

  const db = await card("01-db.md");
  expect(await db.findByRole("link", { name: "View run" })).toHaveAttribute(
    "href",
    "#/sessions",
  );
  expect(db.queryByRole("button", { name: "Launch" })).toBeNull();
  const auth = await card("02-auth.md");
  expect(auth.getByRole("button", { name: "Launch" })).toBeInTheDocument();

  vi.mocked(api.listRuns).mockResolvedValueOnce([run("db"), run("auth")]);
  await emit({ type: "runs.changed" });
  expect(
    await auth.findByRole("link", { name: "View run" }),
  ).toBeInTheDocument();
});

test("a failed gate check shows as an error and opens no dialog", async () => {
  const user = userEvent.setup();
  vi.mocked(api.listTasks).mockResolvedValue(files);
  vi.mocked(api.gate).mockRejectedValue(new Error("unknown task"));
  render(<TasksView cost={null} />);

  await user.click(
    (await card("01-db.md")).getByRole("button", { name: "Launch" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("unknown task");
  expect(screen.queryByRole("dialog")).toBeNull();

  // The next check that opens the dialog clears the old failure.
  vi.mocked(api.gate).mockResolvedValue({
    ok: true,
    branch: "blueprint/db",
    missing: [],
  });
  await user.click(
    (await card("01-db.md")).getByRole("button", { name: "Launch" }),
  );
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("closing the launch dialog returns focus to the card's Launch button", async () => {
  const user = userEvent.setup();
  vi.mocked(api.listTasks).mockResolvedValue(files);
  vi.mocked(api.gate).mockResolvedValue({
    ok: true,
    branch: "blueprint/db",
    missing: [],
  });
  render(<TasksView cost={null} />);
  const db = await card("01-db.md");

  await user.click(db.getByRole("button", { name: "Launch" }));
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Cancel",
    }),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(db.getByRole("button", { name: "Launch" })).toHaveFocus();

  // Escape from the dialog's buttons does the same.
  await user.click(db.getByRole("button", { name: "Launch" }));
  within(await screen.findByRole("dialog"))
    .getByRole("button", { name: "Cancel" })
    .focus();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(db.getByRole("button", { name: "Launch" })).toHaveFocus();
});

test("an open launch dialog checks its gate again on runs.changed", async () => {
  const user = userEvent.setup();
  vi.mocked(api.listTasks).mockResolvedValue(files);
  vi.mocked(api.gate).mockResolvedValueOnce({
    ok: false,
    branch: "blueprint/auth",
    missing: [{ slug: "db", reason: "not done" }],
  });
  render(<TasksView cost={null} />);
  await user.click(
    (await card("02-auth.md")).getByRole("button", { name: "Launch" }),
  );
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("db: run not done")).toBeInTheDocument();

  vi.mocked(api.gate).mockResolvedValueOnce({
    ok: true,
    branch: "blueprint/auth",
    missing: [],
  });
  await emit({ type: "runs.changed" });
  await waitFor(() =>
    expect(within(dialog).queryByText("db: run not done")).toBeNull(),
  );
  expect(api.gate).toHaveBeenCalledTimes(2);
  expect(within(dialog).getByRole("button", { name: "Launch" })).toBeEnabled();
});

// Claude writes titles and checks in Markdown; a card shows code, not backticks.
test("a task card renders inline code in its title and acceptance checks", async () => {
  vi.mocked(api.listTasks).mockResolvedValue([
    {
      file: "01-add.md",
      task: task("add", {
        title: "`notes add <text>` command",
        acceptance: ["`notes add a` exits 0"],
      }),
    },
  ]);
  vi.mocked(api.listRuns).mockResolvedValue([]);
  render(<TasksView cost={null} />);
  const title = await screen.findByRole("heading", {
    name: "notes add <text> command",
  });
  expect(title.querySelector("code")).toHaveTextContent("notes add <text>");
  expect(screen.getByRole("listitem").querySelector("code")).toHaveTextContent(
    "notes add a",
  );
});
