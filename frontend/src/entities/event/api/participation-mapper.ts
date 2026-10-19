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
    pendingParticipants: team.pendingCount,
    joinMode: dto.joinMode,
  };
}
