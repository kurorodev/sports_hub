import { z } from "zod";
import type { CommentDto, PublicUser } from "../shared/api/types";

const key = "dvizh.mock.comments.v1";
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
    status: z.enum(["VISIBLE", "HIDDEN"]),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  }),
) satisfies z.ZodType<CommentDto[]>;
let memory: CommentDto[] = [];
export function getComments(): CommentDto[] {
  const saved =
    typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  return saved === null ? memory : schema.parse(JSON.parse(saved));
}
export function saveComment(
  eventId: string,
  author: PublicUser,
  text: string,
): CommentDto {
  const existing = getComments();
  // Keep a stable publication order even when browser tests freeze the clock.
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
