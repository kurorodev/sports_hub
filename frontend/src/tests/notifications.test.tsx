import { describe, it, expect, vi, beforeAll } from "vitest";
import {
  render,
  screen,
  within,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "./setup";
import { NotificationBell } from "../features/notifications";
import { NotificationRepositoryProvider } from "../entities/notification";
import { createHttpNotificationRepository } from "../entities/notification/api/http-notification-repository";
import { ApiError, request, setCsrfToken } from "../shared/api/client";
import { sessionQuery } from "../entities/session";
import { makeSession, mockId } from "../mocks/database";
import { notify } from "../mocks/notifications";
import { saveComment } from "../mocks/comments";
import type { components } from "../shared/api/generated/schema";
import type { Session } from "../shared/api/types";
import { relativeTime } from "../shared/lib/relative-time";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
async function login(account = "user-alex") {
  const session = await request<Session>("/demo/session", {
    method: "POST",
    body: JSON.stringify({ accountId: account }),
  });
  setCsrfToken(session.csrfToken);
  return session;
}
function mount(
  session: Session,
  repository = createHttpNotificationRepository(request),
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(sessionQuery.queryKey, session);
  const view = render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <NotificationRepositoryProvider repository={repository}>
          <NotificationBell viewerId={session.user.id} />
        </NotificationRepositoryProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { client, ...view };
}
type Page = components["schemas"]["NotificationPage"];
describe("personal notifications", () => {
  it("shows each blocked comment with its own reason only in the author's notifications", async () => {
    const author = await login();
    const eventId = mockId("morning-run");
    const original = "<script>не HTML</script>\n" + "я".repeat(1975);
    expect(original).toHaveLength(2000);
    const first = saveComment(eventId, author.user, original);
    const second = saveComment(eventId, author.user, "Другой мой вопрос");
    await login("admin");
    for (const [id, reason] of [
      [first.id, "Первая причина"],
      [second.id, "Вторая причина"],
    ])
      await request(`/admin/comments/${id}/hide`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    expect((await request<Page>("/me/notifications")).items).toHaveLength(0);
    await login("user-maria");
    expect((await request<Page>("/me/notifications")).items).toHaveLength(0);
    await login();
    const repo = createHttpNotificationRepository(request);
    const page = await repo.list(0);
    expect(page.items.map((n) => n.commentText)).toEqual(
      expect.arrayContaining([original, second.text]),
    );
    const notice = page.items.find((n) => n.commentText === original)!;
    expect((await repo.read(notice.id)).commentText).toBe(original);
    const view = mount(author);
    const user = userEvent.setup();
    expect(screen.queryByText(original)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Уведомления/ }));
    const quotes = await screen.findAllByRole("blockquote", {
      name: "Скрытый комментарий",
    });
    const quote = quotes.find(
      (el) => el.querySelector("p")?.textContent === original,
    )!;
    expect(quote).toBeVisible();
    expect(quote.querySelector("script")).toBeNull();
    expect(quote.closest("li")).toHaveTextContent("Первая причина");
    expect(quote.closest("li")).not.toHaveTextContent("Вторая причина");
    view.unmount();
    mount(author);
    await user.click(screen.getByRole("button", { name: /^Уведомления/ }));
    await waitFor(() =>
      expect(
        screen
          .getAllByRole("blockquote")
          .some((el) => el.querySelector("p")?.textContent === original),
      ).toBe(true),
    );
  });
  it("formats relative times up to a month", () => {
    const now = Date.parse("2026-10-20T12:00:00Z");
    const ago = (seconds: number) =>
      relativeTime(new Date(now - seconds * 1000).toISOString(), now);
    expect(ago(10)).toBe("только что");
    expect(ago(60)).toBe("1 минуту назад");
    expect(ago(3600)).toBe("1 час назад");
    expect(ago(86400)).toBe("вчера");
    expect(ago(604800)).toBe("на прошлой неделе");
    expect(ago(1814400)).toBe("3 недели назад");
    expect(ago(2592000)).toBe("в прошлом месяце");
  });
  it("isolates accounts, enforces CSRF and preserves idempotent read state", async () => {
    const a = await login();
    notify(
      a.user.id,
      "COMMENT_HIDDEN",
      "Комментарий скрыт",
      "Встреча",
      "Личная причина",
      null,
    );
    const page = await request<Page>("/me/notifications");
    expect(page.unreadCount).toBe(1);
    const id = page.items[0].id;
    setCsrfToken("wrong");
    await expect(
      request(`/me/notifications/${id}/read`, { method: "POST" }),
    ).rejects.toMatchObject({ status: 403 });
    const b = await login("user-maria");
    expect((await request<Page>("/me/notifications")).items).toHaveLength(0);
    await expect(
      request(`/me/notifications/${id}/read`, { method: "POST" }),
    ).rejects.toMatchObject({ status: 404 });
    expect(b.user.id).not.toBe(a.user.id);
    await login();
    const repo = createHttpNotificationRepository(request);
    const read = await repo.read(id);
    expect(read.readAt).not.toBeNull();
    expect((await repo.read(id)).readAt).toBe(read.readAt);
    expect((await repo.list(0)).unreadCount).toBe(0);
  });
  it("bulk reads respect the snapshot and hide notifications older than 30 days", async () => {
    const a = await login();
    const now = new Date();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date(now.getTime() - 31 * 86400_000));
      notify(a.user.id, "EVENT_STATUS", "Старое", "Встреча", null, null);
      vi.setSystemTime(now);
      notify(a.user.id, "EVENT_STATUS", "Первое", "Встреча", null, null);
      const snapshot = await request<Page>("/me/notifications");
      expect(snapshot.items).toHaveLength(1);
      vi.setSystemTime(new Date(now.getTime() + 1000));
      notify(a.user.id, "EVENT_STATUS", "Новое", "Встреча", null, null);
      await request("/me/notifications/read-all", {
        method: "POST",
        body: JSON.stringify({ through: snapshot.asOf }),
      });
      const page = await request<Page>("/me/notifications");
      expect(page.unreadCount).toBe(1);
      expect(page.items.find((n) => n.title === "Новое")?.readAt).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
  it("automatically reads the opening snapshot including unloaded pages, keeps reasons private and closes", async () => {
    const a = await login();
    for (let i = 0; i < 22; i++)
      notify(
        a.user.id,
        "COMMENT_HIDDEN",
        `Комментарий ${i}`,
        "Встреча",
        "Приватная причина",
        null,
      );
    mount(a);
    const user = userEvent.setup();
    const bell = await screen.findByRole("button", {
      name: "Уведомления: 22 непрочитанных",
    });
    expect(screen.queryByText("Приватная причина")).not.toBeInTheDocument();
    await user.click(bell);
    const dialog = screen.getByRole("dialog", { name: "Уведомления" });
    expect(within(dialog).getAllByText(/Приватная причина/)).toHaveLength(20);
    await waitFor(() =>
      expect(within(dialog).getByText("Всё прочитано")).toBeVisible(),
    );
    expect((await request<Page>("/me/notifications")).unreadCount).toBe(0);
    await user.click(
      within(dialog).getByRole("button", { name: "Показать ещё" }),
    );
    await waitFor(() =>
      expect(within(dialog).getAllByRole("listitem")).toHaveLength(22),
    );
    expect(
      within(dialog).queryByRole("button", { name: "Прочитано" }),
    ).not.toBeInTheDocument();
    fireEvent(
      dialog,
      new Event("cancel", { bubbles: false, cancelable: true }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/Приватная причина/)).not.toBeInTheDocument();
  });
  it("keeps unread state on a failed automatic read and allows a manual retry", async () => {
    const a = await login();
    notify(a.user.id, "EVENT_STATUS", "Обновление", "Встреча", null, null);
    let unavailable = true;
    const repository = createHttpNotificationRepository(request);
    const readAll = vi.fn(async (through: string) => {
      if (unavailable) throw new ApiError(503);
      await repository.readAll(through);
    });
    mount(a, { ...repository, readAll });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", {
        name: "Уведомления: 1 непрочитанных",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Сервис временно недоступен",
    );
    expect(readAll).toHaveBeenCalledTimes(1);
    expect((await request<Page>("/me/notifications")).unreadCount).toBe(1);
    unavailable = false;
    await user.click(screen.getByRole("button", { name: "Прочитать все" }));
    await waitFor(() => expect(readAll).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Всё прочитано")).toBeVisible();
    expect((await request<Page>("/me/notifications")).unreadCount).toBe(0);
  });
  it("does not mark cached notifications as read when the fresh opening request fails", async () => {
    const a = await login();
    notify(a.user.id, "EVENT_STATUS", "Обновление", "Встреча", null, null);
    const repository = createHttpNotificationRepository(request);
    const snapshot = await repository.list(0);
    const readAll = vi.fn();
    mount(a, {
      ...repository,
      list: vi
        .fn()
        .mockResolvedValueOnce(snapshot)
        .mockRejectedValue(new ApiError(401)),
      readAll,
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", {
        name: "Уведомления: 1 непрочитанных",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Войдите в аккаунт",
    );
    expect(readAll).not.toHaveBeenCalled();
    expect((await repository.list(0)).unreadCount).toBe(1);
  });
  it.each(["close", "account"])(
    "ignores a late opening response after %s",
    async (action) => {
      const a = await login();
      notify(a.user.id, "EVENT_STATUS", "Обновление", "Встреча", null, null);
      const snapshot = await createHttpNotificationRepository(request).list(0);
      let finish!: (page: Page) => void;
      const response = new Promise<Page>((resolve) => {
        finish = resolve;
      });
      const list = vi
        .fn()
        .mockResolvedValueOnce(snapshot)
        .mockReturnValueOnce(response);
      const readAll = vi.fn();
      const view = mount(a, { list, readAll, read: vi.fn() });
      const user = userEvent.setup();
      await user.click(
        await screen.findByRole("button", {
          name: "Уведомления: 1 непрочитанных",
        }),
      );
      await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
      if (action === "close")
        await user.click(
          screen.getByRole("button", { name: "Закрыть уведомления" }),
        );
      else
        view.client.setQueryData(
          sessionQuery.queryKey,
          makeSession("user-maria"),
        );
      finish(snapshot);
      await waitFor(() => expect(view.client.isFetching()).toBe(0));
      expect(readAll).not.toHaveBeenCalled();
    },
  );
  it("supports empty and error/retry states without inventing a success", async () => {
    const a = await login();
    let unavailable = true;
    server.use(
      http.get("/api/v1/me/notifications", () =>
        unavailable
          ? HttpResponse.json(
              { code: "SERVICE_UNAVAILABLE", message: "Временно недоступно" },
              { status: 503 },
            )
          : HttpResponse.json({
              items: [],
              page: 0,
              size: 20,
              total: 0,
              totalPages: 0,
              unreadCount: 0,
              asOf: new Date().toISOString(),
            }),
      ),
    );
    mount(a);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Уведомления/ }));
    await screen.findByRole("alert");
    unavailable = false;
    await user.click(
      screen.getByRole("button", { name: "Повторить загрузку" }),
    );
    expect(await screen.findByText("Пока тихо")).toBeVisible();
  });
  it("rejects an unsafe notification URL at the API boundary", async () => {
    const a = makeSession("user-alex")!;
    server.use(
      http.get("/api/v1/me/notifications", () =>
        HttpResponse.json({
          items: [
            {
              id: mockId("notice"),
              type: "EVENT_STATUS",
              title: "Событие",
              text: "Текст",
              reason: null,
              href: "https://external.example",
              createdAt: new Date().toISOString(),
              readAt: null,
            },
          ],
          page: 0,
          size: 20,
          total: 1,
          totalPages: 1,
          unreadCount: 1,
          asOf: new Date().toISOString(),
        }),
      ),
    );
    await expect(
      createHttpNotificationRepository(request).list(0),
    ).rejects.toThrow();
    expect(a.user.id).toBeTruthy();
  });
});
