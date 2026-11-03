// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProposalsBar } from "../../src/ui/board/ProposalsBar";

const items = [
  {
    id: "p_1",
    title: "Login flow",
    counts: { added: 2, updated: 0, deleted: 0 },
  },
  { id: "p_2", title: null, counts: { added: 0, updated: 1, deleted: 1 } },
];

test("renders a row per proposal with counts and wires the buttons", async () => {
  const onDecide = vi.fn();
  const onRefine = vi.fn();
  render(
    <ProposalsBar items={items} onDecide={onDecide} onRefine={onRefine} />,
  );

  const first = screen.getByText("Claude proposed Login flow · 2 added");
  const second = screen.getByText(
    "Claude proposed changes · 1 changed, 1 removed",
  );
  const row = (el: HTMLElement) =>
    within(el.closest(".proposals-row") as HTMLElement);

  await userEvent.click(row(first).getByRole("button", { name: "Accept" }));
  expect(onDecide).toHaveBeenLastCalledWith("p_1", "accepted");
  await userEvent.click(row(second).getByRole("button", { name: "Reject" }));
  expect(onDecide).toHaveBeenLastCalledWith("p_2", "rejected");
  await userEvent.click(row(second).getByRole("button", { name: "Refine" }));
  expect(onRefine).toHaveBeenCalledWith("p_2");
  expect(onDecide).toHaveBeenCalledTimes(2);
});

test("renders nothing without proposals", () => {
  const { container } = render(
    <ProposalsBar items={[]} onDecide={vi.fn()} onRefine={vi.fn()} />,
  );
  expect(container).toBeEmptyDOMElement();
});
