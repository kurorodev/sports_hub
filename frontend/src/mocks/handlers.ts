import { http, HttpResponse } from "msw";
import {
  accounts,
  getEvents,
  getSports,
  makeSession,
  saveEvent,
} from "./database";
import { apiConfig } from "../shared/api/client";
import { createEventSchema } from "../shared/api/provisional-event-schema";

const api = apiConfig.baseUrl;
const sessionKey = "dvizh.mock.account";
let memoryAccount: string | null = null;

function savedAccount() {
  if (typeof localStorage !== "undefined")
    return localStorage.getItem(sessionKey);
  return memoryAccount;
}
export function resetMockSession() {
  memoryAccount = null;
  if (typeof localStorage !== "undefined") localStorage.removeItem(sessionKey);
}
const notFound = () =>
  HttpResponse.json(
    { code: "NOT_FOUND", message: "Не найдено" },
    { status: 404 },
  );

export const handlers = [
  http.get(`${api}/demo/accounts`, () => HttpResponse.json(accounts)),
  http.post(`${api}/demo/session`, async ({ request }) => {
    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      !("accountId" in body) ||
      typeof body.accountId !== "string"
    ) {
      return HttpResponse.json(
        { code: "VALIDATION_ERROR", message: "Укажите аккаунт" },
        { status: 422 },
      );
    }
    const session = makeSession(body.accountId);
    if (!session) return notFound();
    memoryAccount = body.accountId;
    if (typeof localStorage !== "undefined")
      localStorage.setItem(sessionKey, body.accountId);
    return HttpResponse.json(session);
  }),
  http.get(`${api}/session`, () => {
    const session = makeSession(savedAccount() ?? "");
    return session
      ? HttpResponse.json(session)
      : HttpResponse.json(
          { code: "UNAUTHORIZED", message: "Войдите" },
          { status: 401 },
        );
  }),
  http.get(`${api}/sports`, () => HttpResponse.json(getSports())),
  http.post(`${api}/events`, async ({ request }) => {
    const session = makeSession(savedAccount() ?? "");
    if (!session)
      return HttpResponse.json(
        { code: "UNAUTHORIZED", message: "Войдите" },
        { status: 401 },
      );
    if (request.headers.get("X-CSRF-Token") !== session.csrfToken) {
      return HttpResponse.json(
        { code: "FORBIDDEN", message: "Сессия изменилась. Обновите страницу." },
        { status: 403 },
      );
    }
    const parsed = createEventSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      const fieldErrors = Object.fromEntries(
        parsed.error.issues.map((issue) => [
          issue.path.join("."),
          issue.message,
        ]),
      );
      return HttpResponse.json(
        { code: "VALIDATION_ERROR", message: "Проверьте поля", fieldErrors },
        { status: 422 },
      );
    }
    const event = saveEvent(parsed.data, session.user.id);
    if (!event)
      return HttpResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "Спорт больше не доступен",
          fieldErrors: {
            sportId: "Выберите спорт из списка или добавьте свой",
          },
        },
        { status: 422 },
      );
    return HttpResponse.json(event, { status: 201 });
  }),
  http.get(`${api}/events`, ({ request }) => {
    const p = new URL(request.url).searchParams;
    const q = (p.get("q") ?? "").trim().toLocaleLowerCase("ru");
    let items = getEvents(savedAccount() ?? undefined).filter(
      (event) =>
        (!q ||
          `${event.title} ${event.description} ${event.sport.name}`
            .toLocaleLowerCase("ru")
            .includes(q)) &&
        (!p.get("sportId") || event.sport.id === p.get("sportId")) &&
        (!p.get("city") || event.location.city === p.get("city")) &&
        (!p.get("skillLevel") || event.skillLevel === p.get("skillLevel")) &&
        (!p.get("joinMode") || event.joinMode === p.get("joinMode")) &&
        (!p.get("from") || event.startsAt.slice(0, 10) >= p.get("from")!) &&
        (!p.get("to") || event.startsAt.slice(0, 10) <= p.get("to")!) &&
        (p.get("hasSpots") !== "true" ||
          event.confirmedCount < event.capacity) &&
        (p.get("includePast") === "true" ||
          new Date(event.startsAt).getTime() >= Date.now()),
    );
    items = [...items].sort((a, b) =>
      p.get("sort") === "startsAt,desc"
        ? Date.parse(b.startsAt) - Date.parse(a.startsAt)
        : Date.parse(a.startsAt) - Date.parse(b.startsAt),
    );
    const page = Math.max(0, Number(p.get("page")) || 0);
    const size = Math.min(24, Math.max(1, Number(p.get("size")) || 6));
    return HttpResponse.json({
      items: items.slice(page * size, (page + 1) * size),
      page,
      size,
      total: items.length,
    });
  }),
  http.get(`${api}/events/:eventId`, ({ params }) => {
    const event = getEvents(savedAccount() ?? undefined).find(
      (item) => item.id === params.eventId,
    );
    return event ? HttpResponse.json(event) : notFound();
  }),
];
