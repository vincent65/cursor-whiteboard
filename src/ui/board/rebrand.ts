// Excalidraw names itself in a few strings of its own UI, such as "Mermaid to
// Excalidraw". Inside Blueprint the canvas is Blueprint's, so those strings say
// Blueprint instead.
export const rebrand = (text: string): string =>
  text.replace(/Excalidraw/g, "Blueprint");

const ATTRIBUTES = ["title", "aria-label", "placeholder"];
// Excalidraw's own containers: the editor, its dialogs, and its tooltips.
const SCOPE = ".excalidraw, .excalidraw-tooltip";

function rewrite(node: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue ?? "";
    if (text.includes("Excalidraw") && node.parentElement?.closest(SCOPE))
      node.nodeValue = rebrand(text);
    return;
  }
  if (!(node instanceof Element)) return;
  if (node.closest(SCOPE))
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
