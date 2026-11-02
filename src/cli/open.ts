import { spawn } from "node:child_process";

// Best effort: a missing opener must never take the server down.
export function openBrowser(url: string): void {
  try {
    const cmd = process.platform === "darwin" ? "open" : "xdg-open";
    const child = spawn(cmd, [url], { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  } catch {}
}
