import { defineConfig } from "@playwright/test";

const viewport = { width: 1280, height: 800 };

export default defineConfig({
  testDir: "e2e",
  // Each test starts its own server in its own repository.
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    browserName: "chromium",
    viewport,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "e2e" },
    // Records each flow, slowed so a viewer can follow; the spec saves the videos to docs/demo/.
    {
      name: "demo",
      use: {
        video: { mode: "on", size: viewport },
        launchOptions: { slowMo: 250 },
      },
    },
  ],
});
