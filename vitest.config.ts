import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    setupFiles: ["test/setup.ts"],
    // Excalidraw's dist imports `roughjs/bin/rough` without an extension, which
    // Node's ESM resolver refuses; let Vite resolve it instead.
    server: { deps: { inline: ["@excalidraw/excalidraw"] } },
  },
});
