import { useCallback, useEffect, useState } from "react";
import * as api from "./api";
import { BoardView } from "./board/BoardView";
import { DocView } from "./docs/DocView";
import { Sidebar } from "./nav/Sidebar";

type Route = { kind: "board" | "doc"; name: string } | null;

function parseRoute(hash: string): Route {
  const m = /^#\/(boards|docs)\/([^/]+)$/.exec(hash);
  if (!m) return null;
  return { kind: m[1] === "boards" ? "board" : "doc", name: m[2] };
}

function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function App() {
  const route = useHashRoute();
  const [boards, setBoards] = useState<string[] | null>(null);
  const [docs, setDocs] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const [b, d] = await Promise.all([api.listBoards(), api.listDocs()]);
    setBoards(b.map((e) => e.name));
    setDocs(d.map((e) => e.name));
  }, []);

  useEffect(() => {
    refresh().catch((err: Error) => window.alert(err.message));
  }, [refresh]);

  // The default route opens the first board once the list has loaded.
  useEffect(() => {
    if (!route && boards?.length) location.replace(`#/boards/${boards[0]}`);
  }, [route, boards]);

  const create = (kind: "board" | "doc") => async (name: string) => {
    try {
      await (kind === "board" ? api.createBoard(name) : api.createDoc(name));
      await refresh();
      location.hash = `#/${kind}s/${name}`;
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  return (
    <div className="shell">
      <Sidebar
        boards={boards ?? []}
        docs={docs}
        active={route}
        onCreateBoard={create("board")}
        onCreateDoc={create("doc")}
      />
      <main className="main">
        {route?.kind === "board" && (
          <BoardView key={route.name} name={route.name} />
        )}
        {route?.kind === "doc" && (
          <DocView key={route.name} name={route.name} />
        )}
        {!route && boards?.length === 0 && (
          <p className="empty">No boards yet. Create one from the sidebar.</p>
        )}
      </main>
      <aside className="right-pane">
        <p className="muted">The Claude panel arrives in milestone 1.</p>
      </aside>
    </div>
  );
}
