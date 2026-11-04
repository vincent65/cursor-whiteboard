// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProposalsBar } from "../../src/ui/board/ProposalsBar";

const items = [
  {
    id: "p_1",
    title: "Login flow",
    counts: { added: 2, updated: 0, deleted: 0 },
    busy: false,
  },
  {
    id: "p_2",
    title: null,
    counts: { added: 0, updated: 1, deleted: 1 },
    busy: false,
  },
];

test("renders a row per proposal with counts and wires the buttons", async () => {
  const onDecide = vi.fn();
  const onRefine = vi.fn();
  render(
    <ProposalsBar items={items} onDecide={onDecide} onRefine={onRefine} />,
  );

  // Each row is a group named in full; it shows the name and counts apart.
  const first = screen.getByRole("group", {
    name: "Claude proposed Login flow · 2 added",
  });
  const second = screen.getByRole("group", {
    name: "Claude proposed changes · 1 changed, 1 removed",
  });
  expect(first).toHaveTextContent("Login flow2 added");
  expect(second).toHaveTextContent("Changes1 changed, 1 removed");
  const row = (el: HTMLElement) => within(el);

  await userEvent.click(row(first).getByRole("button", { name: "Accept" }));
  expect(onDecide).toHaveBeenLastCalledWith("p_1", "accepted");
  await userEvent.click(row(second).getByRole("button", { name: "Reject" }));
  expect(onDecide).toHaveBeenLastCalledWith("p_2", "rejected");
  await userEvent.click(row(second).getByRole("button", { name: "Refine" }));
  expect(onRefine).toHaveBeenCalledWith("p_2");
  expect(onDecide).toHaveBeenCalledTimes(2);
});

test("a row whose decision is in flight disables its buttons", () => {
  render(
    <ProposalsBar
      items={[{ ...items[0], busy: true }, items[1]]}
      onDecide={vi.fn()}
      onRefine={vi.fn()}
    />,
  );
  const row = (name: string) => within(screen.getByRole("group", { name }));
  const busy = row("Claude proposed Login flow · 2 added");
  const idle = row("Claude proposed changes · 1 changed, 1 removed");
  for (const name of ["Accept", "Reject", "Refine"]) {
    expect(busy.getByRole("button", { name })).toBeDisabled();
    expect(idle.getByRole("button", { name })).toBeEnabled();
  }
});

test("renders nothing without proposals", () => {
  const { container } = render(
    <ProposalsBar items={[]} onDecide={vi.fn()} onRefine={vi.fn()} />,
  );
  expect(container).toBeEmptyDOMElement();
});

test("the bar centers in the board area right of the inset it is given", () => {
  const { rerender } = render(
    <ProposalsBar items={items} onDecide={vi.fn()} onRefine={vi.fn()} />,
  );
  const bar = () =>
    screen
      .getByRole("group", { name: "Claude proposed Login flow · 2 added" })
      .closest(".proposals-bar") as HTMLElement;
  expect(bar().style.getPropertyValue("--bar-inset")).toBe("0px");
  rerender(
    <ProposalsBar
      items={items}
      inset={232}
      onDecide={vi.fn()}
      onRefine={vi.fn()}
    />,
  );
  expect(bar().style.getPropertyValue("--bar-inset")).toBe("232px");
});
