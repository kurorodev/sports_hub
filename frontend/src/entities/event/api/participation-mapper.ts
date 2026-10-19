import type { EventPreview } from "../../../shared/api/provisional";
import type { EventParticipation } from "../model";

export function toEventParticipation(dto: EventPreview): EventParticipation {
  return {
    eventId: dto.id,
    organizer: dto.viewerIsOrganizer,
    openForRegistration: dto.registrationOpen,
    participantLimit: dto.capacity,
    confirmedParticipants: dto.confirmedCount,
    joinMode: dto.joinMode,
  };
}
