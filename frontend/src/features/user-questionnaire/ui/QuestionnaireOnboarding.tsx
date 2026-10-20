import { useQuery } from "@tanstack/react-query";
import { questionnaireQuery } from "../api";
import { QuestionnaireDialog } from "./QuestionnaireDialog";

export function QuestionnaireOnboarding({ userId }: { userId: string }) {
  const query = useQuery(questionnaireQuery(userId));
  if (!query.data || query.data.status !== "PENDING") return null;
  return (
    <QuestionnaireDialog
      key={userId}
      userId={userId}
      initial={query.data}
      onboarding
    />
  );
}
