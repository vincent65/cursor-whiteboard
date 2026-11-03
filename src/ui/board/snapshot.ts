import { base64 } from "./scene";

// Ids in scene order, so the same selection always reads the same.
export function selectedIds(
  appState: { selectedElementIds: Record<string, boolean> },
  elements: readonly { id: string; isDeleted?: boolean }[],
): string[] {
  return elements
    .filter((e) => !e.isDeleted && appState.selectedElementIds[e.id])
    .map((e) => e.id);
}

// FileReader is missing under Node, where the tests run.
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return `data:${blob.type};base64,${base64(bytes)}`;
}

export const sameIds = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((id, i) => id === b[i]);
