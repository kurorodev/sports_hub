import { RegistrationServices } from "../app/providers";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { delay, http, HttpResponse } from "msw";
import { server } from "./setup";
import { createEvent } from "../entities/event";
import { CreateEventPage } from "../pages/create-event";
import { EventPage } from "../pages/event";
import { switchAccount } from "../entities/session";
import { request, setCsrfToken } from "../shared/api/client";
import type { EventPreview, Page, Sport } from "../shared/api/types";
import type { CreateEventInput } from "../shared/api/event-schema";

import { mockId } from "../mocks/database";
const input: CreateEventInput = {
  title: "Петанк в парке",
  description: "Играем в петанк, объясним правила и вместе потренируемся.",
  sport: { customName: "Петанк" },
  organizer: { type: "USER", id: mockId("user-alex") },
  startsAt: "2026-11-07T18:30:00+07:00",
  location: { city: "Красноярск", address: "Парк, центральный вход" },
  skillLevel: "ANY",
  eventKind: "ACTIVITY",
  joinMode: "OPEN",
  maxParticipants: 8,
};

async function signIn(id = "user-alex") {
  const session = await switchAccount(id);
  setCsrfToken(session.csrfToken);
}
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <RegistrationServices>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/events/new"]}>
          <Routes>
            <Route path="/events/new" element={<CreateEventPage />} />
            <Route path="/events/:eventId" element={<EventPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </RegistrationServices>,
  );
}
async function fillForm() {
  const user = userEvent.setup();
  await user.type(
    await screen.findByLabelText("Название встречи"),
    input.title,
  );
  await user.selectOptions(screen.getByLabelText("Вид спорта"), "__custom__");
  await user.type(
    screen.getByLabelText("Название нового вида спорта"),
    "Петанк",
  );
  await user.type(screen.getByLabelText("О встрече"), input.description);
  await user.type(screen.getByLabelText("Город"), input.location.city);
  await user.type(
    screen.getByLabelText("Место встречи"),
    input.location.address,
  );
  // Native date/time inputs do not accept localized keyboard typing consistently in jsdom.
  fireEvent.change(screen.getByLabelText("Дата"), {
    target: { value: "2026-11-07" },
  });
  fireEvent.change(screen.getByLabelText("Время"), {
    target: { value: "18:30" },
  });
  await user.selectOptions(
    screen.getByLabelText("Часовой пояс места встречи"),
    "+07:00",
  );
  return user;
}

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(
    new Date("2026-10-19T00:00:00Z").getTime(),
  );
});
afterEach(() => vi.restoreAllMocks());

describe("S1 mock API", () => {
  it("publishes a new sport and event visible to another account with correct ownership", async () => {
    await signIn();
    const created = await createEvent(input);
    expect(created).toMatchObject({
      status: "PUBLISHED",
      confirmedCount: 0,
      viewerIsOrganizer: true,
      startsAt: input.startsAt,
    });
    await signIn("user-maria");
    const catalog = await request<Page<EventPreview>>(
      `/events?sportId=${created.sport.id}`,
    );
    expect(catalog.items).toHaveLength(1);
    expect(catalog.items[0]).toMatchObject({
      id: created.id,
      organizer: { name: "Александр", type: "USER" },
    });
    expect(await request<Sport[]>("/sports")).toContainEqual(created.sport);
    expect((await request<EventPreview>(`/events/${created.id}`)).title).toBe(
      input.title,
    );
  });

  it("reuses an existing sport regardless of name case/spacing", async () => {
    await signIn();
    const first = await createEvent(input);
    const second = await createEvent({
      ...input,
      sport: { customName: "  пЕТАНК  " },
    });
    expect(second.sport.id).toBe(first.sport.id);
    expect(
      (await request<Sport[]>("/sports")).filter(
        (sport) => sport.id === first.sport.id,
      ),
    ).toHaveLength(1);
  });

  it("sorts actual instants across timezone offsets and retains the original wall time", async () => {
    await signIn();
    const later = await createEvent({
      ...input,
      startsAt: "2026-11-07T15:00:00+03:00",
    });
    const earlier = await createEvent({
      ...input,
      startsAt: "2026-11-07T18:30:00+07:00",
    });
    const page = await request<Page<EventPreview>>(
      `/events?sportId=${earlier.sport.id}&sort=startsAt,asc`,
    );
    expect(page.items.map((event) => event.id)).toEqual([earlier.id, later.id]);
    expect(page.items[0].startsAt).toBe("2026-11-07T18:30:00+07:00");
  });

  it("rejects a forged organizer and accepts the signed-in owner", async () => {
    await signIn();
    await expect(
      createEvent({
        ...input,
        organizer: { type: "USER", id: mockId("user-maria") },
      }),
    ).rejects.toMatchObject({ status: 403 });
    const created = await createEvent({
      ...input,
      sport: { sportId: mockId("running") },
    });
    expect(created.sport.id).toBe(mockId("running"));
    expect(created.organizer).toMatchObject({
      name: "Александр",
      type: "USER",
      id: mockId("user-alex"),
    });
    expect(created.confirmedCount).toBe(0);
  });

  it("rejects guests and stale CSRF before writing any records", async () => {
    await expect(createEvent(input)).rejects.toMatchObject({ status: 401 });
    await signIn();
    setCsrfToken("stale-token");
    await expect(createEvent(input)).rejects.toMatchObject({ status: 403 });
    expect(await request<Sport[]>("/sports")).toHaveLength(4);
  });

  it.each([
    { patch: { title: "  " }, field: "title" },
    { patch: { maxParticipants: 0 }, field: "maxParticipants" },
    { patch: { startsAt: "2026-10-18T23:00:00+07:00" }, field: "startsAt" },
    { patch: { sport: { customName: " " } }, field: "sport" },
    {
      patch: { sport: { sportId: mockId("unknown") } },
      field: "sport.sportId",
    },
  ])(
    "validates $field on the server without creating a sport",
    async ({ patch, field }) => {
      await signIn();
      await expect(createEvent({ ...input, ...patch })).rejects.toMatchObject({
        status: 422,
        body: {
          details: expect.arrayContaining([
            expect.objectContaining({
              field: expect.stringContaining(field),
              message: expect.any(String),
            }),
          ]),
        },
      });
      expect(await request<Sport[]>("/sports")).toHaveLength(4);
    },
  );
});

describe("S1 creation UI", () => {
  it("asks a guest to sign in and preserves the creation destination", async () => {
    mount();
    expect(
      await screen.findByRole("link", { name: "Войти и создать" }),
    ).toHaveAttribute("href", "/login?next=create-event");
  });

  it("shows client validation before sending a request", async () => {
    await signIn();
    mount();
    const button = await screen.findByRole("button", {
      name: "Опубликовать встречу",
    });
    await userEvent.click(button);
    expect(
      await screen.findByText("Название — от 3 символов"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Название встречи")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(await request<Sport[]>("/sports")).toHaveLength(4);
  });

  it("preserves form data on server failure, prevents double submission and succeeds after retry", async () => {
    await signIn();
    server.use(
      http.post("/api/v1/events", async () => {
        await delay(120);
        return HttpResponse.json({}, { status: 503 });
      }),
    );
    mount();
    const user = await fillForm();
    await user.click(
      screen.getByRole("button", { name: "Опубликовать встречу" }),
    );
    expect(
      await screen.findByRole("button", { name: "Публикуем…" }),
    ).toBeDisabled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Данные формы сохранены",
    );
    expect(screen.getByLabelText("Название встречи")).toHaveValue(input.title);
    server.resetHandlers();
    await user.click(
      screen.getByRole("button", { name: "Опубликовать встречу" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        input.title,
      ),
    );
    expect(screen.getByText("Встреча опубликована")).toBeInTheDocument();
    expect(screen.getByText("Вы организатор")).toBeInTheDocument();
  });

  it("attaches server validation to its field and retains entered values", async () => {
    await signIn();
    server.use(
      http.post("/api/v1/events", () =>
        HttpResponse.json(
          {
            code: "VALIDATION_ERROR",
            message: "Проверьте поля",
            requestId: "test",
            details: [
              {
                field: "location.address",
                message: "Площадка недоступна, укажите другую",
              },
            ],
          },
          { status: 422 },
        ),
      ),
    );
    mount();
    const user = await fillForm();
    await user.click(
      screen.getByRole("button", { name: "Опубликовать встречу" }),
    );
    expect(
      await screen.findByText("Площадка недоступна, укажите другую"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Место встречи")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("Название встречи")).toHaveValue(input.title);
  });
});
