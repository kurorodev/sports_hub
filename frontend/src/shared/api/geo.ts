import { queryOptions } from "@tanstack/react-query";
import { request } from "./client";
import type { GeoSuggestions, GeoReverseResponse } from "./types";

export const suggestionsQuery = (q: string, city: string) =>
  queryOptions({
    queryKey: ["geo", "suggest", q, city],
    queryFn: ({ signal }) =>
      request<GeoSuggestions>(
        `/geo/suggest?${new URLSearchParams({ q, city, limit: "5" })}`,
        { signal },
      ),
    enabled: q.trim().length >= 3 && q.trim().length <= 160,
    staleTime: 300_000,
    retry: false,
  });
export const reverseLocation = (
  latitude: number,
  longitude: number,
  signal: AbortSignal,
) =>
  request<GeoReverseResponse>(
    `/geo/reverse?${new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) })}`,
    { signal },
  );
