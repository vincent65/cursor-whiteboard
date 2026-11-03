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

// An aside made only of citations, like " (see [[a]], [[b]])", with the space before it.
const CITED_ASIDE = new RegExp(
  `[ \\t]?\\((?:[Ss]ee |cf\\. )?${CITATION.source}(?:[,;]? ?${CITATION.source})*\\)`,
  "g",
);
// One separator beside a citation: a comma or semicolon with its spaces, or spaces alone.
const SEPARATOR_BEFORE = /(?:[,;][ \t]*|[ \t]+)$/;
const SEPARATOR_AFTER = /^(?:[,;][ \t]*|[ \t]+)/;
const PUNCT_BEFORE = /[,;][ \t]*$/;
const PUNCT_AFTER = /^[,;]/;

// Each unknown citation goes with one separator beside it, so a list of them leaves no
// stray commas; an aside whose citations are all unknown goes whole.
export function dropUnknownCitations(
  text: string,
  index: Set<string>,
): { text: string; dropped: Citation[] } {
  const dropped = parseCitations(text).filter((c) => !index.has(key(c)));
  const unknown = new Set(dropped.map((c) => c.raw));
  const asidesGone = text.replace(CITED_ASIDE, (aside) =>
    parseCitations(aside).every((c) => unknown.has(c.raw)) ? "" : aside,
  );
  let out = "";
  let pos = 0;
  for (const m of asidesGone.matchAll(CITATION)) {
    out += asidesGone.slice(pos, m.index);
    pos = m.index + m[0].length;
    if (!unknown.has(m[0])) {
      out += m[0];
      continue;
    }
    // The comma or semicolon goes, wherever it is: one after a citation that leads a
    // list ("See [[x]], A"), else the separator before it, else the one after it.
    const after = asidesGone.slice(pos);
    const takeAfter = PUNCT_AFTER.test(after)
      ? !PUNCT_BEFORE.test(out)
      : !SEPARATOR_BEFORE.test(out);
    if (takeAfter) pos += SEPARATOR_AFTER.exec(after)?.[0].length ?? 0;
    else out = out.replace(SEPARATOR_BEFORE, "");
  }
  return { text: out + asidesGone.slice(pos), dropped };
}
