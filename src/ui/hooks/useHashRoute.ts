import { useEffect, useState } from "react";

export type Route =
  | { kind: "board" | "doc"; name: string; focus?: string[] }
  | { kind: "spec" }
  | { kind: "tasks" }
  | { kind: "sessions" }
  | null;

// A hand-typed malformed escape keeps its raw text rather than throwing.
const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

function parseRoute(hash: string): Route {
  if (hash === "#/spec") return { kind: "spec" };
  if (hash === "#/tasks") return { kind: "tasks" };
  if (hash === "#/sessions") return { kind: "sessions" };
  const m = /^#\/(boards|docs)\/([^/?]+)(?:\?focus=([^&]*))?$/.exec(hash);
  if (!m) return null;
  const kind = m[1] === "boards" ? "board" : "doc";
  const focus = (m[3] ?? "").split(",").filter(Boolean).map(decode);
  return focus.length ? { kind, name: m[2], focus } : { kind, name: m[2] };
}

// The inverse of parseRoute: each focus id is encoded, so commas inside ids survive.
export function routeHash(route: Exclude<Route, null>): string {
  if (!("name" in route)) return `#/${route.kind}`;
  const focus = route.focus?.length
    ? `?focus=${route.focus.map(encodeURIComponent).join(",")}`
    : "";
  return `#/${route.kind}s/${route.name}${focus}`;
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
