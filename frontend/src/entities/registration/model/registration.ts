/** Application model. HTTP field names and generated DTOs belong to API adapters. */
export interface Participant {
  id: string;
  displayName: string;
}

export interface Registration {
  id: string;
  eventId: string;
  participant: Participant;
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED" | "WAITLISTED";
  decisionReason?: string | null;
  message?: string | null;
  registeredAt: string;
}

export interface ParticipantPage {
  participants: Participant[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
}

export interface RegistrationPage {
  registrations: Registration[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
}

export interface RegistrationDecision {
  outcome: "accept" | "decline";
  reason?: string;
}
