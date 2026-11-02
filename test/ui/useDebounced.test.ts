// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { useDebounced } from "../../src/ui/hooks/useDebounced";

afterEach(() => {
  vi.useRealTimers();
});

test("useDebounced calls once with the last value after the delay", () => {
  vi.useFakeTimers();
  const fn = vi.fn();
  const { result } = renderHook(() => useDebounced(fn, 500));
  result.current("a");
  vi.advanceTimersByTime(200);
  result.current("b");
  vi.advanceTimersByTime(200);
  result.current("c");
  vi.advanceTimersByTime(499);
  expect(fn).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith("c");
});
