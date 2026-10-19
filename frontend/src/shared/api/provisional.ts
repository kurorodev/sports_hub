/** Temporary mock models. Replace with generated OpenAPI types when the team supplies its contract.
 * These shapes are NOT an approved backend contract. See docs/API_REVIEW.md.
 */
export type SystemRole = "USER" | "ADMIN";
export interface DemoAccount {
  id: string;
  name: string;
  description: string;
}
export interface Session {
  user: { id: string; name: string };
  systemRoles: SystemRole[];
  manageableOrganizationIds: string[];
  csrfToken: string;
  demo: boolean;
}
export interface Sport {
  id: string;
  name: string;
}
export interface EventPreview {
  id: string;
  title: string;
  description: string;
  sport: Sport;
  startsAt: string;
  location: { city: string; address: string };
  skillLevel: string;
  joinMode: "OPEN" | "APPROVAL";
  eventKind: string;
  status: "PUBLISHED";
  organizer: { name: string; type: "USER" | "ORGANIZATION" };
  confirmedCount: number;
  capacity: number;
  viewerIsOrganizer: boolean;
  viewerRegistrationStatus: null;
}
export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}
export interface ApiErrorBody {
  code: string;
  message: string;
}
