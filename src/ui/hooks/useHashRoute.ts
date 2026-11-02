import { useEffect, useState } from "react";

export type Route = { kind: "board" | "doc"; name: string } | null;

function parseRoute(hash: string): Route {
  const m = /^#\/(boards|docs)\/([^/]+)$/.exec(hash);
  if (!m) return null;
  return { kind: m[1] === "boards" ? "board" : "doc", name: m[2] };
}

// The route in the URL hash. While leaving would lose edits the open view
// cannot save, a hash change asks first; declining puts the old URL back.
export function useHashRoute(wouldLoseEdits: () => boolean): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const onChange = (ev: HashChangeEvent) => {
      if (
        wouldLoseEdits() &&
        !window.confirm(
          "This file changed on disk while you had unsaved edits. Leave and discard your edits?",
        )
      ) {
        // replaceState fires no hashchange, so this is not asked twice.
        history.replaceState(history.state, "", ev.oldURL);
        return;
      }
      setRoute(parseRoute(location.hash));
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, [wouldLoseEdits]);
  return route;
}
