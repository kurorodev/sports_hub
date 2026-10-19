import { http, HttpResponse } from "msw";
import { z } from "zod";
import type { components } from "../shared/api/generated/schema";
import type { EventPreview, Registration, Session } from "../shared/api/types";
import { notificationKinds } from "../entities/notification/model";
import { getEvents, getRegistrations } from "./database";
import { getOrganizations } from "./organizations";

type Notice = components["schemas"]["Notification"];
type Kind = components["schemas"]["NotificationType"];
const schema = z.object({
  recipientId: z.string().uuid(),
  dedupeKey: z.string(),
  id: z.string().uuid(),
  type: z.enum(notificationKinds),
  title: z.string(),
  text: z.string(),
  reason: z.string().nullable(),
  href: z.string().nullable(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
});
const key = "dvizh.mock.notifications.v1";
const month = 30 * 86400_000;
let memory: z.infer<typeof schema>[] = [];
function records() {
  const saved =
    typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  return saved === null ? memory : z.array(schema).parse(JSON.parse(saved));
}
function persist(items: typeof memory) {
  memory = items;
  if (typeof localStorage !== "undefined")
    localStorage.setItem(key, JSON.stringify(items));
}
export function resetMockNotifications() {
  memory = [];
  if (typeof localStorage !== "undefined") localStorage.removeItem(key);
}
export function notify(
  recipientId: string,
  type: Kind,
  title: string,
  text: string,
  reason: string | null,
  href: string | null,
  dedupeKey: string = crypto.randomUUID(),
) {
  const items = records();
  if (
    items.some(
      (n) => n.recipientId === recipientId && n.dedupeKey === dedupeKey,
    )
  )
    return;
  persist([
    ...items,
    {
      id: crypto.randomUUID(),
      recipientId,
      dedupeKey,
      type,
      title,
      text,
      reason,
      href,
      createdAt: new Date().toISOString(),
      readAt: null,
    },
  ]);
}
export function mockOwner(event: EventPreview) {
  return event.organizer.type === "USER"
    ? event.organizer.id
    : getOrganizations().find((o) => o.id === event.organizer.id)?.createdBy.id;
}
export function notifyRegistration(
  event: EventPreview,
  registration: Registration,
  newlyJoined: boolean,
) {
  const labels = {
    CONFIRMED: "Участие подтверждено",
    PENDING: "Заявка отправлена",
    REJECTED: "Заявка отклонена",
    WAITLISTED: "Вы в листе ожидания",
    CANCELLED: "Участие отменено",
  };
  notify(
    registration.user.id,
    "REGISTRATION_STATUS",
    labels[registration.status],
    event.title,
    registration.decisionReason ?? null,
    `/events/${event.id}`,
  );
  const owner = mockOwner(event);
  if (newlyJoined && owner && owner !== registration.user.id)
    notify(
      owner,
      "NEW_REGISTRATION",
      registration.status === "PENDING"
        ? "Новая заявка на участие"
        : registration.status === "WAITLISTED"
          ? "Новая запись в лист ожидания"
          : "Новый участник",
      event.title,
      null,
      `/events/${event.id}`,
    );
}
export function notifyUnpublished(event: EventPreview, reason: string) {
  const owner = mockOwner(event);
  if (owner)
    notify(
      owner,
      "EVENT_UNPUBLISHED",
      "Мероприятие снято с публикации",
      event.title,
      reason,
      `/events/${event.id}`,
      `unpublished:${event.id}`,
    );
  for (const user of new Set(
    getRegistrations(event.id)
      .filter((r) => ["PENDING", "CONFIRMED", "WAITLISTED"].includes(r.status))
      .map((r) => r.user.id),
  )) {
    if (user !== owner)
      notify(
        user,
        "EVENT_UNPUBLISHED",
        "Мероприятие снято с публикации",
        `${event.title}. Запись и обсуждение закрыты.`,
        null,
        `/events/${event.id}`,
        `unpublished:${event.id}`,
      );
  }
}
function reminders() {
  for (const event of getEvents()) {
    const remaining = Date.parse(event.startsAt) - Date.now();
    if (event.status !== "PUBLISHED" || remaining <= 0 || remaining > 3600_000)
      continue;
    const users = new Set(
      getRegistrations(event.id)
        .filter((r) => r.status === "CONFIRMED")
        .map((r) => r.user.id),
    );
    const owner = mockOwner(event);
    if (owner) users.add(owner);
    for (const user of users)
      notify(
        user,
        "EVENT_STARTING",
        "Встреча скоро начнётся",
        `${event.title}. Начало — в течение часа.`,
        null,
        `/events/${event.id}`,
        `starting:${event.id}:${event.startsAt}`,
      );
  }
}
function dto(record: z.infer<typeof schema>): Notice {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    text: record.text,
    reason: record.reason,
    href: record.href,
    createdAt: record.createdAt,
    readAt: record.readAt,
  };
}
function error(status: number, code: string, message: string) {
  return HttpResponse.json(
    { code, message, details: [], requestId: crypto.randomUUID() },
    { status },
  );
}
export function notificationHandlers(
  api: string,
  session: () => Session | undefined,
) {
  return [
    http.get(`${api}/me/notifications`, ({ request }) => {
      const viewer = session();
      if (!viewer) return error(401, "UNAUTHENTICATED", "Войдите в аккаунт");
      const p = new URL(request.url).searchParams;
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
        return error(400, "VALIDATION_ERROR", "Проверьте страницу и размер");
      reminders();
      const now = Date.now();
      const items = records()
        .filter(
          (n) =>
            n.recipientId === viewer.user.id &&
            Date.parse(n.createdAt) >= now - month &&
            Date.parse(n.createdAt) <= now,
        )
        .sort(
          (a, b) =>
            Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
            b.id.localeCompare(a.id),
        );
      const body: components["schemas"]["NotificationPage"] = {
        items: items.slice(page * size, (page + 1) * size).map(dto),
        page,
        size,
        total: items.length,
        totalPages: Math.ceil(items.length / size),
        unreadCount: items.filter((n) => !n.readAt).length,
        asOf: new Date(now).toISOString(),
      };
      return HttpResponse.json(body);
    }),
    http.post(`${api}/me/notifications/read-all`, async ({ request }) => {
      const viewer = session();
      if (!viewer) return error(401, "UNAUTHENTICATED", "Войдите в аккаунт");
      if (request.headers.get("X-CSRF-Token") !== viewer.csrfToken)
        return error(403, "FORBIDDEN", "Обновите сессию");
      const parsed = z
        .object({ through: z.string().datetime({ offset: true }) })
        .strict()
        .safeParse(await request.json().catch(() => null));
      if (!parsed.success)
        return error(400, "VALIDATION_ERROR", "Укажите границу прочтения");
      const now = Date.now(),
        through = Math.min(Date.parse(parsed.data.through), now);
      persist(
        records().map((n) =>
          n.recipientId === viewer.user.id &&
          !n.readAt &&
          Date.parse(n.createdAt) <= through &&
          Date.parse(n.createdAt) >= now - month
            ? { ...n, readAt: new Date(now).toISOString() }
            : n,
        ),
      );
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(
      `${api}/me/notifications/:notificationId/read`,
      ({ request, params }) => {
        const viewer = session();
        if (!viewer) return error(401, "UNAUTHENTICATED", "Войдите в аккаунт");
        if (request.headers.get("X-CSRF-Token") !== viewer.csrfToken)
          return error(403, "FORBIDDEN", "Обновите сессию");
        if (!z.string().uuid().safeParse(params.notificationId).success)
          return error(400, "VALIDATION_ERROR", "Некорректный ID");
        const items = records(),
          item = items.find(
            (n) =>
              n.id === params.notificationId &&
              n.recipientId === viewer.user.id &&
              Date.parse(n.createdAt) >= Date.now() - month,
          );
        if (!item) return error(404, "NOT_FOUND", "Не найдено");
        item.readAt ??= new Date().toISOString();
        persist(items);
        return HttpResponse.json(dto(item));
      },
    ),
  ];
}
