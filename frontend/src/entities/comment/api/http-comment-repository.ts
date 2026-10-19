import { z } from "zod";
import { ApiError, type HttpClient } from "../../../shared/api/client";
import type {
  CommentDto,
  CommentCreate,
  Page,
} from "../../../shared/api/types";
import {
  CommentFailure,
  type CommentFailureCode,
  type CommentRepository,
  type DiscussionComment,
  type CommentPage,
} from "../model";

const commentSchema = z.object({
  id: z.string().min(1),
  eventId: z.string().min(1),
  author: z.object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    nickname: z.string(),
    sportsRoles: z.array(
      z.enum(["ATHLETE", "COACH", "REFEREE", "SPORTS_ORGANIZER"]),
    ),
    rank: z.enum(["ROOKIE", "ACTIVE", "EXPERIENCED", "ELITE"]),
    ratingPoints: z.number().int().nonnegative(),
  }),
  text: z.string(),
  status: z.enum(["VISIBLE", "HIDDEN"]),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
}) satisfies z.ZodType<CommentDto>;
const pageSchema = z.object({
  items: z.array(commentSchema),
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
}) satisfies z.ZodType<Page<CommentDto>>;
function toComment(dto: z.infer<typeof commentSchema>): DiscussionComment {
  return {
    id: dto.id,
    eventId: dto.eventId,
    author: { id: dto.author.id, displayName: dto.author.displayName },
    text: dto.status === "HIDDEN" ? "" : dto.text,
    visibility: dto.status === "VISIBLE" ? "visible" : "hidden",
    publishedAt: dto.createdAt,
  };
}
function readComment(value: unknown): DiscussionComment {
  const result = commentSchema.safeParse(value);
  if (!result.success)
    throw new CommentFailure("invalid-response", { cause: result.error });
  return toComment(result.data);
}
function readPage(value: unknown, eventId: string): CommentPage {
  const result = pageSchema.safeParse(value);
  if (
    !result.success ||
    result.data.items.some((item) => item.eventId !== eventId)
  )
    throw new CommentFailure("invalid-response");
  return {
    comments: result.data.items.map(toComment),
    pageIndex: result.data.page,
    pageSize: result.data.size,
    totalCount: result.data.total,
  };
}
async function translateFailure<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "AbortError"
    )
      throw error;
    if (error instanceof CommentFailure) throw error;
    const statusCodes: Record<number, CommentFailureCode> = {
      0: "network",
      400: "invalid-input",
      401: "unauthenticated",
      403: "forbidden",
      404: "not-found",
      409: "conflict",
      422: "invalid-input",
    };
    if (error instanceof ApiError)
      throw new CommentFailure(
        error.body?.code === "EVENT_NOT_AVAILABLE"
          ? "closed"
          : (statusCodes[error.status] ??
              (error.status >= 500 ? "unavailable" : "unknown")),
        { cause: error },
      );
    throw new CommentFailure("unknown", { cause: error });
  }
}
export function createHttpCommentRepository(
  http: HttpClient,
): CommentRepository {
  const path = (id: string) => `/events/${encodeURIComponent(id)}/comments`;
  return {
    list: (eventId, page, signal) =>
      translateFailure(async () =>
        readPage(
          await http(`${path(eventId)}?page=${page}&size=10`, { signal }),
          eventId,
        ),
      ),
    publish: (eventId, text) =>
      translateFailure(async () => {
        const body: CommentCreate = { text };
        return readComment(
          await http(path(eventId), {
            method: "POST",
            body: JSON.stringify(body),
          }),
        );
      }),
  };
}
