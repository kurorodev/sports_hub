import { queryOptions } from "@tanstack/react-query";
import type { RegistrationRepository } from "../model";

export const registrationKeys = {
  event: (eventId: string) => ["registrations", eventId] as const,
  mine: (eventId: string, userId?: string) =>
    ["registrations", eventId, "mine", userId] as const,
  participants: (eventId: string, page: number) =>
    ["registrations", eventId, "participants", page] as const,
};

export const participantsQuery = (
  repository: RegistrationRepository,
  eventId: string,
  page: number,
) =>
  queryOptions({
    queryKey: registrationKeys.participants(eventId, page),
    queryFn: ({ signal }) => repository.listParticipants(eventId, page, signal),
  });
