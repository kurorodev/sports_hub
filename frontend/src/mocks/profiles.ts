import { z } from "zod";
import type { UserProfileDto, PublicUser } from "../shared/api/types";
import { profileSchema } from "../entities/profile/api/mappers";
const key = "dvizh.mock.profiles.v1";
let memory: UserProfileDto[] = [];
function read(): UserProfileDto[] {
  const saved =
    typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  return saved === null
    ? memory
    : z.array(profileSchema).parse(JSON.parse(saved));
}
export function savedProfile(id: string) {
  return read().find((item) => item.id === id);
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
        avatarUrl: profile.avatarUrl,
        sportsRoles: [...profile.sportsRoles],
        rank: profile.rank,
        ratingPoints: profile.ratingPoints,
      }
    : user;
}
export function resetMockProfiles() {
  memory = [];
  if (typeof localStorage !== "undefined") localStorage.removeItem(key);
}
