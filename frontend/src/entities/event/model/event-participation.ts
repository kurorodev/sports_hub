/** Статусы и разрешения участия приходят с сервера. */
export interface EventParticipation {
  eventId: string;
  startsAt?: string;
  organizer: boolean;
  openForRegistration: boolean;
  participantLimit: number | null;
  confirmedParticipants: number;
  pendingParticipants: number;
  joinMode: "OPEN" | "APPROVAL";
}
