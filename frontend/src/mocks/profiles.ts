import { activeSportsRoles } from "../shared/model/sports-roles";
import { z } from "zod";
import type { UserProfileDto, PublicUser } from "../shared/api/types";
import { profileSchema } from "../entities/profile/api/mappers";
import {
  avatarCharacter,
  avatarPath,
  avatarSource,
  type AvatarTone,
} from "../shared/model/avatars";

export function mockAvatar(
  user: { id: string; nickname: string; avatarUrl?: string | null },
  tone: AvatarTone = "user",
) {
  const character = avatarCharacter(user.avatarUrl);
  const url = character ? avatarPath(character) : user.avatarUrl;
  return avatarSource(user.id, url, user.nickname === "admin" ? "admin" : tone);
}
const key = "sport.mock.profiles.v1";
let memory: UserProfileDto[] = [];
function read(): UserProfileDto[] {
  const saved =
    typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  return saved === null
    ? memory
    : z.array(profileSchema).parse(JSON.parse(saved));
}
export function savedProfile(id: string) {
  const profile = read().find((item) => item.id === id);
  return profile
    ? {
        ...profile,
        sportsRoles: activeSportsRoles(profile.sportsRoles),
        rank: "ROOKIE" as const,
        ratingPoints: 0,
      }
    : undefined;
}
export function saveProfile(profile: UserProfileDto) {
  memory = [
    ...read().filter((item) => item.id !== profile.id),
    profileSchema.parse(profile),
  ];
  if (typeof localStorage !== "undefined")
    localStorage.setItem(key, JSON.stringify(memory));
  return profile;
}
export function refreshMockUser(user: PublicUser): PublicUser {
  const profile = savedProfile(user.id);
  return profile
    ? {
        id: user.id,
        nickname: profile.nickname,
        displayName: profile.displayName,
        avatarUrl: mockAvatar({ ...user, avatarUrl: profile.avatarUrl }),
        sportsRoles: activeSportsRoles(profile.sportsRoles),
        rank: "ROOKIE",
        ratingPoints: 0,
      }
    : {
        ...user,
        sportsRoles: activeSportsRoles(user.sportsRoles),
        rank: "ROOKIE",
        ratingPoints: 0,
        avatarUrl: mockAvatar(user),
      };
}
export function resetMockProfiles() {
  memory = [];
  if (typeof localStorage !== "undefined") localStorage.removeItem(key);
}
