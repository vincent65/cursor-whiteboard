import type { BoardGraph } from "./schema.js";

export type Citation = {
  kind: "board" | "doc";
  page: string;
  id: string;
  raw: string;
};

const CITATION = /\[\[(board|doc):([^#\]]+)#([^\]]+)\]\]/g;
const ATX_HEADING = /^#{1,6} (.*)$/gm;

const key = (c: Citation) => `${c.kind}:${c.page}#${c.id}`;

export function parseCitations(text: string): Citation[] {
  return [...text.matchAll(CITATION)].map(([raw, kind, page, id]) => ({
    kind: kind as Citation["kind"],
    page,
    id,
    raw,
  }));
}

// ponytail: no "-1" suffix for duplicate headings; the index is a Set, add it when anchors must be unique.
export function headingSlugs(markdown: string): string[] {
  return [...markdown.matchAll(ATX_HEADING)].map(([, heading]) =>
    heading
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{Nd} -]/gu, "")
      .replace(/ /g, "-"),
  );
}

export function buildCitationIndex(input: {
  boards: Record<string, BoardGraph>;
  docs: Record<string, string>;
}): Set<string> {
  const index = new Set<string>();
  for (const [name, graph] of Object.entries(input.boards)) {
    for (const { id } of [...graph.nodes, ...graph.edges, ...graph.loose]) {
      index.add(`board:${name}#${id}`);
    }
  }
  for (const [file, markdown] of Object.entries(input.docs)) {
    for (const slug of headingSlugs(markdown)) {
      index.add(`doc:${file}#${slug}`);
    }
  }
  return index;
}

export function dropUnknownCitations(
  text: string,
  index: Set<string>,
): { text: string; dropped: Citation[] } {
  const dropped = parseCitations(text).filter((c) => !index.has(key(c)));
  const unknown = new Set(dropped.map((c) => c.raw));
  return {
    text: text.replace(CITATION, (raw) => (unknown.has(raw) ? "" : raw)),
    dropped,
  };
}
