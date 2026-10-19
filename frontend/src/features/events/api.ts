import { queryOptions } from "@tanstack/react-query";
import { request } from "../../shared/api/client";
import type { EventPreview, Page } from "../../shared/api/provisional";

export const eventsQuery = (params: URLSearchParams) =>
  queryOptions({
    queryKey: ["events", params.toString()],
    queryFn: ({ signal }) =>
      request<Page<EventPreview>>(`/events?${params}`, { signal }),
  });
export const eventQuery = (id: string) =>
  queryOptions({
    queryKey: ["events", "detail", id],
    queryFn: ({ signal }) =>
      request<EventPreview>(`/events/${encodeURIComponent(id)}`, { signal }),
    retry: false,
  });
