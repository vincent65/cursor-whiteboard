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

test("setTarget takes an updater, so a late clear leaves a newer target alone", () => {
  render(
    <RefineProvider>
      <Consumer />
    </RefineProvider>,
  );
  const clear = (id: string) => setTarget((t) => (t?.id === id ? null : t));
  act(() => setTarget({ id: "p_2", title: null }));
  act(() => clear("p_1"));
  expect(screen.getByText("p_2:null")).toBeInTheDocument();
  act(() => clear("p_2"));
  expect(screen.getByText("none")).toBeInTheDocument();
});
