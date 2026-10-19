import { RegistrationServices } from "../app/providers";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { delay, http, HttpResponse } from "msw";
import { server } from "./setup";
import { ApiError, request, setCsrfToken } from "../shared/api/client";
import type {
  PublicUser,
  EventPreview,
  Page,
  Registration,
} from "../shared/api/types";
import { switchAccount } from "../entities/session";
import { createEvent } from "../entities/event";
import { EventPage } from "../pages/event";
import { myRegistrationQuery } from "../features/join-event/ui/queries";
import { createHttpRegistrationRepository } from "../entities/registration/api/http-registration-repository";
import { mockId, mockUser } from "../mocks/database";
const repository = createHttpRegistrationRepository(request);
const postRegistration = (eventId: string) =>
  request<Registration>(`/events/${eventId}/registrations`, {
    method: "POST",
    body: "{}",
  });

beforeEach(() =>
  vi
    .spyOn(Date, "now")
    .mockReturnValue(new Date("2026-10-19T00:00:00Z").getTime()),
);
afterEach(() => vi.restoreAllMocks());

async function signIn(id = "user-maria") {
  const session = await switchAccount(id);
  setCsrfToken(session.csrfToken);
}
async function makeEvent() {
  await signIn("user-alex");
  return createEvent({
    title: "Два места на пробежку",
    description: "Бежим вместе по парку в спокойном темпе. Возьмите воду.",
    sport: { sportId: mockId("running") },
    organizer: { type: "USER", id: mockId("user-alex") },
    startsAt: "2026-11-07T18:00:00+03:00",
    location: { city: "Москва", address: "Вход в парк" },
    skillLevel: "ANY",
    eventKind: "ACTIVITY",
    joinMode: "OPEN",
    maxParticipants: 2,
  });
}
function mount(eventId = "82e2dd5f-0000-4000-8000-000000000000") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <RegistrationServices>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/events/${eventId}`]}>
          <Routes>
            <Route path="/events/:eventId" element={<EventPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </RegistrationServices>,
  );
  return client;
}
const details = (id: string) => request<EventPreview>(`/events/${id}`);
const participants = (id: string, page = 0, size = 12) =>
  request<Page<PublicUser>>(
    `/events/${id}/participants?page=${page}&size=${size}`,
  );

describe("S3 OPEN API", () => {
  it("confirms once, persists user identity, and updates counts for participant and organizer", async () => {
    const event = await makeEvent();
    await signIn();
    const joined = await request<Registration>(
      `/events/${event.id}/registrations`,
      {
        method: "POST",
        body: "{}",
      },
    );
    expect(joined).toMatchObject({
      status: "CONFIRMED",
      user: { id: mockId("user-maria"), displayName: "Мария" },
    });
    expect(await details(event.id)).toMatchObject({
      confirmedCount: 1,
      viewerRegistrationStatus: "CONFIRMED",
    });
    await expect(postRegistration(event.id)).rejects.toMatchObject({
      status: 409,
      body: { code: "ALREADY_REGISTERED" },
    });
    await signIn("user-alex");
    expect(await details(event.id)).toMatchObject({
      confirmedCount: 1,
      viewerIsOrganizer: true,
      viewerRegistrationStatus: null,
    });
    expect((await participants(event.id)).items).toEqual([
      mockUser("user-maria", "Мария"),
    ]);
    await signIn();
    expect(await request(`/events/${event.id}/my-registration`)).toEqual(
      joined,
    );
  });

  it("returns no own registration as null and keeps real server errors", async () => {
    await signIn();
    const client = new QueryClient();
    expect(
      await client.fetchQuery(
        myRegistrationQuery(
          repository,
          "82e2dd5f-0000-4000-8000-000000000000",
          "user-maria",
        ),
      ),
    ).toBeNull();
    server.use(
      http.get(
        "/api/v1/events/82e2dd5f-0000-4000-8000-000000000000/my-registration",
        () => HttpResponse.json({}, { status: 503 }),
      ),
    );
    await expect(
      client.fetchQuery(
        myRegistrationQuery(
          repository,
          "82e2dd5f-0000-4000-8000-000000000000",
          "user-maria",
        ),
      ),
    ).rejects.toMatchObject({ code: "unavailable" });
  });

  it("protects guest, CSRF, organizer, missing event and APPROVAL boundaries", async () => {
    await expect(
      postRegistration("82e2dd5f-0000-4000-8000-000000000000"),
    ).rejects.toMatchObject({
      status: 401,
    });
    await signIn();
    setCsrfToken("expired");
    await expect(
      postRegistration("82e2dd5f-0000-4000-8000-000000000000"),
    ).rejects.toMatchObject({
      status: 403,
    });
    await signIn();
    await expect(postRegistration("missing")).rejects.toMatchObject({
      status: 404,
    });
    expect(
      await postRegistration("6d69380d-0000-4000-8000-000000000000"),
    ).toMatchObject({ status: "PENDING" });
  });

  it("enforces capacity and deduplicates concurrent duplicate requests at the last spot", async () => {
    const event = await makeEvent();
    await signIn();
    await postRegistration(event.id);
    await signIn("admin");
    const results = await Promise.allSettled([
      postRegistration(event.id),
      postRegistration(event.id),
    ]);
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(results.filter((item) => item.status === "rejected")).toHaveLength(
      1,
    );
    await signIn("org-run");
    await expect(postRegistration(event.id)).rejects.toMatchObject({
      status: 409,
      body: { code: "EVENT_FULL" },
    });
    expect(await details(event.id)).toMatchObject({
      confirmedCount: 2,
      maxParticipants: 2,
    });
    expect((await participants(event.id)).total).toBe(2);
    const available = await request<Page<EventPreview>>(
      `/events?q=${encodeURIComponent(event.title)}&hasSpots=true`,
    );
    expect(available.items).toHaveLength(0);
  });

  it("closes started events without erasing an earlier confirmed registration", async () => {
    await signIn();
    await postRegistration("82e2dd5f-0000-4000-8000-000000000000");
    vi.mocked(Date.now).mockReturnValue(
      new Date("2026-11-01T00:00:00Z").getTime(),
    );
    expect(await details("82e2dd5f-0000-4000-8000-000000000000")).toMatchObject(
      {
        status: "PUBLISHED",
        viewerRegistrationStatus: "CONFIRMED",
      },
    );
    await signIn("user-alex");
    await expect(
      postRegistration("82e2dd5f-0000-4000-8000-000000000000"),
    ).rejects.toMatchObject({
      status: 409,
      body: { code: "EVENT_NOT_AVAILABLE" },
    });
  });

  it("has a consistent seeded participant list and working pagination", async () => {
    const event = await details("82e2dd5f-0000-4000-8000-000000000000");
    const page = await participants(
      "82e2dd5f-0000-4000-8000-000000000000",
      1,
      3,
    );
    expect(page).toMatchObject({
      page: 1,
      size: 3,
      total: event.confirmedCount,
    });
    expect(page.items).toHaveLength(3);
    expect(
      (await participants("82e2dd5f-0000-4000-8000-000000000000", 0, 3)).items,
    ).not.toEqual(page.items);
    await expect(participants("missing")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("S3 participation UI", () => {
  it("does not confirm a successful HTTP response for a different account", async () => {
    await signIn();
    server.use(
      http.post(
        "/api/v1/events/82e2dd5f-0000-4000-8000-000000000000/registrations",
        () =>
          HttpResponse.json(
            {
              id: "wrong-registration",
              eventId: "82e2dd5f-0000-4000-8000-000000000000",
              user: mockUser("admin", "Администратор"),
              status: "CONFIRMED",
              createdAt: "2026-10-19T12:00:00Z",
              updatedAt: "2026-10-19T12:00:00Z",
            },
            { status: 201 },
          ),
      ),
    );
    mount();
    await userEvent.click(
      await screen.findByRole("button", { name: "Присоединиться" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Не удалось подтвердить данные сервера",
    );
    expect(screen.queryByText("Вы участвуете")).not.toBeInTheDocument();
    expect(await screen.findByText("8 из 15 участников")).toBeInTheDocument();
  });
  it("shows login for a guest and allows public participant viewing", async () => {
    mount();
    expect(
      await screen.findByRole("link", { name: "Войти для записи" }),
    ).toHaveAttribute(
      "href",
      "/login?next=join-event&eventId=82e2dd5f-0000-4000-8000-000000000000",
    );
    expect(
      await screen.findByRole("list", { name: "Кто идёт" }),
    ).toBeInTheDocument();
  });

  it("waits for API success, retries failure, and refreshes participants and event count", async () => {
    await signIn();
    server.use(
      http.post(
        "/api/v1/events/82e2dd5f-0000-4000-8000-000000000000/registrations",
        async () => {
          await delay(150);
          return HttpResponse.json({}, { status: 503 });
        },
      ),
    );
    mount();
    await userEvent.click(
      await screen.findByRole("button", { name: "Присоединиться" }),
    );
    expect(
      await screen.findByRole("button", { name: "Записываем…" }),
    ).toBeDisabled();
    expect(screen.queryByText("Вы участвуете")).not.toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Сервис временно недоступен",
    );
    server.resetHandlers();
    await userEvent.click(
      screen.getByRole("button", { name: "Присоединиться" }),
    );
    expect(await screen.findByText("Вы участвуете")).toBeInTheDocument();
    expect(await screen.findByText("9 из 15 участников")).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Кто идёт" })).getByText("Мария"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Присоединиться" }),
    ).not.toBeInTheDocument();
  });

  it("recovers from an already-registered conflict without inserting a duplicate", async () => {
    await signIn();
    mount();
    const button = await screen.findByRole("button", {
      name: "Присоединиться",
    });
    await postRegistration("82e2dd5f-0000-4000-8000-000000000000");
    await userEvent.click(button);
    expect(await screen.findByText("Вы участвуете")).toBeInTheDocument();
    expect(
      (await participants("82e2dd5f-0000-4000-8000-000000000000")).items.filter(
        (item) => item.id === mockId("user-maria"),
      ),
    ).toHaveLength(1);
  });

  it("does not join while own-registration lookup fails and offers retry", async () => {
    await signIn();
    server.use(
      http.get(
        "/api/v1/events/82e2dd5f-0000-4000-8000-000000000000/my-registration",
        () => HttpResponse.json({}, { status: 503 }),
      ),
    );
    mount();
    expect(
      await screen.findByRole("button", { name: "Повторить проверку участия" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Присоединиться" }),
    ).not.toBeInTheDocument();
    server.resetHandlers();
    await userEvent.click(
      screen.getByRole("button", { name: "Повторить проверку участия" }),
    );
    expect(
      await screen.findByRole("button", { name: "Присоединиться" }),
    ).toBeInTheDocument();
  });

  it("supports participant error/retry independently of the join action", async () => {
    await signIn();
    server.use(
      http.get(
        "/api/v1/events/82e2dd5f-0000-4000-8000-000000000000/participants",
        () => HttpResponse.json({}, { status: 503 }),
      ),
    );
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Сервис временно недоступен",
    );
    expect(
      await screen.findByRole("button", { name: "Присоединиться" }),
    ).toBeInTheDocument();
    server.resetHandlers();
    await userEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(
      await screen.findByRole("list", { name: "Кто идёт" }),
    ).toBeInTheDocument();
  });

  it("keeps confirmed participation visible on a past event", async () => {
    await signIn();
    await postRegistration("82e2dd5f-0000-4000-8000-000000000000");
    vi.mocked(Date.now).mockReturnValue(
      new Date("2026-11-01T00:00:00Z").getTime(),
    );
    mount();
    expect(await screen.findByText("Вы участвуете")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Присоединиться" }),
      ).not.toBeInTheDocument(),
    );
  });
});
