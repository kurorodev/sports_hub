import { mockProfiles } from "./database";
import { refreshMockUser } from "./profiles";
import { z } from "zod";
import type { CommentDto, PublicUser } from "../shared/api/types";

const key = "sport.mock.comments.v1";
const schema = z.array(
  z.object({
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
    mentions: z
      .array(
        z.object({
          userId: z.string().uuid(),
          nickname: z.string(),
          start: z.number().int(),
          end: z.number().int(),
        }),
      )
      .optional(),
    status: z.enum(["VISIBLE", "HIDDEN"]),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  }),
) satisfies z.ZodType<CommentDto[]>;
let memory: CommentDto[] = [];
export function getComments(): CommentDto[] {
  const saved =
    typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  return (saved === null ? memory : schema.parse(JSON.parse(saved))).map(
    (item) => ({ ...item, author: refreshMockUser(item.author) }),
  );
}
export function saveComment(
  eventId: string,
  author: PublicUser,
  text: string,
): CommentDto {
  const existing = getComments();
  // При одинаковом времени публикации сохраняем порядок сообщений, в том числе с замороженными часами.
  const lastTime = existing.reduce(
    (latest, item) => Math.max(latest, Date.parse(item.createdAt)),
    0,
  );
  const now = new Date(Math.max(Date.now(), lastTime + 1)).toISOString();
  const comment: CommentDto = {
    id: crypto.randomUUID(),
    eventId,
    author,
    text: text.trim(),
    mentions: Array.from(
      text
        .trim()
        .matchAll(
          /(?<![\p{L}\p{N}_@.-])@([A-Za-z0-9_-]{3,40})(?![\p{L}\p{N}_-])/gu,
        ),
    ).flatMap((match) => {
      const user = mockProfiles().find(
        (u) => u.nickname.toLowerCase() === match[1].toLowerCase(),
      );
      return user
        ? [
            {
              userId: user.id,
              nickname: match[1],
              start: match.index!,
              end: match.index! + match[0].length,
            },
          ]
        : [];
    }),
    status: "VISIBLE",
    createdAt: now,
    updatedAt: now,
  };
  memory = [...existing, comment];
  if (typeof localStorage !== "undefined")
    localStorage.setItem(key, JSON.stringify(memory));
  return comment;
}
export function resetMockComments() {
  memory = [];
  if (typeof localStorage !== "undefined") localStorage.removeItem(key);
}

export function hideComment(comment: CommentDto): CommentDto {
  const updated: CommentDto = {
    ...comment,
    status: "HIDDEN",
    updatedAt: new Date().toISOString(),
  };
  memory = getComments().map((item) =>
    item.id === comment.id ? updated : item,
  );
  if (typeof localStorage !== "undefined")
    localStorage.setItem(key, JSON.stringify(memory));
  return updated;
}
