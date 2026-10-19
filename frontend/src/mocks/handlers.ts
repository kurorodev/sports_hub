import { profilePatchSchema } from "../entities/profile/api/mappers";
import { saveProfile } from "./profiles";
import type { EventPreview, Session } from "../shared/api/types";
import { saveModeration } from "./moderation";
import {
  getOrganizations,
  saveOrganization,
  decideOrganization,
} from "./organizations";
import { z } from "zod";
import { http, HttpResponse } from "msw";
import {
  getAccounts,
  createMockAccount,
  mockProfiles,
  getEvents,
  getSports,
  makeSession,
  saveEvent,
  getRegistrations,
  saveRegistration,
  decideRegistration,
} from "./database";
import { apiConfig } from "../shared/api/client";
import { createEventSchema } from "../shared/api/event-schema";
import { signupSchema } from "../shared/api/signup-schema";
import { getComments, saveComment, hideComment } from "./comments";
import { mapHandlers } from "./maps";

function json(body: unknown, init?: ResponseInit) {
  if (body && typeof body === "object" && "code" in body)
    return HttpResponse.json(
      { requestId: crypto.randomUUID(), details: [], ...body },
      init,
    );
  return new HttpResponse(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
}
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
  json({ code: "NOT_FOUND", message: "Не найдено" }, { status: 404 });

function eventVisible(event: EventPreview, session?: Session) {
  return (
    event.status === "PUBLISHED" ||
    event.viewerIsOrganizer ||
    Boolean(session?.systemRoles.includes("ADMIN")) ||
    (event.status !== "DRAFT" && Boolean(event.viewerRegistrationStatus))
  );
}
const moderationSchema = z
  .object({
    reason: z
      .string()
      .min(3)
      .max(1000)
      .refine((value) => value.trim().length > 0),
  })
  .strict();

export const handlers = [
  ...mapHandlers(api, () => makeSession(savedAccount() ?? "")),
  http.get(`${api}/admin/events`, ({ request }) => {
    const session = makeSession(savedAccount() ?? "");
    if (!session)
      return json(
        { code: "UNAUTHENTICATED", message: "Войдите" },
        { status: 401 },
      );
    if (!session.systemRoles.includes("ADMIN"))
      return json(
        { code: "FORBIDDEN", message: "Нет доступа" },
        { status: 403 },
      );
    const p = new URL(request.url).searchParams;
    const q = (p.get("q") ?? "").toLocaleLowerCase("ru");
    const status = p.get("status");
    if (
      status &&
      !["DRAFT", "PUBLISHED", "UNPUBLISHED", "DELETED"].includes(status)
    )
      return json(
        { code: "VALIDATION_ERROR", message: "Неизвестный статус" },
        { status: 400 },
      );
    const page = Math.max(0, Math.floor(Number(p.get("page")) || 0)),
      size = Math.min(
        100,
        Math.max(1, Math.floor(Number(p.get("size")) || 20)),
      );
    const items = getEvents(session.user.id)
      .filter(
        (item) =>
          (!status || item.status === status) &&
          `${item.title} ${item.description}`
            .toLocaleLowerCase("ru")
            .includes(q),
      )
      .sort(
        (a, b) =>
          Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
          a.id.localeCompare(b.id),
      );
    return json({
      items: items.slice(page * size, (page + 1) * size),
      page,
      size,
      total: items.length,
      totalPages: Math.ceil(items.length / size),
    });
  }),
  http.get(`${api}/admin/comments`, ({ request }) => {
    const session = makeSession(savedAccount() ?? "");
    if (!session)
      return json(
        { code: "UNAUTHENTICATED", message: "Войдите" },
        { status: 401 },
      );
    if (!session.systemRoles.includes("ADMIN"))
      return json(
        { code: "FORBIDDEN", message: "Нет доступа" },
        { status: 403 },
      );
    const p = new URL(request.url).searchParams;
    const eventId = p.get("eventId");
    if (eventId && !getEvents().some((item) => item.id === eventId))
      return notFound();
    const page = Math.max(0, Math.floor(Number(p.get("page")) || 0)),
      size = Math.min(
        100,
        Math.max(1, Math.floor(Number(p.get("size")) || 20)),
      );
    const items = getComments()
      .filter((item) => !eventId || item.eventId === eventId)
      .sort(
        (a, b) =>
          Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
          a.id.localeCompare(b.id),
      );
    return json({
      items: items.slice(page * size, (page + 1) * size),
      page,
      size,
      total: items.length,
      totalPages: Math.ceil(items.length / size),
    });
  }),
  http.post(
    `${api}/admin/events/:eventId/unpublish`,
    async ({ params, request }) => {
      const session = makeSession(savedAccount() ?? "");
      if (!session)
        return json(
          { code: "UNAUTHENTICATED", message: "Войдите" },
          { status: 401 },
        );
      if (
        !session.systemRoles.includes("ADMIN") ||
        request.headers.get("X-CSRF-Token") !== session.csrfToken
      )
        return json(
          { code: "FORBIDDEN", message: "Нет доступа" },
          { status: 403 },
        );
      const parsed = moderationSchema.safeParse(
        await request.json().catch(() => null),
      );
      if (!parsed.success)
        return json(
          {
            code: "VALIDATION_ERROR",
            message: "Проверьте причину",
            details: [{ field: "reason", message: "От 3 до 1000 символов" }],
          },
          { status: 400 },
        );
      const event = getEvents(session.user.id).find(
        (item) => item.id === params.eventId,
      );
      if (!event) return notFound();
      if (event.status !== "PUBLISHED")
        return json(
          {
            code: "INVALID_STATUS_TRANSITION",
            message: "Статус уже изменился",
          },
          { status: 409 },
        );
      saveModeration("EVENT", event.id, parsed.data.reason, session.user.id);
      return json(
        getEvents(session.user.id).find((item) => item.id === event.id),
      );
    },
  ),
  http.post(
    `${api}/admin/comments/:commentId/hide`,
    async ({ params, request }) => {
      const session = makeSession(savedAccount() ?? "");
      if (!session)
        return json(
          { code: "UNAUTHENTICATED", message: "Войдите" },
          { status: 401 },
        );
      if (
        !session.systemRoles.includes("ADMIN") ||
        request.headers.get("X-CSRF-Token") !== session.csrfToken
      )
        return json(
          { code: "FORBIDDEN", message: "Нет доступа" },
          { status: 403 },
        );
      const parsed = moderationSchema.safeParse(
        await request.json().catch(() => null),
      );
      if (!parsed.success)
        return json(
          { code: "VALIDATION_ERROR", message: "Проверьте причину" },
          { status: 400 },
        );
      const comment = getComments().find(
        (item) => item.id === params.commentId,
      );
      if (!comment) return notFound();
      if (comment.status !== "VISIBLE")
        return json(
          {
            code: "INVALID_STATUS_TRANSITION",
            message: "Комментарий уже скрыт",
          },
          { status: 409 },
        );
      saveModeration(
        "COMMENT",
        comment.id,
        parsed.data.reason,
        session.user.id,
      );
      return json(hideComment(comment));
    },
  ),
  http.get(`${api}/me/organizations`, () => {
    const session = makeSession(savedAccount() ?? "");
    if (!session)
      return json(
        { code: "UNAUTHENTICATED", message: "Войдите" },
        { status: 401 },
      );
    return json(
      getOrganizations().filter(
        (item) => item.createdBy.id === session.user.id,
      ),
    );
  }),
  http.get(`${api}/organizations`, ({ request }) => {
    const p = new URL(request.url).searchParams;
    const q = (p.get("q") ?? "").toLocaleLowerCase("ru");
    const page = Math.max(0, Math.floor(Number(p.get("page")) || 0));
    const size = Math.min(
      100,
      Math.max(1, Math.floor(Number(p.get("size")) || 20)),
    );
    const items = getOrganizations()
      .filter(
        (item) =>
          item.status === "APPROVED" &&
          `${item.name} ${item.description}`
            .toLocaleLowerCase("ru")
            .includes(q),
      )
      .sort(
        (a, b) =>
          Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
          a.id.localeCompare(b.id),
      );
    return json({
      items: items.slice(page * size, (page + 1) * size),
      page,
      size,
      total: items.length,
      totalPages: Math.ceil(items.length / size),
    });
  }),
  http.get(`${api}/admin/organizations`, ({ request }) => {
    const session = makeSession(savedAccount() ?? "");
    if (!session)
      return json(
        { code: "UNAUTHENTICATED", message: "Войдите" },
        { status: 401 },
      );
    if (!session.systemRoles.includes("ADMIN"))
      return json(
        { code: "FORBIDDEN", message: "Нет доступа" },
        { status: 403 },
      );
    const p = new URL(request.url).searchParams;
    const q = (p.get("q") ?? "").toLocaleLowerCase("ru");
    const status = p.get("status");
    const page = Math.max(0, Math.floor(Number(p.get("page")) || 0));
    const size = Math.min(
      100,
      Math.max(1, Math.floor(Number(p.get("size")) || 20)),
    );
    if (status && !["PENDING", "APPROVED", "REJECTED"].includes(status))
      return json(
        { code: "VALIDATION_ERROR", message: "Неизвестный статус" },
        { status: 400 },
      );
    const items = getOrganizations()
      .filter(
        (item) =>
          (!status || item.status === status) &&
          `${item.name} ${item.description}`
            .toLocaleLowerCase("ru")
            .includes(q),
      )
      .sort(
        (a, b) =>
          Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
          a.id.localeCompare(b.id),
      );
    return json({
      items: items.slice(page * size, (page + 1) * size),
      page,
      size,
      total: items.length,
      totalPages: Math.ceil(items.length / size),
    });
  }),
  http.get(`${api}/organizations/:organizationId`, ({ params }) => {
    const session = makeSession(savedAccount() ?? "");
    const org = getOrganizations().find(
      (item) => item.id === params.organizationId,
    );
    return org &&
      (org.status === "APPROVED" ||
        org.createdBy.id === session?.user.id ||
        session?.systemRoles.includes("ADMIN"))
      ? json(org)
      : notFound();
  }),
  http.get(
    `${api}/organizations/:organizationId/events`,
    ({ params, request }) => {
      const session = makeSession(savedAccount() ?? "");
      const org = getOrganizations().find(
        (item) => item.id === params.organizationId,
      );
      if (
        !org ||
        (org.status !== "APPROVED" &&
          org.createdBy.id !== session?.user.id &&
          !session?.systemRoles.includes("ADMIN"))
      )
        return notFound();
      const p = new URL(request.url).searchParams;
      const page = Math.max(0, Math.floor(Number(p.get("page")) || 0));
      const size = Math.min(
        100,
        Math.max(1, Math.floor(Number(p.get("size")) || 20)),
      );
      const privileged =
        org.createdBy.id === session?.user.id ||
        session?.systemRoles.includes("ADMIN");
      const items = getEvents(session?.user.id)
        .filter(
          (item) =>
            item.organizer.type === "ORGANIZATION" &&
            item.organizer.id === org.id &&
            (privileged || item.status === "PUBLISHED"),
        )
        .sort(
          (a, b) =>
            Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
            a.id.localeCompare(b.id),
        );
      return json({
        items: items.slice(page * size, (page + 1) * size),
        page,
        size,
        total: items.length,
        totalPages: Math.ceil(items.length / size),
      });
    },
  ),
  http.post(`${api}/organizations`, async ({ request }) => {
    const session = makeSession(savedAccount() ?? "");
    if (!session)
      return json(
        { code: "UNAUTHENTICATED", message: "Войдите" },
        { status: 401 },
      );
    if (request.headers.get("X-CSRF-Token") !== session.csrfToken)
      return json(
        { code: "FORBIDDEN", message: "Сессия изменилась" },
        { status: 403 },
      );
    const parsed = z
      .object({
        name: z.string().trim().min(2).max(160),
        description: z.string().trim().min(10).max(2000),
        sports: z.array(z.string().uuid()).optional(),
        avatarUrl: z.url().nullable().optional(),
      })
      .strict()
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return json(
        { code: "VALIDATION_ERROR", message: "Проверьте заявку" },
        { status: 400 },
      );
    if (
      parsed.data.sports?.some(
        (id) => !getSports().some((sport) => sport.id === id),
      )
    )
      return notFound();
    return json(saveOrganization(parsed.data, session.user), { status: 201 });
  }),
  http.post(
    `${api}/admin/organizations/:organizationId/decision`,
    async ({ params, request }) => {
      const session = makeSession(savedAccount() ?? "");
      if (!session)
        return json(
          { code: "UNAUTHENTICATED", message: "Войдите" },
          { status: 401 },
        );
      if (
        !session.systemRoles.includes("ADMIN") ||
        request.headers.get("X-CSRF-Token") !== session.csrfToken
      )
        return json(
          { code: "FORBIDDEN", message: "Нет доступа" },
          { status: 403 },
        );
      const parsed = z
        .object({
          decision: z.enum(["APPROVE", "REJECT"]),
          reason: z.string().min(3).max(1000).nullable().optional(),
        })
        .strict()
        .safeParse(await request.json().catch(() => null));
      if (
        !parsed.success ||
        (parsed.data.decision === "REJECT" &&
          (!parsed.data.reason || parsed.data.reason.trim().length < 3))
      )
        return json(
          { code: "VALIDATION_ERROR", message: "Укажите причину отказа" },
          { status: 400 },
        );
      const org = getOrganizations().find(
        (item) => item.id === params.organizationId,
      );
      if (!org) return notFound();
      if (org.status !== "PENDING")
        return json(
          {
            code: "INVALID_STATUS_TRANSITION",
            message: "Заявка уже рассмотрена",
          },
          { status: 409 },
        );
      return json(
        decideOrganization(org, parsed.data.decision, parsed.data.reason),
      );
    },
  ),

  http.get(`${api}/events/:eventId/comments`, ({ params, request }) => {
    const session = makeSession(savedAccount() ?? "");
    const event = getEvents(session?.user.id).find(
      (item) => item.id === params.eventId,
    );
    if (!event) return notFound();
    const admin = session?.systemRoles.includes("ADMIN");
    if (
      event.status !== "PUBLISHED" &&
      !event.viewerIsOrganizer &&
      !(event.status !== "DRAFT" && event.viewerRegistrationStatus) &&
      !admin
    )
      return notFound();
    const p = new URL(request.url).searchParams;
    const page = Math.max(0, Math.floor(Number(p.get("page")) || 0));
    const size = Math.min(
      100,
      Math.max(1, Math.floor(Number(p.get("size")) || 10)),
    );
    const items = getComments()
      .filter(
        (item) =>
          item.eventId === event.id && (admin || item.status === "VISIBLE"),
      )
      .sort(
        (a, b) =>
          Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
          a.id.localeCompare(b.id),
      );
    return json({
      items: items.slice(page * size, (page + 1) * size),
      page,
      size,
      total: items.length,
      totalPages: Math.ceil(items.length / size),
    });
  }),
  http.post(`${api}/events/:eventId/comments`, async ({ params, request }) => {
    const session = makeSession(savedAccount() ?? "");
    if (!session)
      return json(
        { code: "UNAUTHENTICATED", message: "Войдите" },
        { status: 401 },
      );
    if (request.headers.get("X-CSRF-Token") !== session.csrfToken)
      return json(
        { code: "FORBIDDEN", message: "Сессия изменилась" },
        { status: 403 },
      );
    const event = getEvents(session.user.id).find(
      (item) => item.id === params.eventId,
    );
    if (!event) return notFound();
    if (
      event.status !== "PUBLISHED" &&
      !event.viewerIsOrganizer &&
      !(event.status !== "DRAFT" && event.viewerRegistrationStatus) &&
      !session.systemRoles.includes("ADMIN")
    )
      return notFound();
    if (event.status !== "PUBLISHED")
      return json(
        { code: "EVENT_NOT_AVAILABLE", message: "Обсуждение закрыто" },
        { status: 409 },
      );
    const parsed = z
      .object({
        text: z
          .string()
          .min(1)
          .max(2000)
          .refine((value) => value.trim().length > 0),
      })
      .strict()
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return json(
        {
          code: "VALIDATION_ERROR",
          message: "Проверьте сообщение",
          details: [{ field: "text", message: "От 1 до 2000 символов" }],
        },
        { status: 400 },
      );
    return json(saveComment(event.id, session.user, parsed.data.text), {
      status: 201,
    });
  }),
  http.get(`${api}/me/profile`, () => {
    const session = makeSession(savedAccount() ?? "");
    return session
      ? json(session.user)
      : json({ code: "UNAUTHENTICATED", message: "Войдите" }, { status: 401 });
  }),
  http.get(`${api}/users/:userId`, ({ params }) => {
    const profile = mockProfiles().find((item) => item.id === params.userId);
    return profile ? json(profile) : notFound();
  }),
  http.patch(`${api}/me/profile`, async ({ request }) => {
    const session = makeSession(savedAccount() ?? "");
    if (!session)
      return json(
        { code: "UNAUTHENTICATED", message: "Войдите" },
        { status: 401 },
      );
    if (request.headers.get("X-CSRF-Token") !== session.csrfToken)
      return json(
        { code: "FORBIDDEN", message: "Сессия изменилась" },
        { status: 403 },
      );
    const parsed = profilePatchSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return json(
        { code: "VALIDATION_ERROR", message: "Проверьте поля профиля" },
        { status: 400 },
      );
    const patch = parsed.data;
    if (
      patch.nickname &&
      mockProfiles().some(
        (item) =>
          item.id !== session.user.id &&
          item.nickname.toLowerCase() === patch.nickname!.trim().toLowerCase(),
      )
    )
      return json(
        { code: "CONFLICT", message: "Никнейм уже занят" },
        { status: 409 },
      );
    if (
      patch.sportsPreferences?.some(
        (item) => !getSports().some((sport) => sport.id === item.sportId),
      )
    )
      return notFound();
    const normalized = Object.fromEntries(
      Object.entries(patch).map(([field, value]) => [
        field,
        typeof value === "string" ? value.trim() : value,
      ]),
    );
    return json(saveProfile({ ...session.user, ...normalized }));
  }),
  http.get(`${api}/demo/accounts`, () => json(getAccounts())),
  http.post(`${api}/demo/accounts`, async ({ request }) => {
    const parsed = signupSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return json(
        {
          code: "VALIDATION_ERROR",
          message: "Проверьте данные аккаунта",
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    const { nickname, displayName } = parsed.data;
    if (
      mockProfiles().some(
        (profile) => profile.nickname.toLowerCase() === nickname.toLowerCase(),
      )
    )
      return json(
        { code: "CONFLICT", message: "Никнейм уже занят" },
        { status: 409 },
      );
    try {
      const accountId = createMockAccount(nickname, displayName);
      if (typeof localStorage !== "undefined")
        localStorage.setItem(sessionKey, accountId);
      memoryAccount = accountId;
      return json(makeSession(accountId), { status: 201 });
    } catch {
      return json(
        { code: "INTERNAL_ERROR", message: "Не удалось сохранить демоаккаунт" },
        { status: 500 },
      );
    }
  }),
  http.post(`${api}/demo/session`, async ({ request }) => {
    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      !("accountId" in body) ||
      typeof body.accountId !== "string"
    ) {
      return json(
        { code: "VALIDATION_ERROR", message: "Укажите аккаунт" },
        { status: 422 },
      );
    }
    const session = makeSession(body.accountId);
    if (!session) return notFound();
    memoryAccount = body.accountId;
    if (typeof localStorage !== "undefined")
      localStorage.setItem(sessionKey, body.accountId);
    return json(session);
  }),
  http.get(`${api}/session`, () => {
    const session = makeSession(savedAccount() ?? "");
    return session
      ? json(session)
      : json({ code: "UNAUTHENTICATED", message: "Войдите" }, { status: 401 });
  }),
  http.get(`${api}/sports`, () => json(getSports())),
  http.post(`${api}/events`, async ({ request }) => {
    const session = makeSession(savedAccount() ?? "");
    if (!session)
      return json(
        { code: "UNAUTHENTICATED", message: "Войдите" },
        { status: 401 },
      );
    if (request.headers.get("X-CSRF-Token") !== session.csrfToken) {
      return json(
        { code: "FORBIDDEN", message: "Сессия изменилась. Обновите страницу." },
        { status: 403 },
      );
    }
    const parsed = createEventSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return json(
        { code: "VALIDATION_ERROR", message: "Проверьте поля", details },
        { status: 422 },
      );
    }
    if (
      parsed.data.organizer.type === "USER" &&
      parsed.data.organizer.id !== session.user.id
    )
      return json(
        { code: "FORBIDDEN", message: "Нет доступа к организатору" },
        { status: 403 },
      );
    if (parsed.data.organizer.type === "ORGANIZATION") {
      const org = getOrganizations().find(
        (item) => item.id === parsed.data.organizer.id,
      );
      if (!org) return notFound();
      if (org.createdBy.id !== session.user.id)
        return json(
          { code: "FORBIDDEN", message: "Вы не представитель организации" },
          { status: 403 },
        );
      if (org.status !== "APPROVED")
        return json(
          {
            code: "ORGANIZATION_NOT_APPROVED",
            message: "Организация ещё не допущена",
          },
          { status: 403 },
        );
    }
    const event = saveEvent(parsed.data, session.user.id);
    if (!event)
      return json(
        {
          code: "VALIDATION_ERROR",
          message: "Спорт больше не доступен",
          details: [
            {
              field: "sport.sportId",
              message: "Выберите спорт из списка или добавьте свой",
            },
          ],
        },
        { status: 422 },
      );
    return json(event, { status: 201 });
  }),
  http.get(`${api}/events`, ({ request }) => {
    const p = new URL(request.url).searchParams;
    const q = (p.get("q") ?? "").trim().toLocaleLowerCase("ru");
    let items = getEvents(makeSession(savedAccount() ?? "")?.user.id).filter(
      (event) =>
        event.status === "PUBLISHED" &&
        (!q ||
          `${event.title} ${event.description}`
            .toLocaleLowerCase("ru")
            .includes(q)) &&
        (!p.get("sportId") || event.sport.id === p.get("sportId")) &&
        (!p.get("city") || event.location.city === p.get("city")) &&
        (!p.get("skillLevel") || event.skillLevel === p.get("skillLevel")) &&
        (!p.get("joinMode") || event.joinMode === p.get("joinMode")) &&
        (!p.get("from") ||
          Date.parse(event.startsAt) >= Date.parse(p.get("from")!)) &&
        (!p.get("to") ||
          Date.parse(event.startsAt) <= Date.parse(p.get("to")!)) &&
        (p.get("hasSpots") !== "true" ||
          event.maxParticipants == null ||
          event.confirmedCount < event.maxParticipants) &&
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
    return json({
      items: items.slice(page * size, (page + 1) * size),
      page,
      size,
      total: items.length,
      totalPages: Math.ceil(items.length / size),
    });
  }),
  http.get(`${api}/events/:eventId`, ({ params }) => {
    const session = makeSession(savedAccount() ?? "");
    const event = getEvents(session?.user.id).find(
      (item) => item.id === params.eventId,
    );
    return event && eventVisible(event, session) ? json(event) : notFound();
  }),
  http.get(`${api}/events/:eventId/team`, ({ params }) => {
    const session = makeSession(savedAccount() ?? "");
    const event = getEvents(session?.user.id).find(
      (item) => item.id === params.eventId,
    );
    if (!event || !eventVisible(event, session)) return notFound();
    const available =
      event.status === "PUBLISHED" && Date.parse(event.startsAt) > Date.now();
    const canJoin =
      event.viewerRegistrationStatus == null ||
      event.viewerRegistrationStatus === "CANCELLED";
    const full =
      event.maxParticipants != null &&
      event.confirmedCount >= event.maxParticipants;
    return json({
      eventId: event.id,
      maxParticipants: event.maxParticipants,
      confirmedCount: event.confirmedCount,
      pendingCount: event.pendingCount,
      waitlistedCount: 0,
      spotsLeft: event.spotsLeft,
      viewerStatus: event.viewerRegistrationStatus,
      joinAvailable:
        available && canJoin && (event.joinMode === "APPROVAL" || !full),
      waitlistAvailable:
        available && canJoin && event.joinMode === "OPEN" && full,
    });
  }),
  http.get(`${api}/events/:eventId/my-registration`, ({ params }) => {
    const session = makeSession(savedAccount() ?? "");
    if (!session)
      return json(
        { code: "UNAUTHENTICATED", message: "Войдите" },
        { status: 401 },
      );
    if (!getEvents().some((event) => event.id === params.eventId))
      return notFound();
    const registration = getRegistrations(String(params.eventId)).find(
      (item) => item.user.id === session.user.id,
    );
    return registration ? json(registration) : notFound();
  }),
  http.get(`${api}/events/:eventId/participants`, ({ params, request }) => {
    const session = makeSession(savedAccount() ?? "");
    const event = getEvents(session?.user.id).find(
      (item) => item.id === params.eventId,
    );
    if (!event || !eventVisible(event, session)) return notFound();
    const p = new URL(request.url).searchParams;
    const page = Math.max(0, Math.floor(Number(p.get("page")) || 0));
    const size = Math.min(
      50,
      Math.max(1, Math.floor(Number(p.get("size")) || 12)),
    );
    const items = getRegistrations(String(params.eventId))
      .filter((item) => item.status === "CONFIRMED")
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((item) => item.user);
    return json({
      items: items.slice(page * size, (page + 1) * size),
      page,
      size,
      total: items.length,
      totalPages: Math.ceil(items.length / size),
    });
  }),
  http.post(
    `${api}/events/:eventId/registrations`,
    async ({ params, request }) => {
      const session = makeSession(savedAccount() ?? "");
      if (!session)
        return json(
          { code: "UNAUTHENTICATED", message: "Войдите" },
          { status: 401 },
        );
      if (request.headers.get("X-CSRF-Token") !== session.csrfToken)
        return json(
          { code: "FORBIDDEN", message: "Обновите сессию" },
          { status: 403 },
        );
      const input = z
        .object({ message: z.string().max(1000).nullable().optional() })
        .strict()
        .safeParse(await request.json().catch(() => null));
      if (!input.success)
        return json(
          {
            code: "VALIDATION_ERROR",
            message: "Ожидается JSON объекта заявки",
          },
          { status: 422 },
        );
      const event = getEvents(session.user.id).find(
        (item) => item.id === params.eventId,
      );
      if (!event) return notFound();
      if (
        event.status !== "PUBLISHED" ||
        Date.parse(event.startsAt) <= Date.now()
      )
        return json(
          {
            code: "EVENT_NOT_AVAILABLE",
            message: "Запись на эту встречу закрыта",
          },
          { status: 409 },
        );
      if (
        getRegistrations(event.id).some(
          (item) => item.user.id === session.user.id,
        )
      )
        return json(
          { code: "ALREADY_REGISTERED", message: "Вы уже участвуете" },
          { status: 409 },
        );
      if (
        event.joinMode === "OPEN" &&
        event.maxParticipants != null &&
        event.confirmedCount >= event.maxParticipants
      )
        return json(
          { code: "EVENT_FULL", message: "Все места уже заняты" },
          { status: 409 },
        );
      // Validation + append run synchronously in this mock context, including duplicate/capacity checks.
      return json(
        saveRegistration(
          event.id,
          session.user,
          event.joinMode === "OPEN" ? "CONFIRMED" : "PENDING",
          input.data.message,
        ),
        {
          status: 201,
        },
      );
    },
  ),
  http.get(`${api}/events/:eventId/registrations`, ({ params, request }) => {
    const session = makeSession(savedAccount() ?? "");
    if (!session)
      return json(
        { code: "UNAUTHENTICATED", message: "Войдите" },
        { status: 401 },
      );
    const event = getEvents(session.user.id).find(
      (item) => item.id === params.eventId,
    );
    if (!event) return notFound();
    if (!event.viewerIsOrganizer && !session.systemRoles.includes("ADMIN"))
      return json(
        { code: "FORBIDDEN", message: "Нет доступа к заявкам" },
        { status: 403 },
      );
    const p = new URL(request.url).searchParams;
    const status = p.get("status");
    if (
      status &&
      !["PENDING", "CONFIRMED", "REJECTED", "CANCELLED", "WAITLISTED"].includes(
        status,
      )
    )
      return json(
        { code: "VALIDATION_ERROR", message: "Неизвестный статус" },
        { status: 400 },
      );
    const page = Math.max(0, Math.floor(Number(p.get("page")) || 0));
    const size = Math.min(
      100,
      Math.max(1, Math.floor(Number(p.get("size")) || 20)),
    );
    const items = getRegistrations(event.id)
      .filter((item) => !status || item.status === status)
      .sort(
        (a, b) =>
          Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
          a.id.localeCompare(b.id),
      );
    return json({
      items: items.slice(page * size, (page + 1) * size),
      page,
      size,
      total: items.length,
      totalPages: Math.ceil(items.length / size),
    });
  }),
  http.post(
    `${api}/events/:eventId/registrations/:registrationId/decision`,
    async ({ params, request }) => {
      const session = makeSession(savedAccount() ?? "");
      if (!session)
        return json(
          { code: "UNAUTHENTICATED", message: "Войдите" },
          { status: 401 },
        );
      if (request.headers.get("X-CSRF-Token") !== session.csrfToken)
        return json(
          { code: "FORBIDDEN", message: "Обновите сессию" },
          { status: 403 },
        );
      const parsed = z
        .object({
          decision: z.enum(["APPROVE", "REJECT"]),
          reason: z.string().max(1000).nullable().optional(),
        })
        .strict()
        .safeParse(await request.json().catch(() => null));
      if (!parsed.success)
        return json(
          {
            code: "VALIDATION_ERROR",
            message: "Проверьте решение",
            details: parsed.error.issues.map((issue) => ({
              field: issue.path.join("."),
              message: issue.message,
            })),
          },
          { status: 422 },
        );
      // No await between reading current state and saving the decision: atomic in this mock context.
      const event = getEvents(session.user.id).find(
        (item) => item.id === params.eventId,
      );
      if (!event) return notFound();
      if (!event.viewerIsOrganizer)
        return json(
          {
            code: "NOT_EVENT_ORGANIZER",
            message: "Только организатор принимает решения",
          },
          { status: 403 },
        );
      if (
        event.status !== "PUBLISHED" ||
        Date.parse(event.startsAt) <= Date.now()
      )
        return json(
          { code: "EVENT_NOT_AVAILABLE", message: "Рассмотрение закрыто" },
          { status: 409 },
        );
      const registration = getRegistrations(event.id).find(
        (item) => item.id === params.registrationId,
      );
      if (!registration) return notFound();
      if (event.joinMode !== "APPROVAL" || registration.status !== "PENDING")
        return json(
          {
            code: "INVALID_STATUS_TRANSITION",
            message: "Заявка уже рассмотрена",
          },
          { status: 409 },
        );
      if (
        parsed.data.decision === "APPROVE" &&
        event.maxParticipants != null &&
        event.confirmedCount >= event.maxParticipants
      )
        return json(
          { code: "EVENT_FULL", message: "Свободных мест нет" },
          { status: 409 },
        );
      return json(
        decideRegistration(
          registration,
          parsed.data.decision,
          parsed.data.reason,
        ),
      );
    },
  ),
];
