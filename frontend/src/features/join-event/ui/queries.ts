import { queryOptions } from "@tanstack/react-query";
import { registrationKeys } from "../../../entities/registration";
import type {
  RegistrationRepository,
  Registration,
} from "../../../entities/registration/model";
import { findMyRegistration } from "../model/join-event";

export const myRegistrationQuery = (
  repository: RegistrationRepository,
  eventId: string,
  userId?: string,
) =>
  queryOptions<Registration | null>({
    queryKey: registrationKeys.mine(eventId, userId),
    enabled: Boolean(userId),
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === "PENDING" ? 5000 : false,
    queryFn: ({ signal }) =>
      userId
        ? findMyRegistration(repository, { eventId, viewerId: userId }, signal)
        : Promise.resolve(null),
  });
