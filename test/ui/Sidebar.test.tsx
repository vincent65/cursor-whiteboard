// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "../../src/ui/nav/Sidebar";

test("lists boards and docs, marks the active one, and creates a board from its name field", async () => {
  const user = userEvent.setup();
  const onCreateBoard = vi.fn();
  render(
    <Sidebar
      boards={["main"]}
      docs={["notes"]}
      active={{ kind: "board", name: "main" }}
      onCreateBoard={onCreateBoard}
      onCreateDoc={() => {}}
    />,
  );
  expect(screen.getByRole("link", { name: "main" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.getByRole("link", { name: "notes" })).toHaveAttribute(
    "href",
    "#/docs/notes",
  );
  await user.click(screen.getByRole("button", { name: "New board" }));
  const field = screen.getByRole("textbox", { name: "New board name" });
  expect(field).toHaveFocus();
  await user.type(field, "new-board{Enter}");
  expect(onCreateBoard).toHaveBeenCalledWith("new-board");
  expect(screen.queryByRole("textbox", { name: "New board name" })).toBeNull();
});

test("turns a typed name into a slug, says so inline when none remains, and cancels on Escape", async () => {
  const user = userEvent.setup();
  const onCreateDoc = vi.fn();
  render(
    <Sidebar
      boards={[]}
      docs={[]}
      active={null}
      onCreateBoard={() => {}}
      onCreateDoc={onCreateDoc}
    />,
  );
  expect(screen.getByText("No docs yet")).toBeInTheDocument();
  const create = async (typed: string) => {
    await user.click(screen.getByRole("button", { name: "New doc" }));
    await user.type(
      screen.getByRole("textbox", { name: "New doc name" }),
      typed,
    );
  };
  await create("My Board{Enter}");
  expect(onCreateDoc).toHaveBeenLastCalledWith("my-board");
  await create("  --Q3   Plan: v2!! {Enter}");
  expect(onCreateDoc).toHaveBeenLastCalledWith("q3-plan-v2");

  await create("!!!{Enter}");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Use at least one letter or digit.",
  );
  const field = screen.getByRole("textbox", { name: "New doc name" });
  expect(field).toHaveAttribute("aria-invalid", "true");
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("textbox", { name: "New doc name" })).toBeNull();
  expect(onCreateDoc).toHaveBeenCalledTimes(2);
});

test("a name field the caller opens shows in its list", () => {
  render(
    <Sidebar
      boards={[]}
      docs={[]}
      active={null}
      onCreateBoard={() => {}}
      onCreateDoc={() => {}}
      creating="board"
      onCreatingChange={() => {}}
    />,
  );
  expect(screen.getByRole("textbox", { name: "New board name" })).toHaveFocus();
});

test("folded, the sidebar keeps icon links to the plan pages and can expand", async () => {
  const onCollapsedChange = vi.fn();
  render(
    <Sidebar
      boards={["main"]}
      docs={[]}
      active={{ kind: "spec" }}
      onCreateBoard={() => {}}
      onCreateDoc={() => {}}
      collapsed
      onCollapsedChange={onCollapsedChange}
    />,
  );
  expect(screen.getByRole("link", { name: "Spec" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.queryByRole("link", { name: "main" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Boards" }));
  expect(onCollapsedChange).toHaveBeenCalledWith(false);
});

test("the sidebar shows Spec, Tasks, and Sessions links", () => {
  render(
    <Sidebar
      boards={["main"]}
      docs={[]}
      active={{ kind: "tasks" }}
      onCreateBoard={() => {}}
      onCreateDoc={() => {}}
    />,
  );
  const spec = screen.getByRole("link", { name: "Spec" });
  const tasks = screen.getByRole("link", { name: "Tasks" });
  expect(spec).toHaveAttribute("href", "#/spec");
  expect(spec).not.toHaveAttribute("aria-current");
  expect(tasks).toHaveAttribute("href", "#/tasks");
  expect(tasks).toHaveAttribute("aria-current", "page");
  const sessions = screen.getByRole("link", { name: "Sessions" });
  expect(sessions).toHaveAttribute("href", "#/sessions");
  expect(sessions).not.toHaveAttribute("aria-current");
  expect(screen.getByRole("link", { name: "main" })).not.toHaveAttribute(
    "aria-current",
  );
  // Plan sits above Boards and Docs.
  expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual([
    "Plan",
    "Boards",
    "Docs",
  ]);
});
