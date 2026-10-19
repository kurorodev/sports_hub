import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./setup";
import { CatalogPage } from "../pages/catalog";
import { WorkspacePage } from "../pages/workspace";
import { sessionQuery, switchAccount } from "../entities/session";
import { ApiError, request, setCsrfToken } from "../shared/api/client";
import { eventDate } from "../entities/event";
import type { Page, EventPreview } from "../shared/api/types";

function mount(ui: React.ReactNode, path = "/") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

describe("P0 shell and catalog", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(
      new Date("2026-10-19T00:00:00Z").getTime(),
    );
  });
  afterEach(() => vi.restoreAllMocks());
  it("restores switched sessions with server role data", async () => {
    const client = new QueryClient();
    expect(await client.fetchQuery(sessionQuery)).toBeNull();
    const admin = await switchAccount("admin");
    expect(admin.systemRoles).toContain("ADMIN");
    expect((await client.fetchQuery(sessionQuery))?.user.id).toBe(
      admin.user.id,
    );
    const organization = await switchAccount("org-run");
    expect(
      (await client.fetchQuery(sessionQuery))?.manageableOrganizationIds,
    ).toEqual(organization.manageableOrganizationIds);
  });

  it("rejects an unknown demo account", async () => {
    await expect(switchAccount("unknown")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("preserves location filters and excludes full events when requested", async () => {
    const page = await request<Page<EventPreview>>(
      "/events?city=Москва&hasSpots=true&includePast=true",
    );
    expect(page.items.length).toBeGreaterThan(0);
    expect(
      page.items.every(
        (event) =>
          event.location.city === "Москва" &&
          (event.maxParticipants == null ||
            event.confirmedCount < event.maxParticipants),
      ),
    ).toBe(true);
    const secondPage = await request<Page<EventPreview>>(
      "/events?includePast=true&size=2&page=1",
    );
    expect(secondPage.page).toBe(1);
    expect(secondPage.items).toHaveLength(2);
  });

  it("loads a direct filtered URL and resets an empty search", async () => {
    mount(<CatalogPage />, "/?q=неттакогоспорта&includePast=true");
    expect(await screen.findByText("Пока без совпадений")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Сбросить фильтры" }),
    );
    expect(
      await screen.findByRole("heading", { name: /Утро. Парк. Лёгкий бег/ }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Шахматы" }));
    expect(
      await screen.findByRole("heading", { name: /Твой ход/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Лёгкий бег/ }),
    ).not.toBeInTheDocument();
  });

  it("offers retry after an API failure", async () => {
    server.use(
      http.get("/api/v1/events", () => HttpResponse.json({}, { status: 503 })),
    );
    mount(<CatalogPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Сервис временно недоступен",
    );
    server.resetHandlers();
    await userEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(
      await screen.findByRole("heading", { name: /Лёгкий бег/ }),
    ).toBeInTheDocument();
  });

  it("denies admin route access for an ordinary user", async () => {
    await switchAccount("user-alex");
    mount(<WorkspacePage />);
    expect(
      await screen.findByRole("heading", { name: "Нет доступа" }),
    ).toBeInTheDocument();
  });

  it("uses credentials and CSRF in the shared transport", async () => {
    let observed: Request | undefined;
    server.use(
      http.patch("/api/v1/test-csrf", ({ request: incoming }) => {
        observed = incoming;
        return HttpResponse.json({ ok: true });
      }),
    );
    setCsrfToken("token-from-session");
    await request("/test-csrf", { method: "PATCH", body: "{}" });
    expect(observed?.credentials).toBe("include");
    expect(observed?.headers.get("X-CSRF-Token")).toBe("token-from-session");
  });

  it("preserves event wall time and distinguishes a 404", async () => {
    expect(eventDate("2026-10-24T09:00:00+03:00")).toBe("24 октября · 09:00");
    await expect(request("/events/missing")).rejects.toBeInstanceOf(ApiError);
    await expect(request("/events/missing")).rejects.toMatchObject({
      status: 404,
    });
  });
});
