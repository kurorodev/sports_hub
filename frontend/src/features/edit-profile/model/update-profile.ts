import {
  ProfileFailure,
  safeAvatarUrl,
  sportRoles,
  experienceLevels,
  preferredTimes,
  type ProfileDraft,
  type ProfileChanges,
  type ProfileRepository,
} from "../../../entities/profile/model";
import { avatarCharacter } from "../../../shared/model/avatars";
import { canonicalCityName } from "../../../shared/model/cities";
const text = (value: string) => value.trim() || null;
export function normalizeProfile(draft: ProfileDraft): ProfileChanges {
  const result: ProfileChanges = {
    ...draft,
    handle: draft.handle.trim().replace(/^@/, ""),
    name: draft.name.trim(),
    firstName: text(draft.firstName),
    lastName: text(draft.lastName),
    about: text(draft.about),
    city: canonicalCityName(draft.city) ?? text(draft.city),
    avatarUrl: text(draft.avatarUrl),
    roles: [...draft.roles],
    preferences: draft.preferences.map((item) => ({ ...item })),
    preferredTime: draft.preferredTime || null,
  };
  if (
    !/^[A-Za-z0-9_-]{3,40}$/.test(result.handle) ||
    !result.name ||
    result.name.length > 100 ||
    (result.firstName?.length ?? 0) > 80 ||
    (result.lastName?.length ?? 0) > 80 ||
    (result.about?.length ?? 0) > 1000 ||
    (result.city !== null && !canonicalCityName(result.city)) ||
    (result.avatarUrl !== null && !safeAvatarUrl(result.avatarUrl)) ||
    result.roles.some((role) => !sportRoles.includes(role)) ||
    new Set(result.roles).size !== result.roles.length ||
    new Set(result.preferences.map((item) => item.sportId)).size !==
      result.preferences.length ||
    result.preferences.some(
      (item) =>
        !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
          item.sportId,
        ) || !experienceLevels.includes(item.level),
    ) ||
    (result.preferredTime && !preferredTimes.includes(result.preferredTime))
  )
    throw new ProfileFailure("invalid-input");
  return result;
}
const rolesKey = (items: ProfileChanges["roles"]) =>
  [...items].sort().join(",");
const preferencesKey = (items: ProfileChanges["preferences"]) =>
  items
    .map((item) => `${item.sportId}:${item.level}`)
    .sort()
    .join(",");
export async function updateProfile(
  repo: ProfileRepository,
  viewerId: string,
  draft: ProfileDraft,
) {
  if (!viewerId) throw new ProfileFailure("unauthenticated");
  const changes = normalizeProfile(draft);
  const result = await repo.update(changes);
  const fields = [
    "handle",
    "name",
    "firstName",
    "lastName",
    "about",
    "city",
    "preferredTime",
  ] as const;
  const receivedCharacter = avatarCharacter(result.avatarUrl);
  const sameAvatar =
    result.avatarUrl === changes.avatarUrl ||
    (receivedCharacter !== null &&
      (changes.avatarUrl === null ||
        receivedCharacter === avatarCharacter(changes.avatarUrl)));
  if (
    result.id !== viewerId ||
    !sameAvatar ||
    fields.some((field) => result[field] !== changes[field]) ||
    rolesKey(result.roles) !== rolesKey(changes.roles) ||
    preferencesKey(result.preferences) !== preferencesKey(changes.preferences)
  )
    throw new ProfileFailure("invalid-response");
  return result;
}
