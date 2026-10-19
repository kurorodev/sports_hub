import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./setup";
import { request } from "../shared/api/client";
import type { CommentDto } from "../shared/api/types";
import { mockUser } from "../mocks/database";
import { createHttpCommentRepository } from "../entities/comment/api/http-comment-repository";
import type {
  CommentRepository,
  DiscussionComment,
} from "../entities/comment/model";
import { publishComment } from "../features/event-discussion/model/publish-comment";

const dto: CommentDto = {
  id: "comment-1",
  eventId: "event-1",
  author: mockUser("user-maria", "Мария"),
  text: "Можно новичку?",
  status: "VISIBLE",
  createdAt: "2026-10-19T12:00:00Z",
  updatedAt: "2026-10-19T12:00:00Z",
};
const model: DiscussionComment = {
  id: dto.id,
  eventId: dto.eventId,
  author: { id: dto.author.id, displayName: "Мария" },
  text: dto.text,
  visibility: "visible",
  publishedAt: dto.createdAt,
};
const input = {
  eventId: dto.eventId,
  viewerId: dto.author.id,
  text: `  ${dto.text}  `,
};
const repo = (result = model): CommentRepository => ({
  list: vi.fn(),
  publish: vi.fn(async () => result),
});
const adapter = createHttpCommentRepository(request);

describe("publish comment core", () => {
  it("trims the message and confirms server identity and content", async () => {
    const repository = repo();
    expect(await publishComment(repository, input)).toEqual(model);
    expect(repository.publish).toHaveBeenCalledExactlyOnceWith(
      dto.eventId,
      dto.text,
    );
  });
  it.each(["", "  \n ", "a".repeat(2001)])(
    "rejects invalid text before transport",
    async (text) => {
      const repository = repo();
      await expect(
        publishComment(repository, { ...input, text }),
      ).rejects.toMatchObject({ code: "invalid-input" });
      expect(repository.publish).not.toHaveBeenCalled();
    },
  );
  it.each([
    { ...model, eventId: "other" },
    { ...model, author: { id: "other", displayName: "Другой" } },
    { ...model, visibility: "hidden" as const },
    { ...model, text: "other" },
  ])("rejects a mismatched publication response", async (result) => {
    await expect(publishComment(repo(result), input)).rejects.toMatchObject({
      code: "invalid-response",
    });
  });
});
describe("comment HTTP boundary", () => {
  it("maps a page and removes hidden message content", async () => {
    server.use(
      http.get("/api/v1/events/event-1/comments", () =>
        HttpResponse.json({
          items: [
            dto,
            {
              ...dto,
              id: "hidden",
              status: "HIDDEN",
              text: "Hidden sensitive text",
            },
          ],
          page: 0,
          size: 10,
          total: 2,
          totalPages: 1,
        }),
      ),
    );
    expect(await adapter.list("event-1", 0)).toEqual({
      comments: [
        {
          ...model,
          author: { ...model.author, nickname: dto.author.nickname },
          mentions: [],
        },
        {
          ...model,
          author: { ...model.author, nickname: dto.author.nickname },
          mentions: [],
          id: "hidden",
          text: "",
          visibility: "hidden",
        },
      ],
      pageIndex: 0,
      pageSize: 10,
      totalCount: 2,
    });
  });
  it.each([
    {},
    { ...dto, status: "UNRECOGNIZED" },
    { ...dto, createdAt: "2026-10-19T12:00:00" },
    { ...dto, author: null },
  ])("rejects malformed DTOs", async (value) => {
    server.use(
      http.post("/api/v1/events/event-1/comments", () =>
        HttpResponse.json(value),
      ),
    );
    await expect(adapter.publish("event-1", "text")).rejects.toMatchObject({
      code: "invalid-response",
    });
  });
  it("rejects a page containing another event's comments", async () => {
    server.use(
      http.get("/api/v1/events/event-1/comments", () =>
        HttpResponse.json({
          items: [{ ...dto, eventId: "other" }],
          page: 0,
          size: 10,
          total: 1,
          totalPages: 1,
        }),
      ),
    );
    await expect(adapter.list("event-1", 0)).rejects.toMatchObject({
      code: "invalid-response",
    });
  });
  it.each([
    [401, "UNAUTHENTICATED", "unauthenticated"],
    [403, "FORBIDDEN", "forbidden"],
    [404, "NOT_FOUND", "not-found"],
    [409, "EVENT_NOT_AVAILABLE", "closed"],
    [409, "INVALID_TRANSITION", "conflict"],
    [422, "VALIDATION_ERROR", "invalid-input"],
    [503, "__proto__", "unavailable"],
  ])(
    "translates HTTP %s without leaking transport to UI",
    async (status, code, expected) => {
      server.use(
        http.post("/api/v1/events/event-1/comments", () =>
          HttpResponse.json(
            { code, message: "Error" },
            { status: Number(status) },
          ),
        ),
      );
      await expect(adapter.publish("event-1", "text")).rejects.toMatchObject({
        code: expected,
      });
    },
  );
  it("preserves cancellation and handles network failure", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      adapter.list("event-1", 0, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    server.use(
      http.post("/api/v1/events/event-1/comments", () => HttpResponse.error()),
    );
    await expect(adapter.publish("event-1", "text")).rejects.toMatchObject({
      code: "network",
    });
  });
});
