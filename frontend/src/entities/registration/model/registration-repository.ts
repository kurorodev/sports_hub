import type { ParticipantPage, Registration } from "./registration";

export interface RegistrationRepository {
  findMine(eventId: string, signal?: AbortSignal): Promise<Registration | null>;
  listParticipants(
    eventId: string,
    page: number,
    signal?: AbortSignal,
  ): Promise<ParticipantPage>;
  join(eventId: string): Promise<Registration>;
}
