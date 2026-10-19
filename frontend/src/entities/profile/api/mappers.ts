import { z } from "zod";
import type {
  UserProfileDto,
  ProfilePatchDto,
} from "../../../shared/api/types";
import {
  sportRoles,
  experienceLevels,
  preferredTimes,
  safeAvatarUrl,
  ProfileFailure,
  type Profile,
  type ProfileChanges,
} from "../model";
const preferenceSchema = z.object({
  sportId: z.string().uuid(),
  level: z.enum(experienceLevels),
});
export const profileSchema = z.object({
  id: z.string().uuid(),
  nickname: z.string().min(1),
  displayName: z.string().min(1),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  sportsRoles: z.array(z.enum(sportRoles)),
  sportsPreferences: z.array(preferenceSchema),
  preferredTime: z.enum(preferredTimes).nullable().optional(),
  rank: z.enum(["ROOKIE", "ACTIVE", "EXPERIENCED", "ELITE"]),
  ratingPoints: z.number().int().nonnegative(),
  createdAt: z.iso.datetime({ offset: true }),
}) satisfies z.ZodType<UserProfileDto>;
export const profilePatchSchema = z
  .object({
    nickname: z
      .string()
      .min(3)
      .max(40)
      .refine((value) => value.trim().length >= 3)
      .optional(),
    displayName: z
      .string()
      .min(1)
      .max(100)
      .refine((value) => Boolean(value.trim()))
      .optional(),
    firstName: z.string().max(80).nullable().optional(),
    lastName: z.string().max(80).nullable().optional(),
    bio: z.string().max(1000).nullable().optional(),
    city: z.string().max(100).nullable().optional(),
    avatarUrl: z.string().refine(safeAvatarUrl).nullable().optional(),
    sportsRoles: z
      .array(z.enum(sportRoles))
      .refine((items) => new Set(items).size === items.length)
      .optional(),
    sportsPreferences: z
      .array(preferenceSchema)
      .refine(
        (items) =>
          new Set(items.map((item) => item.sportId)).size === items.length,
      )
      .optional(),
    preferredTime: z.enum(preferredTimes).nullable().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
  ) satisfies z.ZodType<ProfilePatchDto>;
export function readProfile(value: unknown): Profile {
  const result = profileSchema.safeParse(value);
  if (!result.success)
    throw new ProfileFailure("invalid-response", { cause: result.error });
  const dto = result.data;
  return {
    id: dto.id,
    handle: dto.nickname,
    name: dto.displayName,
    firstName: dto.firstName ?? null,
    lastName: dto.lastName ?? null,
    about: dto.bio ?? null,
    city: dto.city ?? null,
    avatarUrl:
      dto.avatarUrl && safeAvatarUrl(dto.avatarUrl) ? dto.avatarUrl : null,
    roles: [...dto.sportsRoles],
    preferences: dto.sportsPreferences.map((item) => ({ ...item })),
    preferredTime: dto.preferredTime ?? null,
    rank: dto.rank,
    points: dto.ratingPoints,
    memberSince: dto.createdAt,
  };
}
export function profilePatch(changes: ProfileChanges): ProfilePatchDto {
  return {
    nickname: changes.handle,
    displayName: changes.name,
    firstName: changes.firstName,
    lastName: changes.lastName,
    bio: changes.about,
    city: changes.city,
    avatarUrl: changes.avatarUrl,
    sportsRoles: [...changes.roles],
    sportsPreferences: changes.preferences.map((item) => ({ ...item })),
    preferredTime: changes.preferredTime,
  };
}
