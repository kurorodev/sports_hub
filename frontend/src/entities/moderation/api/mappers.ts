import { z } from "zod";
import type {
  EventPreview,
  CommentDto,
  PagedEventDetailsDto,
  PagedCommentsDto,
} from "../../../shared/api/types";
import {
  ModerationFailure,
  type ModerationEvent,
  type ModerationComment,
  type ModerationPage,
} from "../model";
const eventSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  eventKind: z.enum(["ACTIVITY", "COMPETITION"]),
  sport: z.object({
    id: z.string().uuid(),
    name: z.string(),
    isCustom: z.boolean(),
  }),
  startsAt: z.iso.datetime({ offset: true }),
  location: z.object({ city: z.string(), address: z.string() }),
  skillLevel: z.enum([
    "ANY",
    "BEGINNER",
    "AMATEUR",
    "ADVANCED",
    "PROFESSIONAL",
  ]),
  joinMode: z.enum(["OPEN", "APPROVAL"]),
  confirmedCount: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
  organizer: z.object({
    id: z.string().uuid(),
    name: z.string(),
    type: z.enum(["USER", "ORGANIZATION"]),
  }),
  status: z.enum(["DRAFT", "PUBLISHED", "UNPUBLISHED", "DELETED"]),
  moderationReason: z.string().nullable().optional(),
  viewerIsOrganizer: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
}) satisfies z.ZodType<EventPreview>;
const commentSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  author: z.object({
    id: z.string().uuid(),
    displayName: z.string(),
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
const pagination = {
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
};
const eventsPage = z.object({
  ...pagination,
  items: z.array(eventSchema),
}) satisfies z.ZodType<PagedEventDetailsDto>;
const commentsPage = z.object({
  ...pagination,
  items: z.array(commentSchema),
}) satisfies z.ZodType<PagedCommentsDto>;
function event(dto: z.infer<typeof eventSchema>): ModerationEvent {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description,
    sportName: dto.sport.name,
    startsAt: new Date(dto.startsAt).toISOString(),
    city: dto.location.city,
    address: dto.location.address,
    organizer: { ...dto.organizer },
    status: dto.status,
    reason: dto.moderationReason,
    confirmedParticipants: dto.confirmedCount,
  };
}
function comment(dto: z.infer<typeof commentSchema>): ModerationComment {
  return {
    id: dto.id,
    eventId: dto.eventId,
    author: { id: dto.author.id, displayName: dto.author.displayName },
    text: dto.text,
    status: dto.status,
    publishedAt: dto.createdAt,
  };
}
export function readModerationEvent(value: unknown) {
  const result = eventSchema.safeParse(value);
  if (!result.success)
    throw new ModerationFailure("invalid-response", { cause: result.error });
  return event(result.data);
}
export function readModerationComment(value: unknown) {
  const result = commentSchema.safeParse(value);
  if (!result.success)
    throw new ModerationFailure("invalid-response", { cause: result.error });
  return comment(result.data);
}
export function readModerationEvents(
  value: unknown,
  page: number,
): ModerationPage<ModerationEvent> {
  const result = eventsPage.safeParse(value);
  if (!result.success || result.data.page !== page)
    throw new ModerationFailure("invalid-response");
  return {
    items: result.data.items.map(event),
    pageIndex: result.data.page,
    pageSize: result.data.size,
    totalCount: result.data.total,
  };
}
export function readModerationComments(
  value: unknown,
  page: number,
  eventId?: string,
  authorId?: string,
): ModerationPage<ModerationComment> {
  const result = commentsPage.safeParse(value);
  if (
    !result.success ||
    result.data.page !== page ||
    (eventId && result.data.items.some((item) => item.eventId !== eventId)) ||
    (authorId && result.data.items.some((item) => item.author.id !== authorId))
  )
    throw new ModerationFailure("invalid-response");
  return {
    items: result.data.items.map(comment),
    pageIndex: result.data.page,
    pageSize: result.data.size,
    totalCount: result.data.total,
  };
}
