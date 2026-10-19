import { queryOptions } from "@tanstack/react-query";
import type { CommentRepository } from "../model";
export const commentKeys = {
  event: (eventId: string) => ["comments", eventId] as const,
  page: (eventId: string, viewerId: string | undefined, page: number) =>
    ["comments", eventId, viewerId ?? "guest", page] as const,
};
export const commentPageQuery = (
  repository: CommentRepository,
  eventId: string,
  viewerId: string | undefined,
  page: number,
) =>
  queryOptions({
    queryKey: commentKeys.page(eventId, viewerId, page),
    queryFn: ({ signal }) => repository.list(eventId, page, signal),
    staleTime: 0,
    retry: false,
    refetchInterval: 10000,
  });
