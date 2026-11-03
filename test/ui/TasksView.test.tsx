// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import type { ServerMessage } from "../../src/shared/messages";
import type { TaskFile } from "../../src/shared/tasks";
import * as api from "../../src/ui/api";
import { TasksView, useSplitCost } from "../../src/ui/plan/TasksView";

vi.mock("../../src/ui/api", () => ({ listTasks: vi.fn() }));

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

beforeEach(() => {
  vi.resetAllMocks();
  handlers.clear();
});

test("TasksView renders cards with dependencies and source links, and the empty state", async () => {
  vi.mocked(api.listTasks).mockResolvedValueOnce([]);
  render(<TasksView cost={null} />);
  expect(
    await screen.findByText("No tasks yet. Split the spec first."),
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
  expect(c.getByRole("link", { name: "[[board:main#a1]]" })).toHaveAttribute(
    "href",
    "#/boards/main?focus=a1",
  );
  expect(
    c.getByRole("link", { name: "[[doc:notes.md#caching]]" }),
  ).toHaveAttribute("href", "#/docs/notes?focus=caching");

  const first = (await screen.findByText("01-db.md")).closest("article");
  expect(first && within(first).queryByText(/Depends on/)).toBeNull();
  expect(screen.queryByText(/No tasks yet/)).toBeNull();
});

test("the split cost shows even when the split finished on another route", async () => {
  vi.mocked(api.listTasks).mockResolvedValue(files);
  const { rerender } = render(<Shell open={false} />);
  await emit({ type: "split.status", state: "done", costUsd: 0.4213 });

  rerender(<Shell open />);
  expect(await screen.findByText("Split cost $0.4213")).toBeInTheDocument();
});

test("TasksView reloads when a task file changes on disk", async () => {
  vi.mocked(api.listTasks).mockResolvedValueOnce([]);
  render(<TasksView cost={null} />);
  await screen.findByText("No tasks yet. Split the spec first.");

  vi.mocked(api.listTasks).mockResolvedValueOnce(files);
  await emit({ type: "file-changed", kind: "task", name: "01-db" });
  expect(await screen.findByText("01-db.md")).toBeInTheDocument();
});

test("TasksView shows a split error until the next split", async () => {
  vi.mocked(api.listTasks).mockResolvedValue([]);
  render(<TasksView cost={null} />);
  await screen.findByText("No tasks yet. Split the spec first.");

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
  expect(
    screen.getAllByRole("link", { name: "[[board:main#a1]]" }),
  ).toHaveLength(2);
  expect(error).not.toHaveBeenCalled();
  error.mockRestore();
});
