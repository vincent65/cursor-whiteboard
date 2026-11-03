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
