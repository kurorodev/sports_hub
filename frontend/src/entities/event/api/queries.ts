import { distanceParams } from "../../../shared/lib/distance";
import type { Point } from "../../../shared/lib/map";
import { isUuid } from "../../../shared/lib/identifiers";
import { queryOptions } from "@tanstack/react-query";
import { request } from "../../../shared/api/client";
import type {
  EventPreview,
  EventCardDto,
  TeamStatus,
  Page,
  Sport,
  MapEventsResponse,
} from "../../../shared/api/types";
import { dateBoundary } from "../../../shared/lib/activity-navigation";
export const mapEventsQuery = (
  bbox: string,
  sportId: string,
  viewerId?: string,
  dates: { from?: string; to?: string } = {},
  distance?: { radius: string; origin: Point | null },
) =>
  queryOptions({
    queryKey: [
      "map",
      "events",
      bbox,
      sportId,
      viewerId ?? "guest",
      dates,
      distance,
    ],
    queryFn: ({ signal }) =>
      request<MapEventsResponse>(
        `/map/events?${distanceParams(new URLSearchParams({ ...(distance?.radius ? { radiusMeters: distance.radius } : {}), bbox, ...(sportId ? { sportId } : {}), ...(dates.from ? { from: dateBoundary(dates.from) } : {}), ...(dates.to ? { to: dateBoundary(dates.to, true) } : {}), limit: "300" }), distance?.origin)}`,
        { signal },
      ),
    enabled: Boolean(bbox) && (!distance?.radius || Boolean(distance.origin)),
    retry: false,
    refetchInterval: 10000,
  });
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

export const eventsQuery = (params: URLSearchParams, origin?: Point | null) =>
  queryOptions({
    queryKey: [
      "events",
      params.toString(),
      params.has("radiusMeters") ? origin : undefined,
    ],
    enabled: !params.has("radiusMeters") || Boolean(origin),
    queryFn: ({ signal }) => {
      const apiParams = distanceParams(params, origin);
      // Граница дня задана в UTC; дата без времени и смещения изменила бы диапазон на сервере.
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
export const eventQuery = (id: string, viewerId?: string) =>
  queryOptions({
    queryKey: ["events", "detail", id, viewerId ?? "guest"],
    enabled: isUuid(id),
    queryFn: async ({ signal }) => {
      const path = `/events/${encodeURIComponent(id)}`;
      const event = await request<EventPreview>(path, { signal });
      // Доступность записи берём из /team: часы устройства не определяют права участника.
      const team = await request<TeamStatus>(`${path}/team`, { signal });
      if (team.eventId !== event.id)
        throw new Error("Несогласованные данные события");
      return { ...event, team };
    },
    retry: false,
    refetchInterval: 10000,
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
