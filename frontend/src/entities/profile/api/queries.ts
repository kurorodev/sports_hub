import { queryOptions } from "@tanstack/react-query";
import { isUuid } from "../../../shared/lib/identifiers";
import { ProfileFailure, type ProfileRepository } from "../model";
export const profileKeys = {
  own: (id: string) => ["profiles", "own", id] as const,
  public: (id: string) => ["profiles", "public", id] as const,
};
export const ownProfileQuery = (repo: ProfileRepository, viewerId: string) =>
  queryOptions({
    queryKey: profileKeys.own(viewerId),
    enabled: Boolean(viewerId),
    staleTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const result = await repo.own(signal);
      if (result.id !== viewerId) throw new ProfileFailure("invalid-response");
      return result;
    },
  });
export const publicProfileQuery = (repo: ProfileRepository, id: string) =>
  queryOptions({
    queryKey: profileKeys.public(id),
    enabled: isUuid(id),
    staleTime: 0,
    retry: false,
    queryFn: ({ signal }) => repo.find(id, signal),
  });
