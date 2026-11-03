import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";

export const SUPPORTED =
  "only flowchart, sequence, class, ER, and state diagrams can become shapes";

// Turns Mermaid into editable shapes; parse errors propagate with the importer's message.
export async function renderMermaid(
  definition: string,
): Promise<ExcalidrawElement[]> {
  const { elements, files } = await parseMermaidToExcalidraw(definition, {
    themeVariables: { fontSize: "16px" },
  });
  // Diagram kinds the importer cannot lay out come back as one picture, which is not editable.
  if (files || elements.some((e) => e.type === "image")) {
    throw new Error(SUPPORTED);
  }
  return convertToExcalidrawElements(elements, { regenerateIds: true });
}

export function renderNote(text: string): ExcalidrawElement[] {
  return convertToExcalidrawElements(
    [{ type: "text", x: 0, y: 0, text, fontSize: 16 }],
    { regenerateIds: true },
  );
}

export function renderNode(
  label: string,
  kind: "box" | "ellipse" | "diamond",
): ExcalidrawElement[] {
  const type = kind === "box" ? "rectangle" : kind;
  return convertToExcalidrawElements(
    [{ type, x: 0, y: 0, label: { text: label } }],
    { regenerateIds: true },
  );
}
