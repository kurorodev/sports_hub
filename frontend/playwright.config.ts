import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  outputDir: "test-results/mock",
  testDir: "./e2e",
  testIgnore: "**/api/**",
  fullyParallel: true,
  use: { baseURL: "http://127.0.0.1:5175", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev:mock -- --host 127.0.0.1 --port 5175 --strictPort",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: false,
  },
});
