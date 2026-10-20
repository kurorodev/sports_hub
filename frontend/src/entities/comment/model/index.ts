export interface DiscussionComment {
  id: string;
  eventId: string;
  author: {
    id: string;
    displayName: string;
    nickname?: string;
    avatarUrl?: string | null;
  };
  mentions?: { userId: string; nickname: string; start: number; end: number }[];
  text: string;
  visibility: "visible" | "hidden";
  publishedAt: string;
}
export interface CommentPage {
  comments: DiscussionComment[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
}
export interface CommentRepository {
  list(
    eventId: string,
    page: number,
    signal?: AbortSignal,
  ): Promise<CommentPage>;
  publish(eventId: string, text: string): Promise<DiscussionComment>;
}
export type CommentFailureCode =
  | "network"
  | "unauthenticated"
  | "forbidden"
  | "not-found"
  | "closed"
  | "invalid-input"
  | "conflict"
  | "unavailable"
  | "invalid-response"
  | "unknown";
export class CommentFailure extends Error {
  constructor(
    public readonly code: CommentFailureCode,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "CommentFailure";
  }
}
