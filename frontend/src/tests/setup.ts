import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { setupServer } from "msw/node";
import { handlers, resetMockSession } from "../mocks/handlers";
import { setCsrfToken } from "../shared/api/client";
import { resetMockDatabase } from "../mocks/database";

export const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetMockSession();
  resetMockDatabase();
  setCsrfToken();
});
afterAll(() => server.close());
