import type { EventPreview, TeamStatus } from "../../../shared/api/types";
import type { EventParticipation } from "../model";

export function toEventParticipation(
  dto: EventPreview,
  team: TeamStatus,
): EventParticipation {
  return {
    eventId: dto.id,
    organizer: dto.viewerIsOrganizer,
    openForRegistration: team.joinAvailable || team.waitlistAvailable,
    participantLimit: dto.maxParticipants ?? null,
    confirmedParticipants: dto.confirmedCount,
    joinMode: dto.joinMode,
  };
}
