export const sportRoles = ["ATHLETE", "SPORTS_ORGANIZER"] as const;
export type SportRole = (typeof sportRoles)[number];
/** Старый кэш может содержать удалённые роли тренера и судьи; приводим их к действующим. */
export function activeSportsRoles(roles: readonly string[]): SportRole[] {
  return roles.filter(
    (role): role is SportRole =>
      role === "ATHLETE" || role === "SPORTS_ORGANIZER",
  );
}
