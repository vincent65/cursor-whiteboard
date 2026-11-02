// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { useHashRoute } from "../../src/ui/hooks/useHashRoute";

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
