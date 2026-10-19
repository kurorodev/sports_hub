import { queryOptions } from "@tanstack/react-query";
import { isUuid } from "../../../shared/lib/identifiers";
import {
  OrganizationFailure,
  type OrganizationRepository,
  type OrganizationStatus,
} from "../model";
export const organizationKeys = {
  all: ["organizations"] as const,
  mine: (viewerId: string) => ["organizations", "mine", viewerId] as const,
};
export const myOrganizationsQuery = (
  repository: OrganizationRepository,
  viewerId: string,
) =>
  queryOptions({
    queryKey: organizationKeys.mine(viewerId),
    enabled: Boolean(viewerId),
    queryFn: async ({ signal }) => {
      const items = await repository.mine(signal);
      if (items.some((item) => item.representative.id !== viewerId))
        throw new OrganizationFailure("invalid-response");
      return items;
    },
    retry: false,
    refetchInterval: 10000,
    staleTime: 0,
  });
export const organizationQuery = (
  repository: OrganizationRepository,
  id: string,
  viewerId: string | undefined,
) =>
  queryOptions({
    queryKey: ["organizations", "detail", id, viewerId ?? "guest"],
    enabled: isUuid(id),
    queryFn: ({ signal }) => repository.find(id, signal),
    retry: false,
    refetchInterval: 10000,
    staleTime: 0,
  });
export const organizationsQuery = (
  repository: OrganizationRepository,
  filter: {
    q: string;
    page: number;
    admin?: boolean;
    status?: OrganizationStatus;
  },
  viewerId?: string,
) =>
  queryOptions({
    queryKey: ["organizations", "list", filter, viewerId ?? "guest"],
    queryFn: ({ signal }) => repository.list(filter, signal),
    retry: false,
    refetchInterval: 10000,
    staleTime: 0,
  });
