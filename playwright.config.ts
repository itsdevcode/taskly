import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:1421",
    viewport: { width: 1180, height: 780 },
  },
  webServer: {
    command: "pnpm exec vite preview --host 127.0.0.1 --port 1421 --strictPort",
    url: "http://127.0.0.1:1421",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
