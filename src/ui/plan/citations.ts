import { type Citation, parseCitations } from "../../export/citations";
import { routeHash } from "../hooks/useHashRoute";

// Doc citations name the file ("notes.md"); the doc route names the doc.
export const citationHash = (c: Citation): string =>
  routeHash({
    kind: c.kind,
    name: c.kind === "doc" ? c.page.replace(/\.md$/, "") : c.page,
    focus: [c.id],
  });

export function citationMarks(
  text: string,
): { from: number; to: number; hash: string }[] {
  let from = 0;
  return parseCitations(text).map((c) => {
    from = text.indexOf(c.raw, from);
    const mark = { from, to: from + c.raw.length, hash: citationHash(c) };
    from = mark.to;
    return mark;
  });
}
