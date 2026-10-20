export type AvatarTone = "user" | "organizer" | "admin";
const builtin =
  /^\/avatars\/(user|organizer|admin)\/((?:male|female)-0[1-5])\.svg$/;

export const avatarCharacters = ["male", "female"].flatMap((gender) =>
  Array.from({ length: 5 }, (_, index) => ({
    id: `${gender}-0${index + 1}`,
    label: `${gender === "male" ? "Мужской" : "Женский"} аватар ${index + 1}`,
  })),
);
export function avatarCharacter(url?: string | null) {
  return url?.match(builtin)?.[2] ?? null;
}
export function avatarPath(character: string, tone: AvatarTone = "user") {
  return `/avatars/${tone}/${character}.svg`;
}
export function safeAvatarUrl(value: string): boolean {
  if (builtin.test(value)) return true;
  try {
    const url = new URL(value);
    return (
      value.length <= 2048 &&
      ["http:", "https:"].includes(url.protocol) &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
export function avatarSource(
  id: string,
  url?: string | null,
  tone?: AvatarTone,
) {
  if (url && safeAvatarUrl(url)) {
    const character = avatarCharacter(url);
    // A contextual organizer override must not downgrade an administrator.
    return character && tone && !url.startsWith("/avatars/admin/")
      ? avatarPath(character, tone)
      : url;
  }
  const hash = Array.from(id).reduce(
    (value, char) => (value * 31 + char.charCodeAt(0)) >>> 0,
    0,
  );
  return avatarPath(avatarCharacters[hash % avatarCharacters.length].id, tone);
}
