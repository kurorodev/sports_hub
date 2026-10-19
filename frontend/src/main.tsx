import React from "react";
import ReactDOM from "react-dom/client";
import { ApplicationProviders } from "./app/providers";
import { RouterProvider } from "react-router-dom";
import "@fontsource-variable/manrope";
import "./shared/styles/index.css";
import { apiConfig } from "./shared/api/client";
import { router } from "./app/router";

async function start() {
  if (apiConfig.mode === "mock") {
    const { worker } = await import("./mocks/browser");
    await worker.start({
      onUnhandledRequest(request, print) {
        if (new URL(request.url).pathname.startsWith("/api/")) print.error();
      },
    });
  }
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ApplicationProviders>
        <RouterProvider router={router} />
      </ApplicationProviders>
    </React.StrictMode>,
  );
}
start().catch(() => {
  const root = document.getElementById("root")!;
  root.textContent =
    "Не удалось запустить приложение. Проверьте конфигурацию API и обновите страницу.";
});
