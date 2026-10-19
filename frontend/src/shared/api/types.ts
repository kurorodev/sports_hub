/** Wire types generated from the shared Java API contract. Do not duplicate DTOs here. */
import type { components } from "./generated/schema";
type Schemas = components["schemas"];
export type Location = Schemas["Location"];
export type GeoSuggestion = Schemas["GeoSuggestion"];
export type GeoSuggestions = Schemas["GeoSuggestions"];
export type GeoReverseResponse = Schemas["GeoReverseResponse"];
export type VenueMapItem = Schemas["VenueMapItem"];
export type VenueCreate = Schemas["VenueCreate"];
export type OccupancyLevel = Schemas["OccupancyLevel"];
export type OccupancyReportCreate = Schemas["OccupancyReportCreate"];
export type MapEventsResponse = Schemas["MapEventsResponse"];
export type MapVenuesResponse = Schemas["MapVenuesResponse"];
export type SystemRole = Schemas["SystemRole"];
export type DemoAccount = Schemas["DemoAccount"];
export type DemoRegistrationRequest = Schemas["DemoRegistrationRequest"];
export type Session = Schemas["Session"];
export type Sport = Schemas["Sport"];
export type EventPreview = Schemas["Event"];
export type EventCardDto = Schemas["EventCard"];
export type EventCreate = Schemas["EventCreate"];
export type Registration = Schemas["Registration"];
export type RegistrationDecisionRequest =
  Schemas["RegistrationDecisionRequest"];
export type PublicUser = Schemas["PublicUser"];
export type ApiErrorBody = Schemas["ApiError"];
export type TeamStatus = Schemas["TeamStatus"];
export type Page<T> = Omit<Schemas["PagedEvents"], "items"> & { items: T[] };

export type CommentDto = Schemas["Comment"];
export type CommentCreate = Schemas["CommentCreate"];

export type OrganizationDto = Schemas["Organization"];
export type OrganizationCreate = Schemas["OrganizationCreate"];
export type OrganizationDecisionRequest =
  Schemas["OrganizationDecisionRequest"];
export type PagedOrganizationsDto = Schemas["PagedOrganizations"];

export type ModerationRequest = Schemas["ModerationRequest"];
export type PagedEventDetailsDto = Schemas["PagedEventDetails"];
export type PagedCommentsDto = Schemas["PagedComments"];

export type UserProfileDto = Schemas["UserProfile"];
export type ProfilePatchDto = Schemas["ProfilePatch"];

export type AuthRegistrationRequest =
  components["schemas"]["AuthRegistrationRequest"];
export type AuthLoginRequest = components["schemas"]["AuthLoginRequest"];
export type Mention = components["schemas"]["Mention"];
