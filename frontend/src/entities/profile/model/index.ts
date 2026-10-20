export const sportRoles = [
  "ATHLETE",
  "COACH",
  "REFEREE",
  "SPORTS_ORGANIZER",
] as const;
export const experienceLevels = [
  "BEGINNER",
  "AMATEUR",
  "ADVANCED",
  "PROFESSIONAL",
] as const;
export const preferredTimes = ["MORNING", "DAY", "EVENING", "ANY"] as const;
export type SportRole = (typeof sportRoles)[number];
export type ExperienceLevel = (typeof experienceLevels)[number];
export type PreferredTime = (typeof preferredTimes)[number];
export interface Profile {
  id: string;
  handle: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  about: string | null;
  city: string | null;
  avatarUrl: string | null;
  roles: SportRole[];
  preferences: { sportId: string; level: ExperienceLevel }[];
  preferredTime: PreferredTime | null;
  rank: "ROOKIE" | "ACTIVE" | "EXPERIENCED" | "ELITE";
  points: number;
  memberSince: string;
}
export type ProfileChanges = Pick<
  Profile,
  | "handle"
  | "name"
  | "firstName"
  | "lastName"
  | "about"
  | "city"
  | "avatarUrl"
  | "roles"
  | "preferences"
  | "preferredTime"
>;
export type ProfileDraft = Omit<
  ProfileChanges,
  "firstName" | "lastName" | "about" | "city" | "avatarUrl" | "preferredTime"
> & {
  firstName: string;
  lastName: string;
  about: string;
  city: string;
  avatarUrl: string;
  preferredTime: PreferredTime | "";
};
export interface ProfileRepository {
  own(signal?: AbortSignal): Promise<Profile>;
  find(id: string, signal?: AbortSignal): Promise<Profile>;
  update(changes: ProfileChanges): Promise<Profile>;
}
export type ProfileFailureCode =
  | "network"
  | "unauthenticated"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "invalid-input"
  | "invalid-response"
  | "unavailable"
  | "unknown";
export class ProfileFailure extends Error {
  constructor(
    public readonly code: ProfileFailureCode,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "ProfileFailure";
  }
}
export { safeAvatarUrl } from "../../../shared/model/avatars";
export function profileDraft(profile: Profile): ProfileDraft {
  return {
    handle: profile.handle,
    name: profile.name,
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    about: profile.about ?? "",
    city: profile.city ?? "",
    avatarUrl: profile.avatarUrl ?? "",
    roles: [...profile.roles],
    preferences: profile.preferences.map((item) => ({ ...item })),
    preferredTime: profile.preferredTime ?? "",
  };
}
