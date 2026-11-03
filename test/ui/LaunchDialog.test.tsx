// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LaunchDialog } from "../../src/ui/plan/LaunchDialog";

const blocked = {
  ok: false,
  missing: [
    { slug: "db", reason: "no run" as const },
    { slug: "config", reason: "not done" as const },
    { slug: "cache", reason: "not merged" as const },
  ],
};

test("LaunchDialog explains missing dependencies and needs the override to launch", async () => {
  const user = userEvent.setup();
  const onLaunch = vi.fn(async () => {});
  const onClose = vi.fn();
  render(
    <LaunchDialog
      slug="auth"
      title="Build auth"
      gate={blocked}
      onLaunch={onLaunch}
      onClose={onClose}
    />,
  );

  const dialog = screen.getByRole("dialog", { name: "Launch Build auth" });
  expect(dialog).toHaveTextContent("blueprint/auth");
  expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
    "db: no run",
    "config: run not done",
    "cache: branch not merged into HEAD",
  ]);
  const mode = screen.getByRole("combobox", { name: "Permission mode" });
  expect(mode).toHaveValue("acceptEdits");
  expect(mode).toHaveFocus();

  const launch = screen.getByRole("button", { name: "Launch" });
  expect(launch).toBeDisabled();
  await user.click(screen.getByRole("checkbox", { name: "Launch anyway" }));
  expect(launch).toBeEnabled();

  await user.selectOptions(mode, "default");
  expect(dialog).toHaveTextContent("Asks before every edit and command.");
  await user.click(launch);
  expect(onLaunch).toHaveBeenCalledWith("default", true);
  expect(onClose).not.toHaveBeenCalled();
});

test("LaunchDialog launches a ready task without the override and shows a failed launch", async () => {
  const user = userEvent.setup();
  const onLaunch = vi.fn(async () => {
    throw new Error("worktree already exists");
  });
  render(
    <LaunchDialog
      slug="db"
      title="Build db"
      gate={{ ok: true, missing: [] }}
      onLaunch={onLaunch}
      onClose={() => {}}
    />,
  );

  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.queryByRole("listitem")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Launch" }));
  expect(onLaunch).toHaveBeenCalledWith("acceptEdits", false);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "worktree already exists",
  );
  expect(screen.getByRole("button", { name: "Launch" })).toBeEnabled();
});

test("LaunchDialog closes on Cancel and on Escape, but not on Escape in the select", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <LaunchDialog
      slug="db"
      title="Build db"
      gate={{ ok: true, missing: [] }}
      onLaunch={async () => {}}
      onClose={onClose}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(2);
  // Escape in the select closes its list of options, not the dialog.
  await user.click(screen.getByRole("combobox", { name: "Permission mode" }));
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(2);
});
