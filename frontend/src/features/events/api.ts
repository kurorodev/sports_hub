import { queryOptions } from "@tanstack/react-query";
import { request } from "../../shared/api/client";
import type { EventPreview, Page, Sport } from "../../shared/api/provisional";
import type { CreateEventInput } from "../../shared/api/provisional-event-schema";

export const sportsQuery = queryOptions({
  queryKey: ["sports"],
  queryFn: ({ signal }) => request<Sport[]>("/sports", { signal }),
});

export function createEvent(input: CreateEventInput) {
  return request<EventPreview>("/events", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

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
