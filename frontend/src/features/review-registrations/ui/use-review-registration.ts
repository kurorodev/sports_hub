import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionQuery } from "../../../entities/session";
import {
  registrationKeys,
  useRegistrationRepository,
} from "../../../entities/registration";
import type { Registration } from "../../../entities/registration/model";
import {
  reviewRegistration,
  type ReviewRegistrationInput,
} from "../model/review-registration";

export function useReviewRegistration(
  onDecided: (registration: Registration) => void,
) {
  const repository = useRegistrationRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ReviewRegistrationInput) =>
      reviewRegistration(repository, input),
    onSuccess: (registration, input) => {
      if (
        client.getQueryData(sessionQuery.queryKey)?.user.id !== input.viewerId
      )
        return;
      onDecided(registration);
    },
    onSettled: async (_data, _error, input) => {
      if (
        client.getQueryData(sessionQuery.queryKey)?.user.id !== input.viewerId
      )
        return;
      await Promise.all([
        client.invalidateQueries({
          queryKey: registrationKeys.event(input.eventId),
        }),
        client.invalidateQueries({ queryKey: ["events"] }),
        client.invalidateQueries({ queryKey: ["map", "events"] }),
      ]);
    },
  });
}
