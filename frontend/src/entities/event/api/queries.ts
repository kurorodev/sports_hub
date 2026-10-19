import { isUuid } from "../../../shared/lib/identifiers";
import { queryOptions } from "@tanstack/react-query";
import { request } from "../../../shared/api/client";
import type {
  EventPreview,
  EventCardDto,
  TeamStatus,
  Page,
  Sport,
} from "../../../shared/api/types";
import type { CreateEventInput } from "../../../shared/api/event-schema";

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
    queryFn: ({ signal }) => {
      const apiParams = new URLSearchParams(params);
      // Calendar filters have an explicit UTC boundary; never send a date-only value to Java.
      for (const key of ["from", "to"]) {
        const value = apiParams.get(key);
        if (value && /^\d{4}-\d{2}-\d{2}$/.test(value))
          apiParams.set(
            key,
            `${value}T${key === "from" ? "00:00:00" : "23:59:59.999"}Z`,
          );
      }
      if (!apiParams.has("size")) apiParams.set("size", "6");
      return request<Page<EventCardDto>>(`/events?${apiParams}`, { signal });
    },
  });
export const eventQuery = (id: string) =>
  queryOptions({
    queryKey: ["events", "detail", id],
    enabled: isUuid(id),
    queryFn: async ({ signal }) => {
      const path = `/events/${encodeURIComponent(id)}`;
      const event = await request<EventPreview>(path, { signal });
      // /team supplies server availability; the UI does not infer rights from its clock.
      const team = await request<TeamStatus>(`${path}/team`, { signal });
      if (team.eventId !== event.id)
        throw new Error("Несогласованные данные события");
      return { ...event, team };
    },
    retry: false,
  });

export const organizationEventsQuery = (
  id: string,
  page: number,
  viewerId?: string,
) =>
  queryOptions({
    queryKey: ["events", "organization", id, viewerId ?? "guest", page],
    enabled: isUuid(id),
    queryFn: ({ signal }) =>
      request<Page<EventCardDto>>(
        `/organizations/${encodeURIComponent(id)}/events?page=${page}&size=6`,
        { signal },
      ),
    retry: false,
  });
