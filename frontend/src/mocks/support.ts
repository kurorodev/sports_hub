import { http, HttpResponse } from "msw";
import { z } from "zod";
import type { Session } from "../shared/api/types";
import type { SupportTicket, SupportMessage } from "../entities/support/model";
import {
  categories,
  statuses,
  priorities,
  reportReasons,
  statusLabels,
  priorityLabels,
} from "../entities/support/model";
import {
  getAccounts,
  makeSession,
  getEvents,
  getRegistrations,
} from "./database";
import { getComments } from "./comments";
import { notify } from "./notifications";

const key = "dvizh.mock.support.v1";
let memory: { tickets: SupportTicket[]; messages: SupportMessage[] } = {
  tickets: [],
  messages: [],
};
function read() {
  const saved =
    typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  return saved ? (JSON.parse(saved) as typeof memory) : memory;
}
function persist(value: typeof memory) {
  memory = value;
  if (typeof localStorage !== "undefined")
    localStorage.setItem(key, JSON.stringify(value));
}
export function resetMockSupport() {
  memory = { tickets: [], messages: [] };
  if (typeof localStorage !== "undefined") localStorage.removeItem(key);
}
const createSchema = z
  .object({
    category: z.enum(categories),
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().min(10).max(5000),
    commentId: z.string().uuid().optional(),
    reportReason: z.enum(reportReasons).optional(),
    venueCity: z.string().trim().min(1).max(120).optional(),
    venueAddress: z.string().trim().min(1).max(300).optional(),
  })
  .strict();
const updateSchema = z
  .object({
    status: z.enum(statuses).optional(),
    priority: z.enum(priorities).optional(),
  })
  .strict()
  .refine(
    (value) => value.status !== undefined || value.priority !== undefined,
  );
const error = (status: number, message: string) =>
  HttpResponse.json(
    {
      code:
        status === 401
          ? "UNAUTHENTICATED"
          : status === 403
            ? "FORBIDDEN"
            : status === 404
              ? "NOT_FOUND"
              : status === 409
                ? "CONFLICT"
                : status === 429
                  ? "RATE_LIMITED"
                  : "VALIDATION_ERROR",
      message,
      details: [],
      requestId: crypto.randomUUID(),
    },
    { status },
  );
const admin = (s: Session) => s.systemRoles.includes("ADMIN");
const terminal = (t: SupportTicket) =>
  t.status === "CLOSED" || t.status === "RESOLVED";
function admins(
  t: SupportTicket,
  actor: string,
  type: "SUPPORT_NEW" | "SUPPORT_REPLY" | "SUPPORT_STATUS",
  title: string,
) {
  for (const account of getAccounts()) {
    const s = makeSession(account.id);
    if (s && admin(s) && s.user.id !== actor)
      notify(s.user.id, type, title, t.title, null, `/support/${t.id}`);
  }
}
function notice(
  t: SupportTicket,
  s: Session,
  type: "SUPPORT_REPLY" | "SUPPORT_STATUS",
  title: string,
) {
  if (t.author.id === s.user.id) admins(t, s.user.id, type, title);
  else notify(t.author.id, type, title, t.title, null, `/support/${t.id}`);
}
function paginate<T>(items: T[], url: string) {
  const p = new URL(url).searchParams;
  const page = Number(p.get("page") ?? 0),
    size = Number(p.get("size") ?? 20);
  if (
    !Number.isInteger(page) ||
    page < 0 ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > 100 ||
    page * size > 2147483647
  )
    return error(400, "Неверная страница");
  return HttpResponse.json({
    items: items.slice(page * size, (page + 1) * size),
    page,
    size,
    total: items.length,
    totalPages: Math.ceil(items.length / size),
  });
}
export function supportHandlers(
  api: string,
  session: () => Session | undefined,
) {
  function auth(request: Request, write = false) {
    const s = session();
    if (!s) return error(401, "Войдите в аккаунт");
    if (write && request.headers.get("X-CSRF-Token") !== s.csrfToken)
      return error(403, "Неверный CSRF");
    return s;
  }
  function ticket(data: typeof memory, id: string, s: Session) {
    return data.tickets.find(
      (t) => t.id === id && (t.author.id === s.user.id || admin(s)),
    );
  }
  function list(request: Request, queue: boolean) {
    const s = auth(request);
    if (s instanceof Response) return s;
    if (queue && !admin(s)) return error(403, "Только администратор");
    const p = new URL(request.url).searchParams;
    const status = p.get("status"),
      category = p.get("category"),
      q = p.get("q") ?? "";
    if (
      (status && !statuses.some((x) => x === status)) ||
      (category && !categories.some((x) => x === category)) ||
      q.length > 160
    )
      return error(400, "Неверный фильтр");
    return paginate(
      read()
        .tickets.filter(
          (t) =>
            (queue || t.author.id === s.user.id) &&
            (!status || t.status === status) &&
            (!category || t.category === category) &&
            `${t.title} ${t.description}`
              .toLowerCase()
              .includes(q.trim().toLowerCase()),
        )
        .sort(
          (a, b) =>
            b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id),
        ),
      request.url,
    );
  }
  return [
    http.get(`${api}/support/tickets`, ({ request }) => list(request, false)),
    http.get(`${api}/admin/support/tickets`, ({ request }) =>
      list(request, true),
    ),
    http.post(`${api}/support/tickets`, async ({ request }) => {
      const s = auth(request, true);
      if (s instanceof Response) return s;
      const parsed = createSchema.safeParse(
        await request.json().catch(() => null),
      );
      if (!parsed.success) return error(400, "Проверьте поля обращения");
      const input = parsed.data;
      const data = read();
      if (
        data.tickets.filter(
          (t) =>
            t.author.id === s.user.id &&
            Date.parse(t.createdAt) > Date.now() - 3600000,
        ).length >= 10
      )
        return error(429, "Не больше 10 обращений в час");
      const now = new Date().toISOString();
      const t: SupportTicket = {
        id: crypto.randomUUID(),
        author: s.user,
        assignedTo: null,
        ...input,
        status: "OPEN",
        priority: "NORMAL",
        commentId: null,
        eventId: null,
        commentText: null,
        commentAuthor: null,
        reportReason: null,
        venueCity: null,
        venueAddress: null,
        createdAt: now,
        updatedAt: now,
      };
      if (input.category === "COMMENT_REPORT") {
        if (!input.commentId || !input.reportReason)
          return error(400, "Укажите комментарий и причину");
        const comment = getComments().find(
          (c) => c.id === input.commentId && c.status === "VISIBLE",
        );
        if (!comment) return error(404, "Комментарий не найден");
        const event = getEvents(s.user.id).find(
          (e) => e.id === comment.eventId,
        );
        if (
          !event ||
          !(
            event.status === "PUBLISHED" ||
            event.viewerIsOrganizer ||
            admin(s) ||
            (event.status !== "DRAFT" &&
              getRegistrations().some(
                (r) => r.eventId === event.id && r.user.id === s.user.id,
              ))
          )
        )
          return error(404, "Комментарий не найден");
        if (
          data.tickets.some(
            (t) =>
              t.author.id === s.user.id &&
              t.commentId === comment.id &&
              !terminal(t),
          )
        )
          return error(
            409,
            "Вы уже сообщили об этом комментарии. Откройте обращение в поддержке.",
          );
        t.commentId = comment.id;
        t.eventId = comment.eventId;
        t.commentText = comment.text;
        t.commentAuthor = comment.author.displayName;
        t.reportReason = input.reportReason;
      } else if (input.commentId || input.reportReason)
        return error(400, "Комментарий указывается только для жалобы");
      if (input.category === "VENUE_SUGGESTION") {
        if (!input.venueCity || !input.venueAddress)
          return error(400, "Укажите город и адрес");
        t.venueCity = input.venueCity;
        t.venueAddress = input.venueAddress;
      } else if (input.venueCity || input.venueAddress)
        return error(400, "Адрес указывается только для площадки");
      data.tickets.push(t);
      persist(data);
      admins(
        t,
        s.user.id,
        "SUPPORT_NEW",
        t.category === "COMMENT_REPORT"
          ? "Новая жалоба на комментарий"
          : "Новое обращение в поддержку",
      );
      return HttpResponse.json(t, { status: 201 });
    }),
    http.get(`${api}/support/tickets/:id`, ({ request, params }) => {
      const s = auth(request);
      if (s instanceof Response) return s;
      const t = ticket(read(), String(params.id), s);
      return t ? HttpResponse.json(t) : error(404, "Обращение не найдено");
    }),
    http.get(`${api}/support/tickets/:id/messages`, ({ request, params }) => {
      const s = auth(request);
      if (s instanceof Response) return s;
      const data = read();
      if (!ticket(data, String(params.id), s))
        return error(404, "Обращение не найдено");
      return paginate(
        data.messages
          .filter((m) => m.ticketId === params.id)
          .sort(
            (a, b) =>
              b.createdAt.localeCompare(a.createdAt) ||
              b.id.localeCompare(a.id),
          ),
        request.url,
      );
    }),
    http.post(
      `${api}/support/tickets/:id/messages`,
      async ({ request, params }) => {
        const s = auth(request, true);
        if (s instanceof Response) return s;
        const input = z
          .object({ text: z.string().trim().min(1).max(5000) })
          .strict()
          .safeParse(await request.json().catch(() => null));
        if (!input.success) return error(400, "Проверьте сообщение");
        const data = read();
        const t = ticket(data, String(params.id), s);
        if (!t) return error(404, "Обращение не найдено");
        if (terminal(t)) return error(409, "Откройте обращение повторно");
        if (
          data.messages.filter(
            (m) =>
              m.ticketId === t.id &&
              m.author.id === s.user.id &&
              Date.parse(m.createdAt) > Date.now() - 3600000,
          ).length >= 60
        )
          return error(429, "Слишком много сообщений");
        const now = new Date(
          Math.max(Date.now(), Date.parse(t.updatedAt) + 1),
        ).toISOString();
        const m: SupportMessage = {
          id: crypto.randomUUID(),
          ticketId: t.id,
          author: s.user,
          fromSupport: admin(s),
          kind: "MESSAGE",
          text: input.data.text,
          createdAt: now,
        };
        data.messages.push(m);
        t.updatedAt = now;
        t.status = admin(s) ? "WAITING_USER" : "OPEN";
        if (admin(s)) t.assignedTo = s.user;
        persist(data);
        notice(
          t,
          s,
          "SUPPORT_REPLY",
          admin(s)
            ? "Ответ службы поддержки"
            : "Пользователь дополнил обращение",
        );
        return HttpResponse.json(m, { status: 201 });
      },
    ),
    http.patch(`${api}/support/tickets/:id`, async ({ request, params }) => {
      const s = auth(request, true);
      if (s instanceof Response) return s;
      const parsed = updateSchema.safeParse(
        await request.json().catch(() => null),
      );
      if (!parsed.success) return error(400, "Укажите статус или приоритет");
      const input = parsed.data;
      const data = read();
      const t = ticket(data, String(params.id), s);
      if (!t) return error(404, "Обращение не найдено");
      if (
        !admin(s) &&
        (input.priority !== undefined ||
          (input.status !== "CLOSED" &&
            !(input.status === "OPEN" && terminal(t))))
      )
        return error(403, "Нет прав");
      if (
        t.commentId &&
        input.status &&
        !["RESOLVED", "CLOSED"].includes(input.status) &&
        data.tickets.some(
          (other) =>
            other.id !== t.id &&
            other.author.id === t.author.id &&
            other.commentId === t.commentId &&
            !terminal(other),
        )
      )
        return error(409, "Уже есть открытая жалоба на этот комментарий");
      const statusChanged = input.status && input.status !== t.status,
        priorityChanged = input.priority && input.priority !== t.priority;
      if (!statusChanged && !priorityChanged) return HttpResponse.json(t);
      if (input.status) t.status = input.status;
      if (input.priority) t.priority = input.priority;
      if (admin(s)) t.assignedTo = s.user;
      const text = [
        statusChanged ? `Статус: ${statusLabels[t.status]}` : "",
        priorityChanged ? `Приоритет: ${priorityLabels[t.priority]}` : "",
      ]
        .filter(Boolean)
        .join(". ");
      t.updatedAt = new Date(
        Math.max(Date.now(), Date.parse(t.updatedAt) + 1),
      ).toISOString();
      data.messages.push({
        id: crypto.randomUUID(),
        ticketId: t.id,
        author: s.user,
        fromSupport: admin(s),
        kind: "STATUS",
        text,
        createdAt: t.updatedAt,
      });
      persist(data);
      notice(t, s, "SUPPORT_STATUS", "Обновление обращения");
      return HttpResponse.json(t);
    }),
  ];
}
