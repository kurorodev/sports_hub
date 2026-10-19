import { z } from "zod";
import type {
  EventParticipant as ParticipantDto,
  Page,
  Registration as RegistrationDto,
} from "../../../shared/api/provisional";
import {
  RegistrationFailure,
  type ParticipantPage,
  type Registration,
} from "../model";

// Runtime guards for provisional DTOs. Replace/align these when OpenAPI becomes available.
const userSchema = z.object({ id: z.string().min(1), name: z.string().min(1) });
const registrationSchema = z.object({
  id: z.string().min(1),
  eventId: z.string().min(1),
  user: userSchema,
  status: z.literal("CONFIRMED"),
  createdAt: z.iso.datetime({ offset: true }),
}) satisfies z.ZodType<RegistrationDto>;
const participantPageSchema = z.object({
  items: z.array(
    z.object({ user: userSchema, joinedAt: z.iso.datetime({ offset: true }) }),
  ),
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  total: z.number().int().nonnegative(),
}) satisfies z.ZodType<Page<ParticipantDto>>;

export function toRegistration(value: unknown): Registration {
  const result = registrationSchema.safeParse(value);
  if (!result.success)
    throw new RegistrationFailure("invalid-response", { cause: result.error });
  const dto = result.data;
  return {
    id: dto.id,
    eventId: dto.eventId,
    participant: { id: dto.user.id, displayName: dto.user.name },
    status: dto.status,
    registeredAt: dto.createdAt,
  };
}

export function toParticipantPage(value: unknown): ParticipantPage {
  const result = participantPageSchema.safeParse(value);
  if (!result.success)
    throw new RegistrationFailure("invalid-response", { cause: result.error });
  const dto = result.data;
  return {
    participants: dto.items.map(({ user, joinedAt }) => ({
      id: user.id,
      displayName: user.name,
      joinedAt,
    })),
    pageIndex: dto.page,
    pageSize: dto.size,
    totalCount: dto.total,
  };
}
