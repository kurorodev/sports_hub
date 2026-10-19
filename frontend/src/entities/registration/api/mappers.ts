import { z } from "zod";
import type {
  PublicUser,
  Page,
  Registration as RegistrationDto,
} from "../../../shared/api/types";
import {
  RegistrationFailure,
  type ParticipantPage,
  type Registration,
  type RegistrationPage,
} from "../model";

const userSchema = z.object({
  id: z.string().min(1),
  nickname: z.string(),
  displayName: z.string().min(1),
  avatarUrl: z.string().nullable().optional(),
  sportsRoles: z.array(
    z.enum(["ATHLETE", "COACH", "REFEREE", "SPORTS_ORGANIZER"]),
  ),
  rank: z.enum(["ROOKIE", "ACTIVE", "EXPERIENCED", "ELITE"]),
  ratingPoints: z.number().int().nonnegative(),
}) satisfies z.ZodType<PublicUser>;
const registrationSchema = z.object({
  id: z.string().min(1),
  eventId: z.string().min(1),
  user: userSchema,
  status: z.enum([
    "PENDING",
    "CONFIRMED",
    "REJECTED",
    "CANCELLED",
    "WAITLISTED",
  ]),
  decisionReason: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
}) satisfies z.ZodType<RegistrationDto>;
const participantPageSchema = z.object({
  items: z.array(userSchema),
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
}) satisfies z.ZodType<Page<PublicUser>>;
export function toRegistration(value: unknown): Registration {
  const result = registrationSchema.safeParse(value);
  if (!result.success)
    throw new RegistrationFailure("invalid-response", { cause: result.error });
  const dto = result.data;
  return {
    id: dto.id,
    eventId: dto.eventId,
    participant: { id: dto.user.id, displayName: dto.user.displayName },
    status: dto.status,
    registeredAt: dto.createdAt,
    decisionReason: dto.decisionReason,
    message: dto.message,
  };
}

export function toRegistrationPage(value: unknown): RegistrationPage {
  const result = participantPageSchema
    .extend({ items: z.array(registrationSchema) })
    .safeParse(value);
  if (!result.success)
    throw new RegistrationFailure("invalid-response", { cause: result.error });
  const dto = result.data;
  return {
    registrations: dto.items.map(toRegistration),
    pageIndex: dto.page,
    pageSize: dto.size,
    totalCount: dto.total,
  };
}
export function toParticipantPage(value: unknown): ParticipantPage {
  const result = participantPageSchema.safeParse(value);
  if (!result.success)
    throw new RegistrationFailure("invalid-response", { cause: result.error });
  const dto = result.data;
  return {
    participants: dto.items.map((user) => ({
      id: user.id,
      displayName: user.displayName,
    })),
    pageIndex: dto.page,
    pageSize: dto.size,
    totalCount: dto.total,
  };
}
