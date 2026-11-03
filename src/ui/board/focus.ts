// The focused ids still on the board, in the order the route named them.
export function focusTargets(
  elements: readonly { id: string; isDeleted?: boolean }[],
  focus: string[] | undefined,
): string[] {
  const live = new Set(elements.filter((e) => !e.isDeleted).map((e) => e.id));
  return (focus ?? []).filter((id) => live.has(id));
}

type Size = { width: number; height: number };

// Whether a scene-space box fits a screen-space view without zooming out.
export function fitsInView(box: Size, view: Size, zoom: number): boolean {
  return box.width * zoom <= view.width && box.height * zoom <= view.height;
}

// Width Excalidraw's properties panel covers on the canvas's left edge; it
// opens whenever something is selected, outside view mode, in the desktop layout.
// ponytail: fixed, measured at 0.18.1's desktop layout.
const PROPERTIES_PANEL_WIDTH = 232;

// How much of the editor's left edge a focus must keep clear. Excalidraw 0.18.1
// switches to its compact layout, with no side panel, by its isMobileBreakpoint.
export function leftInset(editor: Size, viewMode: boolean): number {
  const compact =
    editor.width < 730 || (editor.height < 500 && editor.width < 1000);
  return viewMode || compact ? 0 : PROPERTIES_PANEL_WIDTH;
}
