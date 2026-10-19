import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { DiscussionServices } from "../app/providers";
import { EventDiscussion } from "../features/event-discussion";
import { PublishCommentForm } from "../features/event-discussion/ui/PublishCommentForm";
import { CommentRepositoryProvider } from "../entities/comment";
import type {
  CommentRepository,
  DiscussionComment,
} from "../entities/comment/model";
import { sessionQuery, switchAccount } from "../entities/session";
import { mockId, makeSession, getEvents, saveEvent } from "../mocks/database";
import { getComments, saveComment } from "../mocks/comments";
import { resetMockSession } from "../mocks/handlers";
import { request, setCsrfToken } from "../shared/api/client";
import type { CommentDto, Page } from "../shared/api/types";
import { server } from "./setup";

const eventId = mockId("morning-run");
const path = `/events/${eventId}/comments`;
async function login(account = "user-maria") {
  const session = await switchAccount(account);
  setCsrfToken(session.csrfToken);
  return session;
}
const post = (text: string, extra: Record<string, unknown> = {}) =>
  request<CommentDto>(path, {
    method: "POST",
    body: JSON.stringify({ text, ...extra }),
  });
function mount(published = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <DiscussionServices>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <EventDiscussion eventId={eventId} published={published} />
        </MemoryRouter>
      </QueryClientProvider>
    </DiscussionServices>,
  );
  return client;
}
describe("S5 stateful network mocks", () => {
  it("allows questions without registration, organizer replies and public persisted reading", async () => {
    const before = getEvents().find(
      (item) => item.id === eventId,
    )!.confirmedCount;
    await login();
    await expect(
      request(`/events/${eventId}/my-registration`),
    ).rejects.toMatchObject({ status: 404 });
    const question = await post("  Можно с нуля?  ");
    expect(question).toMatchObject({
      text: "Можно с нуля?",
      status: "VISIBLE",
      author: { id: mockId("user-maria") },
    });
    await login("org-run");
    const answer = await post("Да, приходите!");
    expect(answer.author.id).not.toBe(question.author.id);
    resetMockSession();
    setCsrfToken();
    const comments = await request<Page<CommentDto>>(path);
    expect(comments.total).toBe(2);
    expect(comments.items.map((item) => item.id)).toEqual([
      question.id,
      answer.id,
    ]);
    expect(getComments()).toHaveLength(2);
    expect(
      getEvents().find((item) => item.id === eventId)!.confirmedCount,
    ).toBe(before);
  });
  it("requires authentication and current CSRF", async () => {
    await expect(post("Вопрос")).rejects.toMatchObject({ status: 401 });
    await login();
    setCsrfToken("old");
    await expect(post("Вопрос")).rejects.toMatchObject({ status: 403 });
    expect(getComments()).toHaveLength(0);
  });
  it.each(["", "  \n", "a".repeat(2001)])(
    "enforces server text limits independently of the form",
    async (text) => {
      await login();
      await expect(post(text)).rejects.toMatchObject({ status: 400 });
      expect(getComments()).toHaveLength(0);
    },
  );
  it("accepts the exact 2000 boundary and rejects forged author and unknown fields", async () => {
    await login();
    expect((await post("a".repeat(2000))).text).toHaveLength(2000);
    await expect(
      post("Вопрос", { author: { id: mockId("admin") } }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(post("Вопрос", { status: "HIDDEN" })).rejects.toMatchObject({
      status: 400,
    });
  });
  it("distinguishes missing event and unpublished owner-only discussion", async () => {
    const session = await login("user-alex");
    const draft = saveEvent(
      {
        title: "Черновик встречи",
        description: "Описание встречи для проверки комментариев",
        sport: { sportId: mockId("running") },
        startsAt: "2026-11-01T12:00:00Z",
        location: { city: "Москва", address: "Парк" },
        joinMode: "OPEN",
        skillLevel: "ANY",
        eventKind: "ACTIVITY",
        maxParticipants: 10,
        organizer: { type: "USER", id: session.user.id },
        publishNow: false,
      },
      session.user.id,
    )!;
    await expect(
      request(`/events/${draft.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ text: "Текст" }),
      }),
    ).rejects.toMatchObject({
      status: 409,
      body: { code: "EVENT_NOT_AVAILABLE" },
    });
    await login();
    await expect(request(`/events/${draft.id}/comments`)).rejects.toMatchObject(
      { status: 404 },
    );
    await expect(
      request(`/events/${crypto.randomUUID()}/comments`),
    ).rejects.toMatchObject({ status: 404 });
  });
});
describe("discussion UI", () => {
  it("lets guests read but asks to sign in with a return destination", async () => {
    saveComment(eventId, makeSession("user-maria")!.user, "Публичный вопрос");
    mount();
    expect(await screen.findByText("Публичный вопрос")).toBeVisible();
    expect(
      await screen.findByRole("link", { name: "Войти и написать" }),
    ).toHaveAttribute(
      "href",
      `/login?next=event-discussion&eventId=${eventId}`,
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it("validates whitespace and preserves text on failed sends, then retries once", async () => {
    await login();
    let calls = 0;
    server.use(
      http.post(`/api/v1${path}`, () => {
        calls++;
        return HttpResponse.json({ code: "INTERNAL_ERROR" }, { status: 503 });
      }),
    );
    mount();
    const field = await screen.findByRole("textbox", {
      name: "Ваше сообщение",
    });
    const user = userEvent.setup();
    await user.type(field, "   ");
    await user.click(
      screen.getByRole("button", { name: "Отправить сообщение" }),
    );
    expect(await screen.findByText("Напишите сообщение")).toBeVisible();
    expect(calls).toBe(0);
    await user.clear(field);
    await user.type(field, "Можно новичку?");
    await user.click(
      screen.getByRole("button", { name: "Отправить сообщение" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Текст сохранён",
    );
    expect(field).toHaveValue("Можно новичку?");
    server.resetHandlers();
    await user.click(
      screen.getByRole("button", { name: "Отправить сообщение" }),
    );
    expect(await screen.findByText("Сообщение опубликовано.")).toBeVisible();
    expect(field).toHaveValue("");
    expect(getComments()).toHaveLength(1);
  });
  it("blocks duplicate submissions while pending and renders plain text", async () => {
    await login();
    server.use(
      http.post(`/api/v1${path}`, async () => {
        await delay(150);
        return HttpResponse.json(
          saveComment(
            eventId,
            makeSession("user-maria")!.user,
            "<script>alert(1)</script>",
          ),
          { status: 201 },
        );
      }),
    );
    mount();
    const user = userEvent.setup();
    await user.type(
      await screen.findByRole("textbox"),
      "<script>alert(1)</script>",
    );
    await user.dblClick(
      screen.getByRole("button", { name: "Отправить сообщение" }),
    );
    expect(
      screen.getByRole("button", { name: "Отправляем сообщение…" }),
    ).toBeDisabled();
    expect(await screen.findByText("<script>alert(1)</script>")).toBeVisible();
    expect(document.querySelector(".comment-text script")).toBeNull();
    expect(getComments()).toHaveLength(1);
  });
  it("retries a list failure independently of the entered draft", async () => {
    await login();
    server.use(
      http.get(`/api/v1${path}`, () => HttpResponse.json({}, { status: 503 })),
    );
    mount();
    await screen.findByRole("alert");
    await userEvent.type(
      await screen.findByRole("textbox"),
      "Черновик вопроса",
    );
    server.resetHandlers();
    await userEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(
      await screen.findByText("Пока нет сообщений. Задайте первый вопрос."),
    ).toBeVisible();
    expect(screen.getByRole("textbox")).toHaveValue("Черновик вопроса");
  });
  it("moves to the last server page after publishing and can return to the beginning", async () => {
    const session = await login();
    for (let i = 0; i < 10; i++)
      saveComment(eventId, session.user, `Сообщение ${i}`);
    mount();
    await screen.findByText("Сообщений: 10");
    await userEvent.type(screen.getByRole("textbox"), "Новый вопрос");
    await userEvent.click(
      screen.getByRole("button", { name: "Отправить сообщение" }),
    );
    expect(await screen.findByText("Страница 2 из 2")).toBeVisible();
    expect(await screen.findByText("Новый вопрос")).toBeVisible();
    expect(
      within(
        screen.getByRole("list", { name: "Обсуждение встречи" }),
      ).getAllByRole("listitem"),
    ).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Назад" }));
    expect(await screen.findByText("Сообщение 0")).toBeVisible();
  });
  it("keeps an unpublished event read-only", async () => {
    await login();
    mount(false);
    expect(
      await screen.findByText(
        "Событие не опубликовано. Новые сообщения недоступны.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it("ignores a late response after switching accounts", async () => {
    const first = makeSession("user-alex")!;
    let finish: ((value: DiscussionComment) => void) | undefined;
    const response = new Promise<DiscussionComment>((resolve) => {
      finish = resolve;
    });
    const repository: CommentRepository = {
      list: vi.fn(),
      publish: vi.fn(() => response),
    };
    const onPublished = vi.fn();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(sessionQuery.queryKey, first);
    render(
      <CommentRepositoryProvider repository={repository}>
        <QueryClientProvider client={client}>
          <PublishCommentForm
            eventId={eventId}
            viewerId={first.user.id}
            onPublished={onPublished}
          />
        </QueryClientProvider>
      </CommentRepositoryProvider>,
    );
    await userEvent.type(screen.getByRole("textbox"), "Вопрос");
    await userEvent.click(
      screen.getByRole("button", { name: "Отправить сообщение" }),
    );
    await act(async () => {
      client.setQueryData(sessionQuery.queryKey, makeSession("user-maria"));
      finish!({
        id: "id",
        eventId,
        author: { id: first.user.id, displayName: "Александр" },
        text: "Вопрос",
        visibility: "visible",
        publishedAt: new Date().toISOString(),
      });
      await response;
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Отправить сообщение" }),
      ).toBeEnabled(),
    );
    expect(onPublished).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("Вопрос");
  });
});
