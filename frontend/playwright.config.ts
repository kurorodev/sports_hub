import { familiarVisitorState } from "./e2e/helpers/site-onboarding";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  outputDir: "test-results/mock",
  testDir: "./e2e",
  testIgnore: "**/api/**",
  fullyParallel: true,
  use: {
    storageState: familiarVisitorState,
    baseURL: "http://127.0.0.1:5175",
    trace: "retain-on-failure",
    // Для карты в CI нужен программный WebGL-рендерер Chromium.
    launchOptions: {
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev:mock -- --host 127.0.0.1 --port 5175 --strictPort",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: false,
  },
});
