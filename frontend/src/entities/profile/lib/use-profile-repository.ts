import { useContext } from "react";
import { ProfileRepositoryContext } from "./repository-context";
export function useProfileRepository() {
  const repo = useContext(ProfileRepositoryContext);
  if (!repo) throw new Error("ProfileRepositoryProvider is missing");
  return repo;
}
