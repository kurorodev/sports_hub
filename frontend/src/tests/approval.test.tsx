import { RegistrationServices, DiscussionServices } from "../app/providers";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { server } from "./setup";
import { mockId } from "../mocks/database";
import { switchAccount } from "../entities/session";
import { createEvent } from "../entities/event";
import { EventPage } from "../pages/event";
import { request, setCsrfToken } from "../shared/api/client";
import type {
  Registration,
  Page,
  EventPreview,
  PublicUser,
} from "../shared/api/types";

beforeEach(() =>
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-19T00:00:00Z")),
);
afterEach(() => vi.restoreAllMocks());
async function login(account = "user-alex") {
  const session = await switchAccount(account);
  setCsrfToken(session.csrfToken);
  return session;
}
async function event() {
  await login();
  return createEvent({
    title: "Шахматы по заявке",
    description: "Играем вместе и изучаем новые приёмы. Приходите знакомиться.",
    sport: { sportId: mockId("chess") },
    startsAt: "2026-11-07T18:00:00+03:00",
    location: { city: "Москва", address: "Библиотека" },
    skillLevel: "ANY",
    eventKind: "ACTIVITY",
    joinMode: "APPROVAL",
    maxParticipants: 2,
    organizer: { type: "USER", id: mockId("user-alex") },
  });
}
const apply = (id: string) =>
  request<Registration>(`/events/${id}/registrations`, {
    method: "POST",
    body: "{}",
  });
const list = (id: string, status = "", page = 0, size = 12) =>
  request<Page<Registration>>(
    `/events/${id}/registrations?status=${status}&page=${page}&size=${size}`,
  );
const decide = (
  eventId: string,
  id: string,
  decision = "APPROVE",
  reason?: string,
) =>
  request<Registration>(`/events/${eventId}/registrations/${id}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision, reason }),
  });
function mount(id: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <RegistrationServices>
      <DiscussionServices>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[`/events/${id}`]}>
            <Routes>
              <Route path="/events/:eventId" element={<EventPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </DiscussionServices>
    </RegistrationServices>,
  );
  return client;
}

describe("S4 API", () => {
  it("persists both decisions, reason, viewer statuses and confirmed-only participants", async () => {
    const e = await event();
    await login("user-maria");
    const maria = await apply(e.id);
    expect(maria.status).toBe("PENDING");
    await expect(apply(e.id)).rejects.toMatchObject({
      status: 409,
      body: { code: "ALREADY_REGISTERED" },
    });
    expect(await request<EventPreview>(`/events/${e.id}`)).toMatchObject({
      confirmedCount: 0,
      pendingCount: 1,
      viewerRegistrationStatus: "PENDING",
    });
    await login("admin");
    const admin = await apply(e.id);
    await login();
    expect((await list(e.id, "PENDING")).total).toBe(2);
    await decide(e.id, maria.id);
    await decide(e.id, admin.id, "REJECT", "Эта группа рассчитана на новичков");
    expect((await list(e.id, "PENDING")).total).toBe(0);
    expect((await list(e.id, "CONFIRMED")).items[0].id).toBe(maria.id);
    expect(
      (
        await request<Page<PublicUser>>(`/events/${e.id}/participants`)
      ).items.map((item) => item.displayName),
    ).toEqual(["Мария"]);
    await login("admin");
    expect(await request(`/events/${e.id}/my-registration`)).toMatchObject({
      status: "REJECTED",
      decisionReason: "Эта группа рассчитана на новичков",
    });
    await login("user-maria");
    expect(await request(`/events/${e.id}/my-registration`)).toMatchObject({
      status: "CONFIRMED",
    });
  });
  it("protects guest, non-owner, admin decision and CSRF boundaries", async () => {
    const e = await event();
    await login("user-maria");
    const reg = await apply(e.id);
    await expect(list(e.id)).rejects.toMatchObject({ status: 403 });
    await expect(decide(e.id, reg.id)).rejects.toMatchObject({ status: 403 });
    await login("admin");
    expect((await list(e.id)).total).toBe(1);
    await expect(decide(e.id, reg.id)).rejects.toMatchObject({ status: 403 });
    await login();
    setCsrfToken("stale");
    await expect(decide(e.id, reg.id)).rejects.toMatchObject({ status: 403 });
    const { resetMockSession } = await import("../mocks/handlers");
    resetMockSession();
    await expect(list(e.id)).rejects.toMatchObject({ status: 401 });
    await expect(decide(e.id, reg.id)).rejects.toMatchObject({ status: 401 });
  });
  it("counts only confirmed seats, keeps pending on full approval, and permits rejection at capacity", async () => {
    const e = await event();
    const regs: Registration[] = [];
    for (const account of ["user-maria", "admin", "org-run"]) {
      await login(account);
      regs.push(await apply(e.id));
    }
    await login();
    await decide(e.id, regs[0].id);
    await decide(e.id, regs[1].id);
    await expect(decide(e.id, regs[2].id)).rejects.toMatchObject({
      status: 409,
      body: { code: "EVENT_FULL" },
    });
    expect((await list(e.id, "PENDING")).items[0].id).toBe(regs[2].id);
    await decide(e.id, regs[2].id, "REJECT");
    expect((await list(e.id, "CONFIRMED")).total).toBe(2);
  });
  it("validates transitions, payload, event ownership of a registration, and pagination", async () => {
    const e = await event();
    const other = await event();
    await login("user-maria");
    const reg = await apply(e.id);
    await login();
    await expect(decide(other.id, reg.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(decide(e.id, reg.id, "WRONG")).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      decide(e.id, reg.id, "REJECT", "x".repeat(1001)),
    ).rejects.toMatchObject({ status: 422 });
    await decide(e.id, reg.id);
    await expect(decide(e.id, reg.id)).rejects.toMatchObject({
      status: 409,
      body: { code: "INVALID_STATUS_TRANSITION" },
    });
    expect(await list(e.id, "CONFIRMED", 0, 1)).toMatchObject({
      page: 0,
      size: 1,
      total: 1,
      totalPages: 1,
    });
    expect((await list(e.id, "CONFIRMED", 1, 1)).items).toHaveLength(0);
  });
  it("does not decide once the event has started", async () => {
    const e = await event();
    await login("user-maria");
    const reg = await apply(e.id);
    await login();
    vi.mocked(Date.now).mockReturnValue(Date.parse("2026-11-08T00:00:00Z"));
    await expect(decide(e.id, reg.id)).rejects.toMatchObject({
      status: 409,
      body: { code: "EVENT_NOT_AVAILABLE" },
    });
    expect((await list(e.id, "PENDING")).total).toBe(1);
  });
});

describe("S4 UI", () => {
  it("disables the summary action with no pending requests, including after both decisions", async () => {
    const e = await event();
    await login("user-maria");
    const approved = await apply(e.id);
    await login("admin");
    const rejected = await apply(e.id);
    await login();
    await decide(e.id, approved.id);
    await decide(e.id, rejected.id, "REJECT");
    mount(e.id);
    expect(
      await screen.findByRole("button", { name: "Новых заявок нет" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("link", { name: "Рассмотреть заявки" }),
    ).not.toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByLabelText("Статус заявок"),
      "CONFIRMED",
    );
    expect(
      await screen.findByRole("listitem", { name: "Заявка: Мария" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Новых заявок нет" }),
    ).toBeDisabled();
  });
  it("enables the summary action when a new application arrives on refresh", async () => {
    const e = await event();
    const client = mount(e.id);
    expect(
      await screen.findByRole("button", { name: "Новых заявок нет" }),
    ).toBeDisabled();
    await login("user-maria");
    await apply(e.id);
    await login();
    await client.invalidateQueries({ queryKey: ["events"] });
    expect(
      await screen.findByRole("link", { name: "Рассмотреть заявки" }),
    ).toHaveAttribute("href", "#event-requests");
    expect(
      screen.queryByRole("button", { name: "Новых заявок нет" }),
    ).not.toBeInTheDocument();
  });
  it("submits an application, waits for the API, and shows no confirmed participant", async () => {
    const e = await event();
    await login("user-maria");
    mount(e.id);
    await userEvent.click(
      await screen.findByRole("button", { name: "Подать заявку" }),
    );
    expect(
      await screen.findByText("Ожидает решения", { exact: true }),
    ).toBeInTheDocument();
    expect(await screen.findByText("0 из 2 участников")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Подать заявку" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Заявки на участие" }),
    ).not.toBeInTheDocument();
  });
  it("rejects with a visible reason, keyboard focus and status filters", async () => {
    const e = await event();
    await login("user-maria");
    await apply(e.id);
    await login();
    mount(e.id);
    const row = await screen.findByRole("listitem", { name: "Заявка: Мария" });
    expect(
      screen.getByRole("link", { name: "Рассмотреть заявки" }),
    ).toHaveAttribute("href", "#event-requests");
    const reject = within(row).getByRole("button", { name: "Отклонить" });
    await userEvent.click(reject);
    const reason = screen.getByLabelText("Причина отказа (необязательно)");
    expect(reason).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(
      within(row).getByRole("button", { name: "Отклонить" }),
    ).toHaveFocus();
    await userEvent.click(
      within(row).getByRole("button", { name: "Отклонить" }),
    );
    await userEvent.type(
      screen.getByLabelText("Причина отказа (необязательно)"),
      "Подберём другую группу",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Подтвердить отказ" }),
    );
    expect(
      await screen.findByText(/Мария: отклонено. Решение сохранено/),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Новых заявок нет" }),
    ).toBeDisabled();
    await userEvent.selectOptions(
      screen.getByLabelText("Статус заявок"),
      "REJECTED",
    );
    expect(
      await screen.findByText("Подберём другую группу"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Одобрить" }),
    ).not.toBeInTheDocument();
  });
  it("recovers from decision failure without claiming success and blocks double submit", async () => {
    const e = await event();
    await login("user-maria");
    const reg = await apply(e.id);
    await login();
    server.use(
      http.post(
        `/api/v1/events/${e.id}/registrations/${reg.id}/decision`,
        async () => {
          await delay(150);
          return HttpResponse.json({}, { status: 503 });
        },
      ),
    );
    mount(e.id);
    await userEvent.click(
      await screen.findByRole("button", { name: "Одобрить" }),
    );
    expect(
      await screen.findByRole("button", { name: "Сохраняем решение…" }),
    ).toBeDisabled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Сервис временно недоступен",
    );
    expect(screen.queryByText(/Решение сохранено/)).not.toBeInTheDocument();
    server.resetHandlers();
    await userEvent.click(screen.getByRole("button", { name: "Одобрить" }));
    expect(
      await screen.findByText(/Мария: одобрено. Решение сохранено/),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("1 из 2 участников")).toBeInTheDocument(),
    );
  });
  it("retries a failed organizer list independently from public participants", async () => {
    const e = await event();
    server.use(
      http.get(`/api/v1/events/${e.id}/registrations`, () =>
        HttpResponse.json({}, { status: 503 }),
      ),
    );
    mount(e.id);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Сервис временно недоступен",
    );
    expect(
      screen.getByRole("heading", { name: "Кто идёт" }),
    ).toBeInTheDocument();
    server.resetHandlers();
    await userEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(
      await screen.findByText("Нет заявок, ожидающих решения."),
    ).toBeInTheDocument();
  });
});
