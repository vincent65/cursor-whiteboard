// Copies Excalidraw's fonts into the UI's public directory so the app serves
// them itself; without them Excalidraw falls back to esm.sh, which breaks
// offline use. index.html points window.EXCALIDRAW_ASSET_PATH at them.
import { cpSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkg = dirname(
  fileURLToPath(import.meta.resolve("@excalidraw/excalidraw")),
);
const dest = fileURLToPath(new URL("../src/ui/public/fonts", import.meta.url));
rmSync(dest, { recursive: true, force: true });
cpSync(join(pkg, "fonts"), dest, { recursive: true });
