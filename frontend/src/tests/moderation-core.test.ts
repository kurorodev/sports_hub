import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./setup";
import { request } from "../shared/api/client";
import { getEvents, mockId, mockUser } from "../mocks/database";
import {
  readModerationEvent,
  readModerationComment,
  readModerationEvents,
  readModerationComments,
} from "../entities/moderation/api/mappers";
import { createHttpModerationRepository } from "../entities/moderation/api/http-moderation-repository";
import {
  ModerationFailure,
  type ModerationRepository,
} from "../entities/moderation/model";
import { moderateContent } from "../features/moderate-content/model/moderate-content";
const dto = {
  ...getEvents()[0],
  status: "UNPUBLISHED" as const,
  moderationReason: "Некорректные условия встречи",
};
const event = readModerationEvent(dto);
const commentDto = {
  id: mockId("comment"),
  eventId: dto.id,
  author: mockUser("user-maria", "Мария"),
  text: "Некорректный текст",
  status: "HIDDEN",
  createdAt: "2026-10-19T12:00:00Z",
  updatedAt: "2026-10-19T12:00:00Z",
};
const comment = readModerationComment(commentDto);
const action = {
  kind: "event" as const,
  id: event.id,
  reason: event.reason!,
  viewerId: "admin",
};
function repository(): ModerationRepository {
  return {
    events: vi.fn(),
    comments: vi.fn(),
    unpublish: vi.fn(async () => event),
    hide: vi.fn(async () => comment),
  };
}
describe("moderation core", () => {
  it("accepts the server status without returning a private moderation reason", async () => {
    const repo = repository();
    repo.unpublish = vi.fn(async () => ({ ...event, reason: null }));
    expect((await moderateContent(repo, action)).kind).toBe("event");
  });
  it("accepts a 1000-character reason at the upper contract boundary", async () => {
    const reason = "a".repeat(1000);
    const repo = repository();
    repo.unpublish = vi.fn(async () => ({ ...event, reason }));
    expect((await moderateContent(repo, { ...action, reason })).kind).toBe(
      "event",
    );
    expect(repo.unpublish).toHaveBeenCalledExactlyOnceWith(event.id, reason);
  });
  it("confirms only the server's corresponding state and trims reason", async () => {
    const repo = repository();
    expect(
      await moderateContent(repo, { ...action, reason: ` ${action.reason} ` }),
    ).toEqual({ kind: "event", event });
    expect(repo.unpublish).toHaveBeenCalledExactlyOnceWith(
      event.id,
      action.reason,
    );
    expect(
      await moderateContent(repo, {
        kind: "comment",
        id: comment.id,
        eventId: comment.eventId,
        reason: "Оскорбление",
        viewerId: "admin",
      }),
    ).toEqual({ kind: "comment", comment });
  });
  it.each(["", "  ", "ab", "a".repeat(1001)])(
    "does not submit an invalid reason",
    async (reason) => {
      const repo = repository();
      await expect(
        moderateContent(repo, { ...action, reason }),
      ).rejects.toMatchObject({ code: "invalid-input" });
      expect(repo.unpublish).not.toHaveBeenCalled();
    },
  );
  it.each([
    { ...event, id: mockId("other") },
    { ...event, status: "PUBLISHED" as const },
  ])("rejects a wrong event/status", async (result) => {
    const repo = repository();
    repo.unpublish = vi.fn(async () => result);
    await expect(moderateContent(repo, action)).rejects.toMatchObject({
      code: "invalid-response",
    });
  });
  it.each([
    { ...comment, id: mockId("other") },
    { ...comment, eventId: mockId("other") },
    { ...comment, status: "VISIBLE" as const },
  ])("rejects a wrong or unchanged hidden comment", async (result) => {
    const repo = repository();
    repo.hide = vi.fn(async () => result);
    await expect(
      moderateContent(repo, {
        kind: "comment",
        id: comment.id,
        eventId: comment.eventId,
        reason: "Причина",
        viewerId: "admin",
      }),
    ).rejects.toMatchObject({ code: "invalid-response" });
  });
});
describe("moderation HTTP boundary", () => {
  it("maps admin-only hidden content and converts event dates to UTC explicitly", () => {
    expect(event.startsAt).toBe(new Date(dto.startsAt).toISOString());
    expect(event.organizer).toEqual({
      id: dto.organizer.id,
      name: dto.organizer.name,
      type: dto.organizer.type,
    });
    expect(comment.text).toBe(commentDto.text);
    expect(comment).not.toHaveProperty("createdAt");
  });
  it.each([
    {},
    { ...dto, status: "UNKNOWN" },
    { ...dto, organizer: null },
    { ...dto, createdAt: "2026-10-19T12:00:00" },
  ])("rejects malformed event DTOs", (value) => {
    expect(() => readModerationEvent(value)).toThrow(ModerationFailure);
  });
  it("rejects a wrong page or comments from another event", () => {
    expect(() =>
      readModerationEvents(
        { items: [dto], page: 2, size: 6, total: 1, totalPages: 1 },
        0,
      ),
    ).toThrow(ModerationFailure);
    expect(() =>
      readModerationComments(
        { items: [commentDto], page: 0, size: 10, total: 1, totalPages: 1 },
        0,
        mockId("other"),
      ),
    ).toThrow(ModerationFailure);
  });
  it.each([
    [400, "invalid-input"],
    [401, "unauthenticated"],
    [403, "forbidden"],
    [404, "not-found"],
    [409, "conflict"],
    [422, "invalid-input"],
    [503, "unavailable"],
  ])(
    "translates HTTP %s without false moderation success",
    async (status, code) => {
      server.use(
        http.post(`/api/v1/admin/events/${event.id}/unpublish`, () =>
          HttpResponse.json({ code: "ERROR" }, { status: Number(status) }),
        ),
      );
      await expect(
        createHttpModerationRepository(request).unpublish(
          event.id,
          action.reason,
        ),
      ).rejects.toMatchObject({ code });
    },
  );
  it("preserves Abort and reports network failure", async () => {
    const repo = createHttpModerationRepository(request);
    const controller = new AbortController();
    controller.abort();
    await expect(
      repo.events({ q: "", page: 0 }, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    server.use(
      http.post(`/api/v1/admin/comments/${comment.id}/hide`, () =>
        HttpResponse.error(),
      ),
    );
    await expect(repo.hide(comment.id, "Причина")).rejects.toMatchObject({
      code: "network",
    });
  });
});
