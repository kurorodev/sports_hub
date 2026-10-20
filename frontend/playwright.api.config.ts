import { familiarVisitorState } from "./e2e/helpers/site-onboarding";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  outputDir: "test-results/api",
  testDir: "./e2e/api",
  workers: 1,
  use: {
    storageState: familiarVisitorState,
    baseURL: "http://127.0.0.1:5174",
    serviceWorkers: "block",
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
  projects: [{ name: "chromium-java", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev:real -- --host 127.0.0.1 --port 5174 --strictPort",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
  },
});
