import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "API_");
  const proxy = { "/api/v1": env.API_PROXY_TARGET || "http://127.0.0.1:8080" };
  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: "0.0.0.0",
      proxy,
    },
    preview: { host: "0.0.0.0", proxy },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/tests/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
    },
  };
});
