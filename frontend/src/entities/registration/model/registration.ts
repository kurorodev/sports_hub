/** Application model. HTTP field names and generated DTOs belong to API adapters. */
export interface Participant {
  id: string;
  displayName: string;
}

export interface Registration {
  id: string;
  eventId: string;
  participant: Participant;
  status: "CONFIRMED";
  registeredAt: string;
}

export interface ParticipantPage {
  participants: (Participant & { joinedAt: string })[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
}
