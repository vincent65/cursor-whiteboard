// Excalidraw names itself in a few strings of its own UI, such as "Mermaid to
// Excalidraw". Inside Blueprint the canvas is Blueprint's, so those strings say
// Blueprint instead.
export const rebrand = (text: string): string =>
  text.replace(/Excalidraw/g, "Blueprint");

const ATTRIBUTES = ["title", "aria-label", "placeholder"];
// Excalidraw's own containers: the editor, its dialogs, and its tooltips.
const SCOPE = ".excalidraw, .excalidraw-tooltip";
// Places inside them that show what the user wrote: find results quote canvas
// text, and the link popup shows a link's address.
const USER_TEXT =
  ".layer-ui__search-result-container, .excalidraw-hyperlinkContainer";
const ours = (el: Element | null | undefined): boolean =>
  !!el?.closest(SCOPE) && !el.closest(USER_TEXT);

function rewrite(node: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue ?? "";
    if (text.includes("Excalidraw") && ours(node.parentElement))
      node.nodeValue = rebrand(text);
    return;
  }
  if (!(node instanceof Element)) return;
  if (ours(node))
    for (const name of ATTRIBUTES) {
      const value = node.getAttribute(name);
      if (value?.includes("Excalidraw"))
        node.setAttribute(name, rebrand(value));
    }
  for (const child of node.childNodes) rewrite(child);
}

// Rewrites what Excalidraw renders under root now and from then on; returns a
// function that stops. Excalidraw renders its dialogs and tooltips outside the
// board, so the caller passes the document body.
export function watchRebrand(root: Node): () => void {
  rewrite(root);
  const observer = new MutationObserver((records) => {
    for (const r of records)
      if (r.type === "childList") r.addedNodes.forEach(rewrite);
      else rewrite(r.target);
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRIBUTES,
  });
  return () => observer.disconnect();
}
