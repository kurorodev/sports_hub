import type {
  ParticipantPage,
  Registration,
  RegistrationPage,
  RegistrationDecision,
} from "./registration";

export interface RegistrationRepository {
  findMine(eventId: string, signal?: AbortSignal): Promise<Registration | null>;
  listParticipants(
    eventId: string,
    page: number,
    signal?: AbortSignal,
  ): Promise<ParticipantPage>;
  join(eventId: string): Promise<Registration>;
  listRequests(
    eventId: string,
    page: number,
    status?: Registration["status"],
    signal?: AbortSignal,
  ): Promise<RegistrationPage>;
  decide(
    eventId: string,
    registrationId: string,
    decision: RegistrationDecision,
  ): Promise<Registration>;
}
