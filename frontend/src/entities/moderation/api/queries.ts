import { queryOptions } from "@tanstack/react-query";
import type { ModerationRepository, EventStatus } from "../model";
export const moderationKeys = { all: ["moderation"] as const };
export const moderationEventsQuery = (
  repo: ModerationRepository,
  viewerId: string,
  filter: { q: string; status?: EventStatus; page: number },
) =>
  queryOptions({
    queryKey: ["moderation", "events", viewerId, filter],
    enabled: Boolean(viewerId),
    queryFn: ({ signal }) => repo.events(filter, signal),
    retry: false,
    staleTime: 0,
    refetchInterval: 10000,
  });
export const moderationCommentsQuery = (
  repo: ModerationRepository,
  viewerId: string,
  filter: { eventId?: string; page: number },
) =>
  queryOptions({
    queryKey: ["moderation", "comments", viewerId, filter],
    enabled: Boolean(viewerId),
    queryFn: ({ signal }) => repo.comments(filter, signal),
    retry: false,
    staleTime: 0,
    refetchInterval: 10000,
  });
