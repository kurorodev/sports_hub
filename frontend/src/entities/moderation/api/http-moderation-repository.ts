import { ApiError, type HttpClient } from "../../../shared/api/client";
import type { ModerationRequest } from "../../../shared/api/types";
import {
  ModerationFailure,
  type ModerationFailureCode,
  type ModerationRepository,
} from "../model";
import {
  readModerationEvent,
  readModerationComment,
  readModerationEvents,
  readModerationComments,
} from "./mappers";
async function translate<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "AbortError"
    )
      throw error;
    if (error instanceof ModerationFailure) throw error;
    const codes: Record<number, ModerationFailureCode> = {
      0: "network",
      400: "invalid-input",
      401: "unauthenticated",
      403: "forbidden",
      404: "not-found",
      409: "conflict",
      422: "invalid-input",
    };
    throw new ModerationFailure(
      error instanceof ApiError
        ? (codes[error.status] ??
            (error.status >= 500 ? "unavailable" : "unknown"))
        : "unknown",
      { cause: error },
    );
  }
}
export function createHttpModerationRepository(
  http: HttpClient,
): ModerationRepository {
  const post = (path: string, reason: string) => {
    const body: ModerationRequest = { reason };
    return http(path, { method: "POST", body: JSON.stringify(body) });
  };
  return {
    events: (filter, signal) =>
      translate(async () => {
        const params = new URLSearchParams({
          q: filter.q,
          page: String(filter.page),
          size: "6",
        });
        if (filter.status) params.set("status", filter.status);
        return readModerationEvents(
          await http(`/admin/events?${params}`, { signal }),
          filter.page,
        );
      }),
    comments: (filter, signal) =>
      translate(async () => {
        const params = new URLSearchParams({
          page: String(filter.page),
          size: "10",
        });
        if (filter.eventId) params.set("eventId", filter.eventId);
        if (filter.authorId) params.set("authorId", filter.authorId);
        if (filter.latest) params.set("latest", "true");
        if (filter.last24Hours) params.set("last24Hours", "true");
        return readModerationComments(
          await http(`/admin/comments?${params}`, { signal }),
          filter.page,
          filter.eventId,
          filter.authorId,
        );
      }),
    unpublish: (id, reason) =>
      translate(async () =>
        readModerationEvent(
          await post(
            `/admin/events/${encodeURIComponent(id)}/unpublish`,
            reason,
          ),
        ),
      ),
    hide: (id, reason) =>
      translate(async () =>
        readModerationComment(
          await post(`/admin/comments/${encodeURIComponent(id)}/hide`, reason),
        ),
      ),
  };
}
