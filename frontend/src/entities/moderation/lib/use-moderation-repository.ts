import { useContext } from "react";
import { ModerationRepositoryContext } from "./repository-context";
export function useModerationRepository() {
  const repo = useContext(ModerationRepositoryContext);
  if (!repo) throw new Error("ModerationRepositoryProvider is required");
  return repo;
}
