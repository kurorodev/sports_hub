export const sportRoles = ["ATHLETE", "SPORTS_ORGANIZER"] as const;
export type SportRole = (typeof sportRoles)[number];
/** Keep old cached profiles readable after coach and referee roles were retired. */
export function activeSportsRoles(roles: readonly string[]): SportRole[] {
  return roles.filter(
    (role): role is SportRole =>
      role === "ATHLETE" || role === "SPORTS_ORGANIZER",
  );
}
