import type { BoardFile } from "../../export/schema";
import type { IncomingScene } from "../../shared/types";

export type SceneFile = {
  id: string;
  mimeType: string;
  created: number;
  dataURL: string;
};

// Changing one of these is an edit worth saving; zoom and scroll ride along
// with the next save but never cause one.
const SAVE_TRIGGERS = [
  "viewBackgroundColor",
  "gridSize",
  "gridModeEnabled",
] as const;

// The rest of appState is session state (selection, open menus, collaborators).
const PERSISTED_APP_STATE = [
  ...SAVE_TRIGGERS,
  "zoom",
  "scrollX",
  "scrollY",
] as const;
export type PersistedKey = (typeof PERSISTED_APP_STATE)[number];

export function persistedAppState(
  appState: Record<string, unknown>,
): Record<string, unknown> {
  const kept: Record<string, unknown> = {};
  for (const key of PERSISTED_APP_STATE)
    if (key in appState) kept[key] = appState[key];
  return kept;
}

export function toSaveBody(
  elements: readonly unknown[],
  appState: Record<string, unknown>,
  files: Record<string, SceneFile>,
): IncomingScene {
  // Excalidraw keeps a file after its image is deleted; sending it anyway
  // would carry an image the server rejects into every later save.
  const used = new Set(
    elements.flatMap((e) => {
      const el = e as { type?: unknown; fileId?: unknown; isDeleted?: unknown };
      return el.type === "image" && !el.isDeleted ? [el.fileId] : [];
    }),
  );
  return {
    elements: [...elements],
    appState: persistedAppState(appState),
    files: Object.fromEntries(
      Object.entries(files).filter(([id]) => used.has(id)),
    ),
  };
}

// A board as far as saving cares: getSceneVersion of its elements plus appState.
export type SaveState = { version: number; appState: Record<string, unknown> };

export const shouldSave = (prev: SaveState, next: SaveState): boolean =>
  prev.version !== next.version ||
  SAVE_TRIGGERS.some((key) => prev.appState[key] !== next.appState[key]);

function base64(bytes: Uint8Array): string {
  let binary = "";
  // Chunked so spreading a large image does not overflow the call stack.
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

// The server stores image bytes as assets; Excalidraw needs them back inline.
export async function filesWithDataUrls(
  stored: BoardFile,
  fetchAsset: (asset: string) => Promise<Blob>,
): Promise<Record<string, SceneFile>> {
  const entries = await Promise.all(
    Object.entries(stored.files).map(async ([key, f]) => {
      const blob = await fetchAsset(f.asset);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const dataURL = `data:${f.mimeType};base64,${base64(bytes)}`;
      return [
        key,
        { id: f.id, mimeType: f.mimeType, created: f.created, dataURL },
      ] as const;
    }),
  );
  return Object.fromEntries(entries);
}
