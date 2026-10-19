export type EventStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "DELETED";
export interface ModerationEvent {
  id: string;
  title: string;
  description: string;
  sportName: string;
  startsAt: string;
  city: string;
  address: string;
  organizer: { id: string; name: string; type: "USER" | "ORGANIZATION" };
  status: EventStatus;
  reason?: string | null;
  confirmedParticipants: number;
}
export interface ModerationComment {
  id: string;
  eventId: string;
  author: { id: string; displayName: string };
  text: string;
  status: "VISIBLE" | "HIDDEN";
  publishedAt: string;
}
export interface ModerationPage<T> {
  items: T[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
}
export interface ModerationRepository {
  events(
    filter: { q: string; status?: EventStatus; page: number },
    signal?: AbortSignal,
  ): Promise<ModerationPage<ModerationEvent>>;
  comments(
    filter: { eventId?: string; page: number },
    signal?: AbortSignal,
  ): Promise<ModerationPage<ModerationComment>>;
  unpublish(id: string, reason: string): Promise<ModerationEvent>;
  hide(id: string, reason: string): Promise<ModerationComment>;
}
export type ModerationFailureCode =
  | "network"
  | "unauthenticated"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "invalid-input"
  | "invalid-response"
  | "unavailable"
  | "unknown";
export class ModerationFailure extends Error {
  constructor(
    public readonly code: ModerationFailureCode,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "ModerationFailure";
  }
}
