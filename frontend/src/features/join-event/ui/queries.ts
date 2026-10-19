import { queryOptions } from "@tanstack/react-query";
import { registrationKeys } from "../../../entities/registration";
import type { RegistrationRepository } from "../../../entities/registration/model";
import { findMyRegistration } from "../model/join-event";

export const myRegistrationQuery = (
  repository: RegistrationRepository,
  eventId: string,
  userId?: string,
) =>
  queryOptions({
    queryKey: registrationKeys.mine(eventId, userId),
    enabled: Boolean(userId),
    retry: false,
    queryFn: ({ signal }) =>
      userId
        ? findMyRegistration(repository, { eventId, viewerId: userId }, signal)
        : Promise.resolve(null),
  });
