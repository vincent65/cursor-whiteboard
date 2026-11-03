import { Fragment, type JSX, type ReactNode } from "react";
import { type Citation, parseCitations } from "../export/citations";

// Claude's Markdown as React elements: paragraphs, headings, emphasis, inline
// code, fenced code, lists, links, and block quotes. Anything else stays text,
// and every string goes in as a text node, so HTML in the input is never markup.
// A citation such as [[board:main#a1]] stays text unless renderCitation is
// given, which the spec view uses for its links.
// ponytail: no nested lists, tables, or images; an indented item joins the list.

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const QUOTE = /^ {0,3}> ?/;
const ITEM = /^\s*([-*+]|\d{1,9}[.)])[ \t]+(.*)$/;

const INLINE =
  /\\(?<esc>[\\`*_[\]()#>!+.-])|(?<tick>`+)(?<code>.+?)\k<tick>(?!`)|\[(?<label>[^\]\n]+)\]\((?<href>[^\s)]+)\)|(?<cite>\[\[(?:board|doc):[^#\]]+#[^\]]+\]\])|\*\*(?<b1>\S(?:.*?\S)?)\*\*|(?<!\w)__(?<b2>\S(?:.*?\S)?)__(?!\w)|\*(?<i1>\S(?:.*?\S)?)\*|(?<!\w)_(?<i2>\S(?:.*?\S)?)_(?!\w)/g;

const SAFE_HREF = /^(https?:|mailto:)/i;

type RenderCitation = (c: Citation) => ReactNode;

function inline(text: string, cite?: RenderCitation): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const g = m.groups ?? {};
    if (m.index > last) out.push(text.slice(last, m.index));
    last = m.index + m[0].length;
    const key = out.length;
    if (g.esc !== undefined) out.push(g.esc);
    else if (g.code !== undefined) out.push(<code key={key}>{g.code}</code>);
    else if (g.label !== undefined)
      out.push(
        SAFE_HREF.test(g.href) ? (
          <a key={key} href={g.href} target="_blank" rel="noreferrer">
            {inline(g.label, cite)}
          </a>
        ) : (
          m[0]
        ),
      );
    else if (g.cite !== undefined)
      out.push(
        cite ? (
          <Fragment key={key}>{cite(parseCitations(g.cite)[0])}</Fragment>
        ) : (
          g.cite
        ),
      );
    else if ((g.b1 ?? g.b2) !== undefined)
      out.push(<strong key={key}>{inline(g.b1 ?? g.b2, cite)}</strong>);
    else out.push(<em key={key}>{inline(g.i1 ?? g.i2, cite)}</em>);
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// Lines of one block, each a soft break: Claude often writes a sentence per line.
function lines(list: string[], cite?: RenderCitation): ReactNode[] {
  const out: ReactNode[] = [];
  for (const line of list) {
    if (out.length) out.push(<br key={out.length} />);
    out.push(...inline(line.trim(), cite));
  }
  return out;
}

const startsBlock = (line: string) =>
  FENCE.test(line) || HEADING.test(line) || QUOTE.test(line) || ITEM.test(line);

const ordered = (marker: string) => /\d/.test(marker);

function blocks(text: string, cite?: RenderCitation): ReactNode[] {
  const src = text.split(/\r?\n/);
  const out: ReactNode[] = [];
  let i = 0;
  while (i < src.length) {
    const line = src[i];
    const key = out.length;
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      const close = new RegExp(
        `^ {0,3}${fence[1][0]}{${fence[1].length},}\\s*$`,
      );
      const code: string[] = [];
      for (i++; i < src.length && !close.test(src[i]); i++) code.push(src[i]);
      i++;
      out.push(
        <pre key={key}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      // The panel's title is an h2, so Claude's headings sit below it.
      const Tag = `h${Math.min(heading[1].length + 2, 6)}` as "h3";
      out.push(<Tag key={key}>{inline(heading[2], cite)}</Tag>);
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      const inner: string[] = [];
      for (; i < src.length && QUOTE.test(src[i]); i++)
        inner.push(src[i].replace(QUOTE, ""));
      out.push(
        <blockquote key={key}>{blocks(inner.join("\n"), cite)}</blockquote>,
      );
      continue;
    }
    const first = ITEM.exec(line);
    if (first) {
      const isOrdered = ordered(first[1]);
      const sameKind = (l: string | undefined) => {
        const m = l === undefined ? null : ITEM.exec(l);
        return m !== null && ordered(m[1]) === isOrdered;
      };
      const items: string[][] = [];
      while (i < src.length) {
        const l = src[i];
        if (sameKind(l)) items.push([(ITEM.exec(l) as RegExpExecArray)[2]]);
        else if (!l.trim()) {
          // A blank line between items keeps the list going.
          if (!sameKind(src[i + 1])) break;
        } else if (/^\s/.test(l) || !startsBlock(l))
          items[items.length - 1].push(l);
        else break;
        i++;
      }
      const lis = items.map((item, n) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: items never move
        <li key={n}>{lines(item, cite)}</li>
      ));
      const start = Number.parseInt(first[1], 10);
      out.push(
        isOrdered ? (
          <ol key={key} start={start === 1 ? undefined : start}>
            {lis}
          </ol>
        ) : (
          <ul key={key}>{lis}</ul>
        ),
      );
      continue;
    }
    const para: string[] = [];
    for (
      ;
      i < src.length &&
      src[i].trim() &&
      (para.length === 0 || !startsBlock(src[i]));
      i++
    )
      para.push(src[i]);
    out.push(<p key={key}>{lines(para, cite)}</p>);
  }
  return out;
}

export function Markdown({
  text,
  renderCitation,
}: {
  text: string;
  renderCitation?: RenderCitation;
}): JSX.Element {
  return <div className="md">{blocks(text, renderCitation)}</div>;
}
