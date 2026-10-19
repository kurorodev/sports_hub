import type { ReactNode } from "react";
import type { OrganizationRepository } from "../model";
import { OrganizationRepositoryContext } from "./repository-context";
export function OrganizationRepositoryProvider({
  children,
  repository,
}: {
  children: ReactNode;
  repository: OrganizationRepository;
}) {
  return (
    <OrganizationRepositoryContext.Provider value={repository}>
      {children}
    </OrganizationRepositoryContext.Provider>
  );
}
