import { queryOptions } from "@tanstack/react-query";
import { request } from "../../../shared/api/client";
import type {
  MapVenuesResponse,
  VenueCreate,
  VenueMapItem,
  OccupancyReportCreate,
} from "../../../shared/api/types";

export const venuesQuery = (bbox: string, sportId: string) =>
  queryOptions({
    queryKey: ["map", "venues", bbox, sportId],
    queryFn: ({ signal }) =>
      request<MapVenuesResponse>(
        `/map/venues?${new URLSearchParams({ bbox, ...(sportId ? { sportId } : {}), limit: "300" })}`,
        { signal },
      ),
    enabled: Boolean(bbox),
    retry: false,
    refetchInterval: 45_000,
  });
export const createVenue = (input: VenueCreate) =>
  request<VenueMapItem>("/map/venues", {
    method: "POST",
    body: JSON.stringify(input),
  });
export const reportOccupancy = (
  venueId: string,
  input: OccupancyReportCreate,
) =>
  request<VenueMapItem>(`/map/venues/${encodeURIComponent(venueId)}/reports`, {
    method: "POST",
    body: JSON.stringify(input),
  });
