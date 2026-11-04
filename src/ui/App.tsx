import { DraftingCompass } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "./api";
import { BoardView } from "./board/BoardView";
import { DocView } from "./docs/DocView";
import { EmptyState } from "./EmptyState";
import { useHashRoute } from "./hooks/useHashRoute";
import { usePaneOpen } from "./hooks/usePaneOpen";
import { Sidebar } from "./nav/Sidebar";
import { ClaudePanel } from "./panel/ClaudePanel";
import { RefineProvider } from "./panel/refine";
import { SpecView } from "./plan/SpecView";
import { TasksView, useSplitCost } from "./plan/TasksView";
import { SelectionProvider } from "./selection";
import { ServerEventsProvider, useServerEvent } from "./server-events";
import { SessionsView } from "./sessions/SessionsView";

export function App() {
  return (
    <ServerEventsProvider>
      <SelectionProvider>
        <RefineProvider>
          <Shell />
        </RefineProvider>
      </SelectionProvider>
    </ServerEventsProvider>
  );
}

function Shell() {
  // Set by the open view while a disk conflict holds its saves back, so
  // leaving it would drop the edits.
  const conflictOpen = useRef(false);
  const route = useHashRoute(useCallback(() => conflictOpen.current, []));
  const onConflictChange = useCallback((open: boolean) => {
    conflictOpen.current = open;
  }, []);
  const [boards, setBoards] = useState<string[] | null>(null);
  const [docs, setDocs] = useState<string[]>([]);
  // The sidebar list whose name field is open, so the welcome page can open it.
  const [creating, setCreating] = useState<"board" | "doc" | null>(null);
  // Narrow windows start with the rail and the panel folded, so Excalidraw's
  // toolbar has room on the board.
  const [railOpen, setRailOpen] = usePaneOpen("(min-width: 1100px)");
  const [panelOpen, setPanelOpen] = usePaneOpen("(min-width: 860px)");

  const refresh = useCallback(async () => {
    const [b, d] = await Promise.all([api.listBoards(), api.listDocs()]);
    setBoards(b.map((e) => e.name));
    setDocs(d.map((e) => e.name));
  }, []);

  useEffect(() => {
    refresh().catch((err: Error) => window.alert(err.message));
  }, [refresh]);

  // A file made or deleted outside the app (by hand or by Claude) joins or
  // leaves the sidebar; edits to listed files are the open view's to handle.
  useServerEvent((m) => {
    if (m.type !== "file-changed" || m.kind === "spec" || m.kind === "task")
      return;
    const known = m.kind === "board" ? boards : docs;
    if (m.deleted || !known?.includes(m.name)) refresh().catch(console.error);
  });

  const splitCost = useSplitCost();

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

  // The sessions view takes the panel's room too; the panel stays mounted, so
  // a half-typed message survives the visit.
  const wide = route?.kind === "sessions";
  const shell = [
    "shell",
    wide && "shell-wide",
    !railOpen && "shell-rail-closed",
    !panelOpen && "shell-panel-closed",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shell}>
      <Sidebar
        boards={boards ?? []}
        docs={docs}
        active={route}
        onCreateBoard={create("board")}
        onCreateDoc={create("doc")}
        creating={creating}
        onCreatingChange={setCreating}
        collapsed={!railOpen}
        onCollapsedChange={(c) => setRailOpen(!c)}
      />
      <main className="main">
        {route?.kind === "board" && (
          <BoardView
            key={route.name}
            name={route.name}
            focus={route.focus}
            onConflictChange={onConflictChange}
          />
        )}
        {route?.kind === "doc" && (
          <DocView
            key={route.name}
            name={route.name}
            focus={route.focus}
            onConflictChange={onConflictChange}
          />
        )}
        {route?.kind === "spec" && <SpecView />}
        {route?.kind === "tasks" && <TasksView cost={splitCost} />}
        {route?.kind === "sessions" && <SessionsView />}
        {!route && boards?.length === 0 && (
          <EmptyState
            icon={DraftingCompass}
            title="Welcome to Blueprint"
            action={
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  setRailOpen(true);
                  setCreating("board");
                }}
              >
                Create your first board
              </button>
            }
          >
            <p>Plan on a whiteboard, then hand the plan to Claude Code.</p>
            <ol className="steps">
              <li>
                <strong>Sketch</strong> boxes, arrows, and notes on a board, or
                write a doc.
              </li>
              <li>
                <strong>Ask Claude</strong> about what you selected. Its ideas
                arrive as dashed shapes you accept or reject.
              </li>
              <li>
                <strong>Compile</strong> the plan into a spec and tasks, then
                launch a Claude Code session for each task.
              </li>
            </ol>
          </EmptyState>
        )}
      </main>
      <aside className="right-pane" hidden={wide}>
        <ClaudePanel
          onBoard={route?.kind === "board"}
          open={panelOpen}
          onOpenChange={setPanelOpen}
        />
      </aside>
    </div>
  );
}
