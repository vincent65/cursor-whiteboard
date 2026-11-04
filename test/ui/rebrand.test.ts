// @vitest-environment jsdom
import { rebrand, watchRebrand } from "../../src/ui/board/rebrand";

test("rebrand names Blueprint wherever Excalidraw names itself", () => {
  expect(rebrand("Mermaid to Excalidraw")).toBe("Mermaid to Blueprint");
  expect(rebrand("Excalidraw and Excalidraw")).toBe("Blueprint and Blueprint");
  expect(rebrand("Frame tool")).toBe("Frame tool");
});

test("watchRebrand rewrites Excalidraw's own text and labels, now and later, and nothing outside it", async () => {
  document.body.innerHTML =
    '<div class="excalidraw"><button title="Open in Excalidraw">Mermaid to Excalidraw</button></div><p>Built on Excalidraw</p>';
  const stop = watchRebrand(document.body);
  const button = document.querySelector("button") as HTMLButtonElement;
  expect(button.textContent).toBe("Mermaid to Blueprint");
  expect(button.title).toBe("Open in Blueprint");
  // Text outside Excalidraw's containers, such as Blueprint's own, is left alone.
  expect(document.querySelector("p")?.textContent).toBe("Built on Excalidraw");

  const dialog = document.createElement("div");
  dialog.className = "excalidraw excalidraw-modal-container";
  dialog.innerHTML = "<h2>Mermaid to Excalidraw</h2>";
  document.body.append(dialog);
  await Promise.resolve();
  expect(dialog.textContent).toBe("Mermaid to Blueprint");

  stop();
  dialog.innerHTML = "<h2>Excalidraw</h2>";
  await Promise.resolve();
  expect(dialog.textContent).toBe("Excalidraw");
});
