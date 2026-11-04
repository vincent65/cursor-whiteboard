import { useEffect, useState } from "react";

const matches = (query: string): boolean =>
  typeof window.matchMedia === "function"
    ? window.matchMedia(query).matches
    : true;

// Open by default while `query` matches, so a narrow window gives the board
// the room. A toggle holds until the window crosses the breakpoint again.
export function usePaneOpen(query: string): [boolean, (open: boolean) => void] {
  const [wide, setWide] = useState(() => matches(query));
  const [choice, setChoice] = useState<boolean | null>(null);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    const onChange = () => {
      setWide(list.matches);
      setChoice(null);
    };
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return [choice ?? wide, setChoice];
}
