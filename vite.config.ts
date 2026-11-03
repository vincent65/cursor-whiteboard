import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "src/ui",
  plugins: [react()],
  // Excalidraw reads this at runtime to pick its React flavor.
  define: { "process.env.IS_PREACT": JSON.stringify("false") },
  build: { outDir: "../../dist/ui", emptyOutDir: true },
  server: {
    proxy: {
      // Object form: the string shorthand sets changeOrigin, which rewrites Host
      // to the API port and makes the server's same-origin check refuse writes.
      "/api/": { target: "http://localhost:4242", changeOrigin: false },
      "/ws": { target: "ws://localhost:4242", ws: true },
    },
  },
});
