// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { RefineProvider, useRefine } from "../../src/ui/panel/refine";

let setTarget: ReturnType<typeof useRefine>["setTarget"] = () => {};

function Consumer() {
  const refine = useRefine();
  setTarget = refine.setTarget;
  return (
    <p>
      {refine.target ? `${refine.target.id}:${refine.target.title}` : "none"}
    </p>
  );
}

test("useRefine starts null and setTarget updates consumers", () => {
  render(
    <RefineProvider>
      <Consumer />
    </RefineProvider>,
  );
  expect(screen.getByText("none")).toBeInTheDocument();
  act(() => setTarget({ id: "p_1", title: "Login flow" }));
  expect(screen.getByText("p_1:Login flow")).toBeInTheDocument();
  act(() => setTarget(null));
  expect(screen.getByText("none")).toBeInTheDocument();
});
