import { resetMockProfiles } from "../mocks/profiles";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { setupServer } from "msw/node";
import { handlers, resetMockSession } from "../mocks/handlers";
import { setCsrfToken } from "../shared/api/client";
import { resetMockOrganizations } from "../mocks/organizations";
import { resetMockModeration } from "../mocks/moderation";
import { resetMockDatabase } from "../mocks/database";
import { resetMockComments } from "../mocks/comments";
import { resetMockMaps } from "../mocks/maps";

export const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetMockSession();
  resetMockProfiles();
  resetMockDatabase();
  resetMockOrganizations();
  resetMockComments();
  resetMockMaps();
  resetMockModeration();
  setCsrfToken();
});
afterAll(() => server.close());
