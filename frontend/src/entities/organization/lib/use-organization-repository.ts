import { useContext } from "react";
import { OrganizationRepositoryContext } from "./repository-context";
export function useOrganizationRepository() {
  const repo = useContext(OrganizationRepositoryContext);
  if (!repo) throw new Error("OrganizationRepositoryProvider is required");
  return repo;
}
