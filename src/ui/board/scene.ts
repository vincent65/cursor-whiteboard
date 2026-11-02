import type { BoardFile } from "../../export/schema";
import type { IncomingScene } from "../../shared/types";

export type SceneFile = {
  id: string;
  mimeType: string;
  created: number;
  dataURL: string;
};

// The rest of appState is session state (selection, open menus, collaborators).
const PERSISTED_APP_STATE = [
  "viewBackgroundColor",
  "gridSize",
  "gridModeEnabled",
  "zoom",
  "scrollX",
  "scrollY",
] as const;

export function toSaveBody(
  elements: readonly unknown[],
  appState: Record<string, unknown>,
  files: Record<string, SceneFile>,
): IncomingScene {
  const kept: Record<string, unknown> = {};
  for (const key of PERSISTED_APP_STATE)
    if (key in appState) kept[key] = appState[key];
  return { elements: [...elements], appState: kept, files };
}

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
