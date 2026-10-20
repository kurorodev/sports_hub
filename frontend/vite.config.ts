import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { loadEnv } from "vite";
import branding from "../branding.json";

const htmlName = branding.name.replace(/[&<>"']/g, (character) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "API_");
  const proxy = { "/api/v1": env.API_PROXY_TARGET || "http://127.0.0.1:8080" };
  return {
    define: {
      "import.meta.env.VITE_APP_NAME": JSON.stringify(branding.name),
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "app-branding",
        transformIndexHtml: (html) => html.replaceAll("__APP_NAME__", () => htmlName),
      },
    ],
    server: {
      host: "0.0.0.0",
      port: 3000,
      strictPort: true,
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
