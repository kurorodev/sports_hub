import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { server } from "./setup";
import {
  ModerationServices,
  RegistrationServices,
  DiscussionServices,
} from "../app/providers";
import { switchAccount, sessionQuery } from "../entities/session";
import { createEvent } from "../entities/event";
import { request, setCsrfToken } from "../shared/api/client";
import { getEvents, mockId, makeSession } from "../mocks/database";
import { getModerationRecords } from "../mocks/moderation";
import { resetMockSession } from "../mocks/handlers";
import { AdminEvents, AdminComments } from "../features/moderate-content";
import { EventPage } from "../pages/event";
import { ModerationRepositoryProvider } from "../entities/moderation";
import { ModerationEventCard } from "../features/moderate-content/ui/ModerationEventCard";
import { readModerationEvent } from "../entities/moderation/api/mappers";
import type {
  ModerationRepository,
  ModerationEvent,
} from "../entities/moderation/model";
import type {
  EventPreview,
  CommentDto,
  Page,
  Registration,
} from "../shared/api/types";

async function login(id = "user-alex") {
  const session = await switchAccount(id);
  setCsrfToken(session.csrfToken);
  return session;
}
async function event() {
  const session = await login();
  return createEvent({
    title: "Тренировка для модерации",
    description: "Совместная пробежка для начинающих у входа в парк.",
    sport: { sportId: mockId("running") },
    startsAt: "2026-12-01T12:00:00Z",
    location: { city: "Москва", address: "Парк" },
    skillLevel: "ANY",
    eventKind: "ACTIVITY",
    joinMode: "OPEN",
    maxParticipants: 10,
    organizer: { type: "USER", id: session.user.id },
  });
}
const postComment = (id: string, text: string) =>
  request<CommentDto>(`/events/${id}/comments`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
const hide = (
  id: string,
  body: unknown = { reason: "Некорректное сообщение" },
) =>
  request<CommentDto>(`/admin/comments/${id}/hide`, {
    method: "POST",
    body: JSON.stringify(body),
  });
const unpublish = (
  id: string,
  body: unknown = { reason: "Неподходящие условия встречи" },
) =>
  request<EventPreview>(`/admin/events/${id}/unpublish`, {
    method: "POST",
    body: JSON.stringify(body),
  });
function mount(
  ui: React.ReactNode,
  path = "/admin?section=events",
  account = "admin",
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  if (account) client.setQueryData(sessionQuery.queryKey, makeSession(account));
  render(
    <ModerationServices>
      <RegistrationServices>
        <DiscussionServices>
          <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
          </QueryClientProvider>
        </DiscussionServices>
      </RegistrationServices>
    </ModerationServices>,
  );
  return client;
}
describe("S6 stateful mocks", () => {
  it("hides only one comment, preserves others, records reasons and keeps registrations after unpublish", async () => {
    const e = await event();
    await login("user-maria");
    const registration = await request<Registration>(
      `/events/${e.id}/registrations`,
      { method: "POST", body: "{}" },
    );
    const comment = await postComment(e.id, "Удаляемое сообщение");
    const keep = await postComment(e.id, "Полезный вопрос");
    await login("admin");
    expect((await hide(comment.id)).status).toBe("HIDDEN");
    expect(
      (await request<Page<CommentDto>>(`/admin/comments?eventId=${e.id}`))
        .items,
    ).toHaveLength(2);
    await expect(hide(comment.id)).rejects.toMatchObject({ status: 409 });
    await login("user-maria");
    expect(
      (await request<Page<CommentDto>>(`/events/${e.id}/comments`)).items.map(
        (item) => item.id,
      ),
    ).toEqual([keep.id]);
    await login("admin");
    const unpublished = await unpublish(e.id);
    expect(unpublished).toMatchObject({
      status: "UNPUBLISHED",
      moderationReason: null,
      confirmedCount: 1,
    });
    expect(
      (
        await request<Page<EventPreview>>(
          `/events?q=${encodeURIComponent(e.title)}&includePast=true`,
        )
      ).items,
    ).toHaveLength(0);
    await expect(unpublish(e.id)).rejects.toMatchObject({ status: 409 });
    await login("user-maria");
    expect(await request(`/events/${e.id}`)).toMatchObject({
      status: "UNPUBLISHED",
      moderationReason: unpublished.moderationReason,
    });
    expect(await request(`/events/${e.id}/my-registration`)).toMatchObject({
      id: registration.id,
      status: "CONFIRMED",
    });
    await expect(postComment(e.id, "После снятия")).rejects.toMatchObject({
      status: 409,
    });
    await login();
    expect(await request(`/events/${e.id}`)).toMatchObject({
      viewerIsOrganizer: true,
      status: "UNPUBLISHED",
    });
    await login("org-run");
    await expect(request(`/events/${e.id}`)).rejects.toMatchObject({
      status: 404,
    });
    await expect(request(`/events/${e.id}/team`)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      request(`/events/${e.id}/registrations`, { method: "POST", body: "{}" }),
    ).rejects.toMatchObject({
      status: 409,
      body: { code: "EVENT_NOT_AVAILABLE" },
    });
    resetMockSession();
    setCsrfToken();
    await expect(request(`/events/${e.id}`)).rejects.toMatchObject({
      status: 404,
    });
    expect(getModerationRecords().map((item) => item.kind)).toEqual([
      "COMMENT",
      "EVENT",
    ]);
  });
  it("enforces ADMIN, CSRF and valid reasons independently of UI", async () => {
    const e = await event();
    const comment = await postComment(e.id, "Текст");
    await expect(unpublish(e.id)).rejects.toMatchObject({ status: 403 });
    await expect(hide(comment.id)).rejects.toMatchObject({ status: 403 });
    await expect(request("/admin/events")).rejects.toMatchObject({
      status: 403,
    });
    await expect(request("/admin/comments")).rejects.toMatchObject({
      status: 403,
    });
    resetMockSession();
    setCsrfToken();
    await expect(unpublish(e.id)).rejects.toMatchObject({ status: 401 });
    await login("admin");
    setCsrfToken("old");
    await expect(hide(comment.id)).rejects.toMatchObject({ status: 403 });
    await login("admin");
    for (const body of [
      {},
      { reason: " " },
      { reason: "aa" },
      { reason: "a".repeat(1001) },
      { reason: "Причина", status: "UNPUBLISHED" },
    ])
      await expect(unpublish(e.id, body)).rejects.toMatchObject({
        status: 400,
      });
    expect(getEvents().find((item) => item.id === e.id)?.status).toBe(
      "PUBLISHED",
    );
    expect(getModerationRecords()).toHaveLength(0);
  });
  it("filters admin events and paginates event discussions without cross-event leakage", async () => {
    const e = await event();
    for (let i = 0; i < 11; i++) await postComment(e.id, `Сообщение ${i}`);
    await login("admin");
    expect(
      (
        await request<Page<EventPreview>>(
          `/admin/events?q=${encodeURIComponent(e.title)}&status=PUBLISHED`,
        )
      ).items.map((item) => item.id),
    ).toEqual([e.id]);
    const page = await request<Page<CommentDto>>(
      `/admin/comments?eventId=${e.id}&page=1&size=10`,
    );
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(11);
    expect(page.items[0].eventId).toBe(e.id);
  });
});
describe("moderation UI", () => {
  it("waits for session recovery before caching a private event", async () => {
    const e = await event();
    await login("user-maria");
    await request(`/events/${e.id}/registrations`, {
      method: "POST",
      body: "{}",
    });
    await login("admin");
    await unpublish(e.id);
    const session = await login("user-maria");
    let release = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reads = 0;
    server.use(
      http.get("/api/v1/session", async () => {
        await pending;
        return HttpResponse.json(session);
      }),
      http.get(`/api/v1/events/${e.id}`, () => {
        reads++;
        return HttpResponse.json(
          getEvents(session.user.id).find((item) => item.id === e.id),
        );
      }),
    );
    const client = mount(
      <Routes>
        <Route path="/events/:eventId" element={<EventPage />} />
      </Routes>,
      `/events/${e.id}`,
      "",
    );
    try {
      await waitFor(() =>
        expect(screen.getByRole("status")).toBeInTheDocument(),
      );
      expect(reads).toBe(0);
      await act(async () => {
        release();
        await pending;
      });
      expect(
        await screen.findByText("Запись закрыта · Снято с публикации"),
      ).toBeVisible();
      expect(
        screen.queryByText("Неподходящие условия встречи"),
      ).not.toBeInTheDocument();
      expect(reads).toBe(1);
      expect(
        client.getQueryData(["events", "detail", e.id, "guest"]),
      ).toBeUndefined();
    } finally {
      release();
    }
  });
  it("preserves a discussion draft if background event polling fails", async () => {
    const e = await event();
    const client = mount(
      <Routes>
        <Route path="/events/:eventId" element={<EventPage />} />
      </Routes>,
      `/events/${e.id}`,
      "user-alex",
    );
    const field = await screen.findByRole("textbox", {
      name: "Ваше сообщение",
    });
    await userEvent.type(field, "Мой вопрос к встрече");
    server.use(
      http.get(`/api/v1/events/${e.id}`, () =>
        HttpResponse.json({}, { status: 503 }),
      ),
    );
    await act(async () => {
      await client.refetchQueries({ queryKey: ["events", "detail", e.id] });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "введённый текст сохранён",
    );
    expect(screen.getByRole("textbox", { name: "Ваше сообщение" })).toHaveValue(
      "Мой вопрос к встрече",
    );
    server.resetHandlers();
    await userEvent.click(
      screen.getByRole("button", { name: "Обновить состояние встречи" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("textbox", { name: "Ваше сообщение" })).toHaveValue(
      "Мой вопрос к встрече",
    );
  });
  it("requires confirmation/reason, blocks duplicates and preserves text on failure and retry", async () => {
    const e = await event();
    await login("admin");
    server.use(
      http.post(`/api/v1/admin/events/${e.id}/unpublish`, async () => {
        await delay(150);
        return HttpResponse.json({}, { status: 503 });
      }),
    );
    mount(<AdminEvents viewerId={mockId("admin")} />);
    const row = await screen.findByRole("article", {
      name: `Мероприятие: ${e.title}`,
    });
    const user = userEvent.setup();
    await user.click(
      within(row).getByRole("button", { name: "Снять с публикации" }),
    );
    expect(screen.getByLabelText("Причина модерации")).toHaveFocus();
    await user.click(
      screen.getByRole("button", { name: "Подтвердить: снять с публикации" }),
    );
    expect(
      await screen.findByText("Укажите причину: от 3 символов"),
    ).toBeVisible();
    expect(getModerationRecords()).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Отмена" }));
    expect(
      within(row).getByRole("button", { name: "Снять с публикации" }),
    ).toHaveFocus();
    await user.click(
      within(row).getByRole("button", { name: "Снять с публикации" }),
    );
    await user.type(
      screen.getByLabelText("Причина модерации"),
      "Неподходящее описание",
    );
    await user.dblClick(
      screen.getByRole("button", { name: "Подтвердить: снять с публикации" }),
    );
    expect(
      screen.getByRole("button", { name: "Сохраняем решение…" }),
    ).toBeDisabled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Причина сохранена",
    );
    expect(screen.getByLabelText("Причина модерации")).toHaveValue(
      "Неподходящее описание",
    );
    expect(getModerationRecords()).toHaveLength(0);
    server.resetHandlers();
    await user.click(
      screen.getByRole("button", { name: "Подтвердить: снять с публикации" }),
    );
    expect(
      await screen.findByText(/снято с публикации. Решение сохранено/),
    ).toBeVisible();
    await user.selectOptions(
      screen.getByLabelText("Статус мероприятий"),
      "UNPUBLISHED",
    );
    expect(
      await screen.findByRole("article", { name: `Мероприятие: ${e.title}` }),
    ).not.toHaveTextContent("Неподходящее описание");
  });
  it("shows hidden status in admin only and retains other messages", async () => {
    const e = await event();
    await postComment(e.id, "Проверяемый комментарий");
    await postComment(e.id, "Сохраняемый комментарий");
    await login("admin");
    mount(
      <AdminComments viewerId={mockId("admin")} />,
      `/admin?section=comments&eventId=${e.id}`,
    );
    const comments = await screen.findAllByRole("article", {
      name: "Комментарий: Александр",
    });
    await userEvent.click(
      within(comments[0]).getByRole("button", { name: "Скрыть комментарий" }),
    );
    await userEvent.type(
      screen.getByLabelText("Причина модерации"),
      "Некорректная формулировка",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Подтвердить: скрыть комментарий" }),
    );
    expect(await screen.findByText("Скрыт модератором")).toBeVisible();
    expect(screen.getByText("Сохраняемый комментарий")).toBeVisible();
    expect(screen.getByText("Проверяемый комментарий")).toBeVisible();
  });
  it("validates IDs in filter links and recovers by clearing filters", async () => {
    await login("admin");
    mount(
      <AdminComments viewerId={mockId("admin")} />,
      "/admin?section=comments&eventId=invalid",
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "корректный UUID",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Сбросить фильтры" }),
    );
    expect(await screen.findByText(/Найдено комментариев:/)).toBeVisible();
  });
  it("combines named user and event selection with latest ten and 24-hour filters", async () => {
    const e = await event();
    for (let i = 0; i < 12; i++)
      await postComment(e.id, `Комментарий автора ${i}`);
    const other = await event();
    await postComment(other.id, "Другое мероприятие");
    await login("user-maria");
    await postComment(e.id, "Другой пользователь");
    await login("admin");
    mount(<AdminComments viewerId={mockId("admin")} />);
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText("Поиск пользователя по никнейму"),
      "user-alex",
    );
    await screen.findByRole("option", { name: /Александр/ });
    await user.selectOptions(
      screen.getByLabelText("Пользователь", { exact: true }),
      mockId("user-alex"),
    );
    await screen.findAllByRole("option", { name: e.title });
    await user.selectOptions(
      screen.getByLabelText("Мероприятие", { exact: true }),
      e.id,
    );
    await user.click(screen.getByLabelText("Последние 10 комментариев"));
    await user.click(screen.getByLabelText("За последние 24 часа"));
    await waitFor(() =>
      expect(screen.getByText("Найдено комментариев: 10")).toBeVisible(),
    );
    expect(screen.queryByText("Другой пользователь")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Другое мероприятие", {
        selector: ".moderation-text",
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Комментарий автора 0")).not.toBeInTheDocument();
    expect(screen.getByText("Комментарий автора 11")).toBeVisible();
    expect(
      screen.queryByRole("navigation", {
        name: "Страницы модерации комментариев",
      }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
    await waitFor(() =>
      expect(screen.getByText("Найдено комментариев: 14")).toBeVisible(),
    );
  });
  it("keeps existing participation and shows the server reason on direct unpublished access", async () => {
    const e = await event();
    await login("user-maria");
    await request(`/events/${e.id}/registrations`, {
      method: "POST",
      body: "{}",
    });
    await login("admin");
    await unpublish(e.id);
    await login("user-maria");
    mount(
      <Routes>
        <Route path="/events/:eventId" element={<EventPage />} />
      </Routes>,
      `/events/${e.id}`,
      "user-maria",
    );
    expect(
      await screen.findByText("Запись закрыта · Снято с публикации"),
    ).toBeVisible();
    expect(
      screen.queryByText("Неподходящие условия встречи"),
    ).not.toBeInTheDocument();
    expect(await screen.findByText("Вы участвуете")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Присоединиться" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Ваше сообщение" }),
    ).not.toBeInTheDocument();
  });
  it("ignores a late moderation response after account change", async () => {
    const e = readModerationEvent(getEvents()[0]);
    let finish: ((value: ModerationEvent) => void) | undefined;
    const response = new Promise<ModerationEvent>((resolve) => {
      finish = resolve;
    });
    const repo: ModerationRepository = {
      events: vi.fn(),
      comments: vi.fn(),
      unpublish: vi.fn(() => response),
      hide: vi.fn(),
    };
    const client = new QueryClient();
    client.setQueryData(sessionQuery.queryKey, makeSession("admin"));
    const onDone = vi.fn();
    render(
      <ModerationRepositoryProvider repository={repo}>
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <ModerationEventCard
              event={e}
              viewerId={mockId("admin")}
              onDone={onDone}
            />
          </MemoryRouter>
        </QueryClientProvider>
      </ModerationRepositoryProvider>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Снять с публикации" }),
    );
    await userEvent.type(screen.getByLabelText("Причина модерации"), "Причина");
    await userEvent.click(
      screen.getByRole("button", { name: "Подтвердить: снять с публикации" }),
    );
    await act(async () => {
      client.setQueryData(sessionQuery.queryKey, makeSession("user-maria"));
      finish!({ ...e, status: "UNPUBLISHED", reason: "Причина" });
      await response;
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Подтвердить: снять с публикации" }),
      ).toBeEnabled(),
    );
    expect(onDone).not.toHaveBeenCalled();
  });
});
