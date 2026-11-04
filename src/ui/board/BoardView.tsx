import "@excalidraw/excalidraw/index.css";
import {
  bumpVersion,
  CaptureUpdateAction,
  Excalidraw,
  exportToBlob,
  getCommonBounds,
  getNonDeletedElements,
  getSceneVersion,
  getVisibleSceneBounds,
  isElementInsideBBox,
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardFile } from "../../export/schema";
import type { ServerMessage } from "../../shared/messages";
import type { Decision, Proposal } from "../../shared/proposals";
import * as api from "../api";
import { useDebounced } from "../hooks/useDebounced";
import { useRefine } from "../panel/refine";
import { selectionLabels, useSetSelection } from "../selection";
import { useSendToServer, useServerEvent } from "../server-events";
import { fitsInView, focusTargets, leftInset } from "./focus";
import {
  applyProposal,
  type Counts,
  decideProposal,
  type El,
  listBoundArrows,
  pendingProposals,
} from "./ghosts";
import { renderMermaid, renderNode, renderNote } from "./mermaid";
import { ProposalsBar } from "./ProposalsBar";
import { watchRebrand } from "./rebrand";
import {
  filesWithDataUrls,
  type PersistedKey,
  persistedAppState,
  type SaveState,
  shouldSave,
  toSaveBody,
} from "./scene";
import { blobToDataUrl, sameIds, selectedIds } from "./snapshot";

type Scene = {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
};

const saveState = (
  elements: readonly ExcalidrawElement[],
  appState: Partial<AppState>,
): SaveState => ({
  version: getSceneVersion(elements),
  appState: appState as Record<string, unknown>,
});

const fetchAsset = async (asset: string): Promise<Blob> => {
  const res = await fetch(api.assetUrl(asset));
  if (!res.ok) throw new Error(`GET ${asset}: ${res.status}`);
  return res.blob();
};

const toPng = async (
  elements: readonly ExcalidrawElement[],
  s: Scene,
): Promise<string> =>
  blobToDataUrl(
    await exportToBlob({
      elements,
      appState: s.appState,
      files: s.files,
      mimeType: "image/png",
      exportPadding: 16,
    }),
  );

// ghosts.ts works on a structural slice of each element and leaves versions
// alone; bumping what it replaced is what lets saves, undo, and the bar see the
// change. Listing bound arrows on their ends goes through the same bump.
// Restoring re-measures changed labels and repairs arrow bindings.
function throughGhosts(
  elements: readonly ExcalidrawElement[],
  change: (elements: readonly El[]) => El[],
): ExcalidrawElement[] {
  const unchanged = new Set<unknown>(elements);
  const changed = listBoundArrows(change(elements));
  const next = (changed as unknown as ExcalidrawElement[]).map((e) =>
    unchanged.has(e) ? e : bumpVersion(e),
  );
  return restoreElements(next, null, {
    refreshDimensions: true,
    repairBindings: true,
  });
}

// Centers targets in the part of the canvas Excalidraw's properties panel leaves
// clear. It never zooms in: targets that fit are centered at the current zoom, and
// only targets that do not fit are zoomed out to.
function centerOn(
  ex: ExcalidrawImperativeAPI,
  targets: readonly ExcalidrawElement[],
): void {
  const { width, height, zoom, viewModeEnabled } = ex.getAppState();
  const left = leftInset({ width, height }, viewModeEnabled);
  const [x1, y1, x2, y2] = getCommonBounds(targets);
  const box = { width: x2 - x1, height: y2 - y1 };
  // Plain centering ignores canvasOffsets, so centering at the current zoom
  // goes through the fit with the zoom pinned.
  const fits = fitsInView(box, { width: width - left, height }, zoom.value);
  ex.scrollToContent(targets, {
    fitToViewport: true,
    animate: true,
    canvasOffsets: { left },
    ...(fits
      ? { minZoom: zoom.value, maxZoom: zoom.value }
      : { viewportZoomFactor: 0.8 }),
  });
}

// Draws a proposal as ghosts. Every conversion runs before the scene is read,
// so a Mermaid error leaves the board untouched.
async function applyProposalRequest(
  ex: ExcalidrawImperativeAPI,
  proposal: Proposal,
  replace: boolean,
): Promise<{ elementIds: string[] }> {
  // Labels are measured as they are drawn, and Excalidraw loads Excalifont only once the
  // scene shows text; on a board without any, a fallback font's metrics would size the
  // boxes, and the labels would wrap once the real font re-measures them.
  // ponytail: the ops' JSON stands in for their text; it only picks the glyph subsets.
  await document.fonts.load("20px Excalifont", JSON.stringify(proposal.ops));
  const rendered = new Map<number, El[]>();
  for (const [i, op] of proposal.ops.entries()) {
    if (op.op === "add_diagram")
      rendered.set(i, await renderMermaid(op.mermaid));
    else if (op.op === "add_note") rendered.set(i, renderNote(op.text));
    else if (op.op === "add_node")
      rendered.set(i, renderNode(op.label, op.kind));
  }
  const appState = ex.getAppState();
  const view = getVisibleSceneBounds(appState);
  const [x1, y1, x2, y2] = view;
  const current = ex.getSceneElementsIncludingDeleted();
  let ids: string[] = [];
  const elements = throughGhosts(current, (els) => {
    const result = applyProposal(
      replace ? decideProposal(els, proposal.id, "rejected") : els,
      proposal,
      rendered,
      {
        selectedIds: selectedIds(appState, current),
        viewport: { x: x1, y: y1, w: x2 - x1, h: y2 - y1 },
      },
    );
    ids = result.ids;
    return result.elements;
  });
  ex.updateScene({ elements, captureUpdate: CaptureUpdateAction.IMMEDIATELY });
  const live = getNonDeletedElements(elements);
  const touched = live.filter((e) => ids.includes(e.id));
  // Out of view, the ghosts come into view beside the selection they answer.
  if (touched.some((e) => !isElementInsideBBox(e, view))) {
    const selected = selectedIds(appState, current);
    centerOn(ex, [...touched, ...live.filter((e) => selected.includes(e.id))]);
  }
  return { elementIds: ids };
}

// Board files hold Blueprint's loose schema; Excalidraw's types are stricter.
// Restoring fills in Excalidraw's defaults, so the editor's first onChange
// matches what was loaded and does not count as an edit.
async function load(board: BoardFile): Promise<Scene> {
  const files = await filesWithDataUrls(board, fetchAsset);
  return {
    elements: restoreElements(
      board.elements as unknown as readonly ExcalidrawElement[],
      null,
    ),
    appState: restoreAppState(board.appState as Partial<AppState>, null),
    files: files as BinaryFiles,
  };
}

// Blueprint saves boards itself, so Excalidraw's own file actions (open, save
// to a file, reset) and its theme switch stay off; image export stays.
const UI_OPTIONS = {
  canvasActions: {
    loadScene: false,
    export: false as const,
    saveToActiveFile: false,
    clearCanvas: false,
    changeViewBackgroundColor: false,
    toggleTheme: null,
  },
};

export function BoardView({
  name,
  focus,
  onConflictChange,
}: {
  name: string;
  focus?: string[];
  onConflictChange(open: boolean): void;
}) {
  const [initial, setInitial] = useState<Scene | null>(null);
  // Excalidraw loads initialData asynchronously after mount and reports no
  // change until it has; the first onChange means the scene is in the editor.
  const [loaded, setLoaded] = useState(false);
  // The disk changed while the editor had unsaved edits; saves wait for the
  // user to pick a side so neither version is silently overwritten.
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const excalidraw = useRef<ExcalidrawImperativeAPI | null>(null);
  // The scene as of the last onChange; debounced work reads it when it fires.
  // Loading a disk scene clears it, so a save pending from before is dropped.
  const latest = useRef<(Scene & { appState: AppState }) | null>(null);
  const lastSaved = useRef<SaveState>({ version: 0, appState: {} });
  // Null until the first report, so a fresh board announces itself even with
  // nothing selected.
  const reported = useRef<{ ids: string[]; labels: string[] } | null>(null);
  const send = useSendToServer();
  const setSelection = useSetSelection();
  // Excalidraw's own strings that name it say Blueprint, here and in its dialogs.
  useEffect(() => watchRebrand(document.body), []);
  // Saves not yet answered, so the watcher echoing one is not a disk change.
  const inFlight = useRef(new Set<SaveState>());
  // Saves run one at a time so a slow write cannot land after a newer one.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [pending, setPending] = useState<{ id: string; counts: Counts }[]>([]);
  const pendingVersion = useRef(-1);
  // Pending proposals' titles; ghosts on the board carry only the id.
  const [titles, setTitles] = useState(new Map<string, string | null>());
  const { setTarget } = useRefine();
  // What Excalidraw's properties panel covers on the left, as focus keeps clear.
  const [inset, setInset] = useState(0);
  // Decisions awaiting the server; their rows stay disabled until each settles.
  const [deciding, setDeciding] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    onConflictChange(conflict);
    return () => onConflictChange(false);
  }, [conflict, onConflictChange]);

  const persist = (s: Scene) => {
    const state = saveState(s.elements, s.appState);
    lastSaved.current = state;
    inFlight.current.add(state);
    // Cloned now: Excalidraw mutates elements in place, and the queued save
    // must send exactly the version recorded above.
    const body = toSaveBody(
      structuredClone(s.elements),
      state.appState,
      s.files,
    );
    queue.current = queue.current
      .then(() => api.saveBoard(name, body))
      .then(
        () => setError(null),
        (err: Error) => setError(`Save failed: ${err.message}`),
      )
      .finally(() => inFlight.current.delete(state));
  };

  const save = useDebounced<void>(() => {
    const s = latest.current;
    if (!s || conflict) return;
    if (shouldSave(lastSaved.current, saveState(s.elements, s.appState)))
      persist(s);
  }, 500);

  const exportPng = useDebounced<void>(() => {
    const s = latest.current;
    if (!s || conflict) return;
    exportToBlob({
      elements: getNonDeletedElements(s.elements),
      appState: s.appState,
      files: s.files,
      mimeType: "image/png",
      exportPadding: 16,
    })
      .then((blob: Blob) => api.uploadBoardPng(name, blob))
      .catch((err: Error) => setError(`PNG export failed: ${err.message}`));
  }, 2000);

  const reportSelection = useDebounced<void>(() => {
    const s = latest.current;
    if (!s) return;
    const ids = selectedIds(s.appState, s.elements);
    // Labels follow text edits on the selected shapes; only ids reach the server.
    const labels = selectionLabels(s.elements, ids);
    const prev = reported.current;
    if (prev && sameIds(ids, prev.ids) && sameIds(labels, prev.labels)) return;
    reported.current = { ids, labels };
    setSelection({ board: name, ids, labels });
    if (!prev || !sameIds(ids, prev.ids))
      send({ type: "selection.changed", board: name, ids });
  }, 150);

  // The board is announced at once, so a message sent while its scene still
  // loads can already propose to it. Declared after reportSelection, so a report
  // still pending flushes first; an empty board name tells the server no board
  // is open any more.
  useEffect(() => {
    send({ type: "selection.changed", board: name, ids: [] });
    return () => {
      reported.current = null;
      setSelection(null);
      send({ type: "selection.changed", board: "", ids: [] });
    };
  }, [name, send, setSelection]);

  useEffect(() => {
    api.listProposals().then(
      (proposals) =>
        setTitles(
          (t) =>
            new Map([...proposals.map((p) => [p.id, p.title] as const), ...t]),
        ),
      (err: Error) => console.error(err),
    );
  }, []);

  const answer = async (
    m: Extract<ServerMessage, { type: "request" }>,
  ): Promise<unknown> => {
    const s = latest.current;
    if (m.kind === "proposal.apply") {
      const { proposal } = m;
      if (proposal.board !== name)
        throw new Error(`board ${proposal.board} is not open`);
      const ex = excalidraw.current;
      if (!s || !ex) throw new Error(`board ${name} is still loading`);
      setTitles((t) => new Map(t).set(proposal.id, proposal.title));
      return applyProposalRequest(ex, proposal, m.replace);
    }
    if (m.kind === "board.png") {
      if (m.board !== name) throw new Error(`board ${m.board} is not open`);
      if (!s) throw new Error(`board ${name} is still loading`);
      return { png: await toPng(getNonDeletedElements(s.elements), s) };
    }
    const ids = s ? selectedIds(s.appState, s.elements) : [];
    if (!s || ids.length === 0) return { ids, png: null };
    // A selected shape's label is a separate text element bound to it.
    const picked = new Set(ids);
    const elements = getNonDeletedElements(s.elements).filter(
      (e) =>
        picked.has(e.id) ||
        (e.type === "text" && e.containerId && picked.has(e.containerId)),
    );
    return { ids, png: await toPng(elements, s) };
  };

  useServerEvent((m) => {
    if (m.type !== "request") return;
    answer(m).then(
      (payload) => send({ type: "response", id: m.id, ok: true, payload }),
      (err: Error) =>
        send({ type: "response", id: m.id, ok: false, error: err.message }),
    );
  });

  useEffect(() => {
    let cancelled = false;
    api
      .getBoard(name)
      .then(load)
      .then(
        (loaded) => {
          if (cancelled) return;
          lastSaved.current = saveState(loaded.elements, loaded.appState);
          setInitial(loaded);
        },
        (err: Error) => !cancelled && setError(err.message),
      );
    return () => {
      cancelled = true;
    };
  }, [name]);

  // Selecting is not an undo step. Ids the board no longer has are skipped,
  // so a stale citation opens the board with nothing selected.
  useEffect(() => {
    const ex = excalidraw.current;
    if (!loaded || !ex) return;
    const elements = ex.getSceneElementsIncludingDeleted();
    const ids = focusTargets(elements, focus);
    if (ids.length === 0) return;
    ex.updateScene({
      appState: {
        selectedElementIds: Object.fromEntries(
          ids.map((id) => [id, true] as const),
        ),
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    centerOn(
      ex,
      elements.filter((e) => ids.includes(e.id)),
    );
  }, [loaded, focus]);

  const apply = useCallback((loaded: Scene) => {
    const ex = excalidraw.current;
    if (!ex) return;
    lastSaved.current = saveState(loaded.elements, loaded.appState);
    latest.current = null;
    ex.addFiles(Object.values(loaded.files));
    // Not undoable: undo would bring back the scene the disk just replaced.
    ex.updateScene({
      elements: loaded.elements,
      appState: persistedAppState(
        loaded.appState as Record<string, unknown>,
      ) as Pick<AppState, PersistedKey>,
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    setConflict(false);
  }, []);

  useServerEvent(async (m) => {
    if (m.type !== "file-changed" || m.kind !== "board" || m.name !== name)
      return;
    // Let pending saves settle first, so the read and the comparison below
    // see the state they left behind rather than one caught mid-save.
    await queue.current;
    const board = await api.getBoard(name).catch(() => null);
    if (!board) return;
    const disk = saveState(
      board.elements as unknown as readonly ExcalidrawElement[],
      board.appState,
    );
    const echo = [lastSaved.current, ...inFlight.current].some(
      (s) => !shouldSave(s, disk),
    );
    if (echo) return;
    const loaded = await load(board).catch(() => null);
    const ex = excalidraw.current;
    if (!loaded || !ex) return;
    const current = saveState(
      ex.getSceneElementsIncludingDeleted(),
      ex.getAppState(),
    );
    if (shouldSave(lastSaved.current, current)) setConflict(true);
    else apply(loaded);
  });

  const keepMine = () => {
    setConflict(false);
    if (latest.current) persist(latest.current);
    exportPng();
  };

  const takeTheirs = () =>
    api
      .getBoard(name)
      .then(load)
      .then(apply, (err: Error) => setError(err.message));

  // The server decides first, so a proposal Claude is revising (409) keeps
  // its ghosts for the revise to replace. A proposal the server lost (404)
  // still resolves locally: the board is the record.
  const tellServer = async (id: string, decision: Decision) => {
    try {
      await api.decideProposal(id, decision);
    } catch (err) {
      if (!(err instanceof api.ApiError && err.status === 404)) {
        setError(`Decision failed: ${(err as Error).message}`);
        return false;
      }
      console.warn(err.message);
    }
    return true;
  };

  const decide = async (id: string, decision: Decision) => {
    setDeciding((d) => new Set(d).add(id));
    try {
      if (!(await tellServer(id, decision))) return;
    } finally {
      setDeciding((d) => {
        const next = new Set(d);
        next.delete(id);
        return next;
      });
    }
    const ex = excalidraw.current;
    if (!ex) return;
    ex.updateScene({
      elements: throughGhosts(ex.getSceneElementsIncludingDeleted(), (els) =>
        decideProposal(els, id, decision),
      ),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    setTitles((t) => {
      const next = new Map(t);
      next.delete(id);
      return next;
    });
    setTarget((t) => (t?.id === id ? null : t));
  };

  const onChange = (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    latest.current = { elements, appState, files };
    setLoaded(true);
    setInset(leftInset(appState, appState.viewModeEnabled));
    reportSelection();
    const version = getSceneVersion(elements);
    if (version !== pendingVersion.current) {
      pendingVersion.current = version;
      // Ghosts removed by hand need nothing here: the server rejects their proposal once
      // saves or board reads find them gone past its removal grace period.
      const next = pendingProposals(elements);
      // Same list keeps the old state, so plain edits do not re-render.
      setPending((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
      );
    }
    // onChange also fires for selection, zoom and scrolling; only edits
    // schedule work.
    if (!shouldSave(lastSaved.current, saveState(elements, appState))) return;
    save();
    exportPng();
  };

  return (
    <div className="board">
      {conflict && (
        <div role="alert" className="notice">
          <span className="notice-text">Board changed on disk.</span>
          <button type="button" className="button" onClick={keepMine}>
            Keep mine
          </button>
          <button type="button" className="button" onClick={takeTheirs}>
            Take theirs
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="plan-error">
          {error}
        </p>
      )}
      {initial && (
        <div className="board-canvas">
          <Excalidraw
            initialData={initial}
            onChange={onChange}
            excalidrawAPI={(ex) => {
              excalidraw.current = ex;
            }}
            UIOptions={UI_OPTIONS}
          />
        </div>
      )}
      <ProposalsBar
        items={pending.map((p) => ({
          ...p,
          title: titles.get(p.id) ?? null,
          busy: deciding.has(p.id),
        }))}
        onDecide={decide}
        onRefine={(id) => setTarget({ id, title: titles.get(id) ?? null })}
        inset={inset}
      />
    </div>
  );
}
