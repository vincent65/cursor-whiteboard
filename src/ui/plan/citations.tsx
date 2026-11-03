import type { Citation } from "../../export/citations";
import { routeHash } from "../hooks/useHashRoute";

// Doc citations name the file ("notes.md"); the doc route names the doc.
export const citationHash = (c: Citation): string =>
  routeHash({
    kind: c.kind,
    name: c.kind === "doc" ? c.page.replace(/\.md$/, "") : c.page,
    focus: [c.id],
  });

// A citation as a small link chip to what it cites, named by its label or else its
// id; the raw form, with the id, is its tooltip.
export function CitationLink({
  citation,
  label,
}: {
  citation: Citation;
  label?: string;
}) {
  return (
    <a className="cite" href={citationHash(citation)} title={citation.raw}>
      {label || `${citation.page}#${citation.id}`}
    </a>
  );
}
