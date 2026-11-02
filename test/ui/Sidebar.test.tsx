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
