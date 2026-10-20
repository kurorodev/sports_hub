import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { request } from "../../shared/api/client";
import type {
  Questionnaire,
  QuestionnaireAnswers,
  RecommendedEvents,
} from "../../shared/api/types";

export const questionnaireQuery = (userId: string) =>
  queryOptions({
    queryKey: ["questionnaire", userId],
    enabled: Boolean(userId),
    retry: false,
    staleTime: 30_000,
    queryFn: ({ signal }) =>
      request<Questionnaire>("/me/questionnaire", { signal }),
  });

export const recommendationsQuery = (
  userId: string,
  page = 0,
  includeOtherCities = false,
  includeOtherSports = false,
) =>
  queryOptions({
    queryKey: [
      "recommendations",
      userId,
      page,
      includeOtherCities,
      includeOtherSports,
    ],
    retry: false,
    staleTime: 0,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    queryFn: ({ signal }) =>
      request<RecommendedEvents>(
        `/events/recommended?size=6&page=${page}&includeOtherCities=${includeOtherCities}&includeOtherSports=${includeOtherSports}`,
        { signal },
      ),
  });

export function useQuestionnaireMutation(userId: string, onSaved?: () => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (answers: QuestionnaireAnswers | null) =>
      request<Questionnaire>(
        answers ? "/me/questionnaire" : "/me/questionnaire/skip",
        {
          method: "POST",
          ...(answers ? { body: JSON.stringify(answers) } : {}),
        },
      ),
    onSuccess: (data) => {
      client.setQueryData(questionnaireQuery(userId).queryKey, data);
      void client.invalidateQueries({ queryKey: ["profiles"] });
      void client.invalidateQueries({ queryKey: ["session"] });
      void client.invalidateQueries({ queryKey: ["recommendations", userId] });
      onSaved?.();
    },
  });
}
