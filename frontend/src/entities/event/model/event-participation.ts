/** Server-supplied facts for the participation scenario, not client-assigned permissions. */
export interface EventParticipation {
  eventId: string;
  organizer: boolean;
  openForRegistration: boolean;
  participantLimit: number;
  confirmedParticipants: number;
  joinMode: "OPEN" | "APPROVAL";
}
