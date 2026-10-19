import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { SupportProvider } from "../entities/support";
import { createHttpSupportRepository } from "../entities/support/api/http-support-repository";
import {
  CreateSupportForm,
  SupportThread,
  SupportDesk,
} from "../features/support";
import { sessionQuery, switchAccount } from "../entities/session";
import { request, setCsrfToken } from "../shared/api/client";
import { makeSession, mockId } from "../mocks/database";
import { saveComment } from "../mocks/comments";
import { server } from "./setup";
const repo = createHttpSupportRepository(request);
const input = {
  category: "HELP" as const,
  title: "Не могу записаться",
  description: "Помогите разобраться с записью на встречу",
};
async function login(account = "user-alex") {
  const session = await switchAccount(account);
  setCsrfToken(session.csrfToken);
  return session;
}
async function mount(ui: React.ReactNode) {
  const session = await login();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(sessionQuery.queryKey, session);
  render(
    <SupportProvider repository={repo}>
      <QueryClientProvider client={client}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>
    </SupportProvider>,
  );
  return client;
}

describe("support", () => {
  it("publishes a closed venue suggestion once, with admin permission and a public map link", async () => {
    await login();
    const ticket = await repo.create({
      ...input,
      category: "VENUE_SUGGESTION",
      venueCity: "Самара",
      venueAddress: "Парк 42",
    });
    const venue = {
      name: "Площадка из поддержки",
      location: {
        city: "Самара",
        address: "Парк 42",
        latitude: 53.25,
        longitude: 50.2,
      },
    };
    await expect(repo.publishVenue(ticket.id, venue)).rejects.toMatchObject({
      status: 403,
    });
    await login("admin");
    await repo.update(ticket.id, { status: "CLOSED" });
    const result = await repo.publishVenue(ticket.id, venue);
    expect(result.status).toBe("RESOLVED");
    expect(result.publishedVenueId).toBeTruthy();
    expect((await repo.publishVenue(ticket.id, venue)).publishedVenueId).toBe(
      result.publishedVenueId,
    );
    const map = await request<{ items: { id: string; name: string }[] }>(
      "/map/venues?bbox=49.8,53.0,50.4,53.5",
    );
    expect(map.items.filter((v) => v.id === result.publishedVenueId)).toEqual([
      expect.objectContaining({ name: venue.name }),
    ]);
    await login();
    expect((await repo.get(ticket.id)).publishedVenueId).toBe(
      result.publishedVenueId,
    );
  });
  it("keeps tickets private, notifies admin, replies and persists the thread", async () => {
    const author = await login();
    const t = await repo.create(input);
    expect(t.author.id).toBe(author.user.id);
    await login("user-maria");
    expect((await repo.list(false, { page: 0 })).total).toBe(0);
    await expect(repo.get(t.id)).rejects.toMatchObject({ status: 404 });
    await expect(repo.reply(t.id, "Чужой ответ")).rejects.toMatchObject({
      status: 404,
    });
    await expect(repo.list(true, { page: 0 })).rejects.toMatchObject({
      status: 403,
    });
    await login("admin");
    expect(
      (
        await request<{ items: { type: string; href: string }[] }>(
          "/me/notifications",
        )
      ).items,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "SUPPORT_NEW",
          href: `/support/${t.id}`,
        }),
      ]),
    );
    await repo.reply(t.id, "Уточните устройство и браузер");
    expect((await repo.get(t.id)).status).toBe("WAITING_USER");
    await login();
    expect((await repo.messages(t.id, 0)).items[0].text).toBe(
      "Уточните устройство и браузер",
    );
    await repo.reply(t.id, "Chrome на телефоне");
    expect((await repo.get(t.id)).status).toBe("OPEN");
    await expect(
      repo.update(t.id, { priority: "URGENT" }),
    ).rejects.toMatchObject({ status: 403 });
    await repo.update(t.id, { status: "CLOSED" });
    await expect(repo.reply(t.id, "Ещё вопрос")).rejects.toMatchObject({
      status: 409,
    });
    await repo.update(t.id, { status: "OPEN" });
    expect((await repo.messages(t.id, 0)).total).toBe(4);
  });
  it("snapshots reports, prevents duplicates and does not hide a comment", async () => {
    const author = makeSession("user-maria")!.user;
    const comment = saveComment(
      mockId("basketball-yard"),
      author,
      "Сообщение для проверки жалобы",
    );
    await login();
    const payload = {
      ...input,
      category: "COMMENT_REPORT" as const,
      commentId: comment.id,
      reportReason: "SPAM" as const,
    };
    const ticket = await repo.create(payload);
    expect(ticket.commentText).toBe(comment.text);
    expect(ticket.eventId).toBe(comment.eventId);
    await expect(repo.create(payload)).rejects.toMatchObject({ status: 409 });
    expect(
      (
        await request<{ items: { id: string; status: string }[] }>(
          `/events/${comment.eventId}/comments`,
        )
      ).items.find((x) => x.id === comment.id)?.status,
    ).toBe("VISIBLE");
  });
  it("requires venue details, CSRF, and prevents forged protected fields", async () => {
    await login();
    await expect(
      repo.create({ ...input, category: "VENUE_SUGGESTION" }),
    ).rejects.toMatchObject({ status: 400 });
    const venue = await repo.create({
      ...input,
      category: "VENUE_SUGGESTION",
      venueCity: " Москва ",
      venueAddress: " Парк 1 ",
    });
    expect(venue.venueCity).toBe("Москва");
    await expect(
      request("/support/tickets", {
        method: "POST",
        body: JSON.stringify({ ...input, authorId: mockId("admin") }),
      }),
    ).rejects.toMatchObject({ status: 400 });
    setCsrfToken();
    await expect(repo.create(input)).rejects.toMatchObject({ status: 403 });
  });
  it("blocks edits while sending and retains the creation draft after an error", async () => {
    server.use(
      http.post("/api/v1/support/tickets", async () => {
        await delay(250);
        return new HttpResponse(null, { status: 503 });
      }),
    );
    await mount(
      <CreateSupportForm viewerId={makeSession("user-alex")!.user.id} />,
    );
    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "Заголовок" }),
      input.title,
    );
    await user.type(
      screen.getByRole("textbox", { name: /Подробности/ }),
      input.description,
    );
    await user.click(
      screen.getByRole("button", { name: "Отправить обращение" }),
    );
    expect(screen.getByRole("button", { name: "Отправляем…" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Заголовок" })).toBeDisabled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Сервис временно недоступен",
    );
    expect(screen.getByRole("textbox", { name: "Заголовок" })).toHaveValue(
      input.title,
    );
    expect(screen.getByRole("textbox", { name: /Подробности/ })).toHaveValue(
      input.description,
    );
  });
  it("renders empty state and lets an administrator use the queue filters", async () => {
    await mount(
      <SupportDesk
        viewerId={makeSession("user-alex")!.user.id}
        admin={false}
      />,
    );
    expect(await screen.findByText("Здесь пока нет обращений")).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Все обращения" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Предложить площадку/ }),
    ).toHaveAttribute("href", "/support/new?category=VENUE_SUGGESTION");
  });
  it("shows the reply, keeps a failed draft, and closes/reopens with history", async () => {
    await login();
    const ticket = await repo.create(input);
    await mount(
      <SupportThread
        id={ticket.id}
        viewerId={ticket.author.id}
        admin={false}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: input.title }),
    ).toBeVisible();
    const user = userEvent.setup();
    const field = screen.getByRole("textbox", {
      name: "Ваше сообщение в поддержку",
    });
    await user.type(field, "Подробности моего вопроса");
    server.use(
      http.post(
        `/api/v1/support/tickets/${ticket.id}/messages`,
        () => new HttpResponse(null, { status: 503 }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Отправить ответ" }));
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(field).toHaveValue("Подробности моего вопроса");
    await user.click(
      screen.getByRole("button", { name: "Вопрос решён, закрыть" }),
    );
    expect(
      await screen.findByRole("button", { name: "Открыть повторно" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Открыть повторно" }));
    expect(
      await screen.findByRole("textbox", {
        name: "Ваше сообщение в поддержку",
      }),
    ).toBeVisible();
  });
  it("does not display cached private data after access is lost", async () => {
    await login();
    const ticket = await repo.create(input);
    const client = await mount(
      <SupportThread
        id={ticket.id}
        viewerId={ticket.author.id}
        admin={false}
      />,
    );
    expect(await screen.findByText(ticket.description)).toBeVisible();
    server.use(
      http.get(
        `/api/v1/support/tickets/${ticket.id}`,
        () => new HttpResponse(null, { status: 404 }),
      ),
    );
    await client.invalidateQueries({
      queryKey: ["support", ticket.author.id, "ticket", ticket.id],
    });
    await waitFor(() =>
      expect(screen.queryByText(ticket.description)).not.toBeInTheDocument(),
    );
    expect(
      await screen.findByText(/Обращение не найдено или недоступно/),
    ).toBeVisible();
  });
  it("rejects mismatched ticket and thread identities from the adapter", async () => {
    await login();
    const ticket = await repo.create(input);
    server.use(
      http.get(`/api/v1/support/tickets/${ticket.id}`, () =>
        HttpResponse.json({ ...ticket, id: mockId("wrong-ticket") }),
      ),
    );
    await expect(repo.get(ticket.id)).rejects.toThrow(
      "Unexpected support ticket",
    );
    server.use(
      http.get(`/api/v1/support/tickets/${ticket.id}/messages`, () =>
        HttpResponse.json({
          items: [
            {
              id: mockId("message"),
              ticketId: mockId("other-ticket"),
              author: ticket.author,
              fromSupport: true,
              kind: "MESSAGE",
              text: "Чужое",
              createdAt: ticket.createdAt,
            },
          ],
          page: 0,
          size: 20,
          total: 1,
          totalPages: 1,
        }),
      ),
    );
    await expect(repo.messages(ticket.id, 0)).rejects.toThrow(
      "Unexpected support thread",
    );
  });
});
