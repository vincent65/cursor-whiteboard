import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

// Returns a stable function that calls the latest `fn` with the last value
// once `ms` pass without another call. A call still pending at unmount runs
// immediately, so navigating away does not drop the last edit.
export function useDebounced<T>(
  fn: (v: T) => void,
  ms: number,
): (v: T) => void {
  const fnRef = useRef(fn);
  const pending = useRef<{ v: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useLayoutEffect(() => {
    fnRef.current = fn;
  });

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      const call = pending.current;
      pending.current = null;
      if (call) fnRef.current(call.v);
    },
    [],
  );

  return useCallback(
    (v: T) => {
      clearTimeout(timer.current);
      pending.current = { v };
      timer.current = setTimeout(() => {
        pending.current = null;
        fnRef.current(v);
      }, ms);
    },
    [ms],
  );
}
