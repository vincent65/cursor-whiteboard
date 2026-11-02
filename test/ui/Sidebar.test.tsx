// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "../../src/ui/nav/Sidebar";

test("lists boards and docs, marks the active one, and creates a board from a prompt", async () => {
  vi.spyOn(window, "prompt").mockReturnValue("new-board");
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
  await userEvent.click(screen.getByRole("button", { name: "New board" }));
  expect(onCreateBoard).toHaveBeenCalledWith("new-board");
});

test("turns a typed name into a slug and alerts only when none remains", async () => {
  const prompt = vi.spyOn(window, "prompt");
  const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
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
  const create = () =>
    userEvent.click(screen.getByRole("button", { name: "New doc" }));
  prompt.mockReturnValue("My Board");
  await create();
  expect(onCreateDoc).toHaveBeenLastCalledWith("my-board");
  prompt.mockReturnValue("  --Q3   Plan: v2!! ");
  await create();
  expect(onCreateDoc).toHaveBeenLastCalledWith("q3-plan-v2");
  expect(alert).not.toHaveBeenCalled();
  prompt.mockReturnValue("!!!");
  await create();
  expect(alert).toHaveBeenCalledOnce();
  prompt.mockReturnValue(null);
  await create();
  expect(onCreateDoc).toHaveBeenCalledTimes(2);
  expect(alert).toHaveBeenCalledOnce();
});
