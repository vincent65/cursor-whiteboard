import "@excalidraw/excalidraw/index.css";
import {
  CaptureUpdateAction,
  Excalidraw,
  exportToBlob,
  getNonDeletedElements,
  getSceneVersion,
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
import * as api from "../api";
import { useDebounced } from "../hooks/useDebounced";
import { filesWithDataUrls, toSaveBody } from "./scene";

type Scene = {
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
};

type Loaded = {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
};

// Board files hold Blueprint's loose schema; Excalidraw's types are stricter.
const sceneVersion = (board: BoardFile) =>
  getSceneVersion(board.elements as unknown as readonly ExcalidrawElement[]);

const fetchAsset = async (asset: string): Promise<Blob> => {
  const res = await fetch(api.assetUrl(asset));
  if (!res.ok) throw new Error(`GET ${asset}: ${res.status}`);
  return res.blob();
};

async function load(board: BoardFile): Promise<Loaded> {
  const files = await filesWithDataUrls(board, fetchAsset);
  return {
    elements: restoreElements(
      board.elements as unknown as readonly ExcalidrawElement[],
      null,
    ),
    appState: board.appState as Partial<AppState>,
    files: files as BinaryFiles,
  };
}

export function BoardView({ name }: { name: string }) {
  const [initial, setInitial] = useState<Loaded | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const excalidraw = useRef<ExcalidrawImperativeAPI | null>(null);
  // The scene as of the last onChange; debounced work reads it when it fires,
  // so a reload in between supersedes any pending save of the old scene.
  const latest = useRef<Scene | null>(null);
  const lastSaved = useRef(0);
  // Versions this view sent, to recognise the watcher echoing our own saves.
  // ponytail: getSceneVersion is a sum, so an external edit landing on a sum
  // we sent is missed; compare hashElementsVersion if that ever bites.
  const sent = useRef(new Set<number>());
  // Saves run one at a time so a slow write cannot land after a newer one.
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const save = useDebounced<void>(() => {
    const s = latest.current;
    if (!s) return;
    const version = getSceneVersion(s.elements);
    if (version === lastSaved.current) return;
    lastSaved.current = version;
    sent.current.add(version);
    // Cloned now: Excalidraw mutates elements in place, and the queued save
    // must send exactly the version recorded above.
    const body = toSaveBody(
      structuredClone(s.elements),
      s.appState as unknown as Record<string, unknown>,
      s.files,
    );
    queue.current = queue.current
      .then(() => api.saveBoard(name, body))
      .then(
        () => setError(null),
        (err: Error) => setError(`Save failed: ${err.message}`),
      );
  }, 500);

  const exportPng = useDebounced<void>(() => {
    const s = latest.current;
    if (!s) return;
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

  useEffect(() => {
    let cancelled = false;
    api
      .getBoard(name)
      .then(load)
      .then(
        (loaded) => {
          if (cancelled) return;
          lastSaved.current = getSceneVersion(loaded.elements);
          setInitial(loaded);
        },
        (err: Error) => !cancelled && setError(err.message),
      );
    return () => {
      cancelled = true;
    };
  }, [name]);

  const apply = useCallback((loaded: Loaded) => {
    const ex = excalidraw.current;
    if (!ex) return;
    ex.addFiles(Object.values(loaded.files));
    lastSaved.current = getSceneVersion(loaded.elements);
    // Not undoable: undo would bring back the scene the disk just replaced.
    ex.updateScene({
      elements: loaded.elements,
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    setStale(false);
  }, []);

  // ponytail: one socket per open board, as in DocView.
  useEffect(
    () =>
      api.connectWs(async (m) => {
        if (m.kind !== "board" || m.name !== name) return;
        const board = await api.getBoard(name).catch(() => null);
        if (!board || sent.current.has(sceneVersion(board))) return;
        const loaded = await load(board).catch(() => null);
        const ex = excalidraw.current;
        if (!loaded || !ex) return;
        const current = getSceneVersion(ex.getSceneElementsIncludingDeleted());
        if (current === lastSaved.current) apply(loaded);
        else setStale(true);
      }),
    [name, apply],
  );

  const reload = () =>
    api
      .getBoard(name)
      .then(load)
      .then(apply, (err: Error) => setError(err.message));

  const onChange = (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    latest.current = { elements, appState, files };
    // onChange also fires for selection and scrolling; only edits schedule work.
    if (getSceneVersion(elements) === lastSaved.current) return;
    save();
    exportPng();
  };

  return (
    <div className="board">
      {stale && (
        <div role="alert" className="notice">
          <span className="notice-text">
            Board changed on disk. Reload to see it.
          </span>
          <button type="button" className="button" onClick={reload}>
            Reload
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="empty">
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
          />
        </div>
      )}
    </div>
  );
}
