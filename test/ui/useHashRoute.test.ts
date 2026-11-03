// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import {
  type Route,
  routeHash,
  useHashRoute,
} from "../../src/ui/hooks/useHashRoute";

// Sets the hash and waits for the hashchange it fires.
const go = (hash: string) =>
  new Promise<void>((resolve) => {
    window.addEventListener("hashchange", () => setTimeout(resolve), {
      once: true,
    });
    location.hash = hash;
  });

test("follows the hash and, while edits would be lost, leaves only on confirm", async () => {
  location.hash = "#/boards/main";
  let wouldLoseEdits = false;
  const confirm = vi.spyOn(window, "confirm");
  const { result } = renderHook(() => useHashRoute(() => wouldLoseEdits));
  expect(result.current).toEqual({ kind: "board", name: "main" });

  await go("#/docs/notes");
  await waitFor(() =>
    expect(result.current).toEqual({ kind: "doc", name: "notes" }),
  );
  expect(confirm).not.toHaveBeenCalled();

  wouldLoseEdits = true;
  confirm.mockReturnValue(false);
  await go("#/boards/main");
  expect(confirm).toHaveBeenCalledOnce();
  expect(result.current).toEqual({ kind: "doc", name: "notes" });
  expect(location.hash).toBe("#/docs/notes");

  confirm.mockReturnValue(true);
  await go("#/boards/main");
  await waitFor(() =>
    expect(result.current).toEqual({ kind: "board", name: "main" }),
  );
  expect(confirm).toHaveBeenCalledTimes(2);
});

test("parses focus and the plan routes, and routeHash inverts them", () => {
  const read = (hash: string) => {
    location.hash = hash;
    return renderHook(() => useHashRoute(() => false)).result.current;
  };
  const cases: [string, Exclude<Route, null>][] = [
    ["#/spec", { kind: "spec" }],
    ["#/tasks", { kind: "tasks" }],
    ["#/sessions", { kind: "sessions" }],
    ["#/boards/main", { kind: "board", name: "main" }],
    [
      "#/boards/main?focus=a,b",
      { kind: "board", name: "main", focus: ["a", "b"] },
    ],
    [
      "#/docs/notes?focus=intro",
      { kind: "doc", name: "notes", focus: ["intro"] },
    ],
  ];
  for (const [hash, route] of cases) {
    expect(read(hash)).toEqual(route);
    expect(routeHash(route)).toBe(hash);
  }
  // Ids are URL-decoded and empty entries dropped; routeHash encodes them back.
  const focused: Exclude<Route, null> = {
    kind: "board",
    name: "main",
    focus: ["a,b", "c d"],
  };
  expect(read("#/boards/main?focus=a%2Cb,,c%20d,")).toEqual(focused);
  expect(routeHash(focused)).toBe("#/boards/main?focus=a%2Cb,c%20d");
  expect(read("#/boards/main?focus=")).toEqual({ kind: "board", name: "main" });
  expect(read("#/spec/extra")).toBeNull();
});
