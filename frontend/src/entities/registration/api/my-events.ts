import { queryOptions } from "@tanstack/react-query";
import { request } from "../../../shared/api/client";
import type { Page, Registration } from "../../../shared/api/types";

export const myEventsQuery = (
  viewerId: string,
  view: "UPCOMING" | "HISTORY",
  page: number,
) =>
  queryOptions({
    queryKey: ["my-events", viewerId, view, page],
    queryFn: ({ signal }) =>
      request<Page<Registration>>(
        `/me/registrations?view=${view}&page=${page}&size=12`,
        { signal },
      ),
    refetchInterval: 15000,
    retry: false,
  });
