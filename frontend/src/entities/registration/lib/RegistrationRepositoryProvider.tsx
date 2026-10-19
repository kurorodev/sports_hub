import type { ReactNode } from "react";
import type { RegistrationRepository } from "../model";
import { RegistrationRepositoryContext } from "./repository-context";

export function RegistrationRepositoryProvider({
  repository,
  children,
}: {
  repository: RegistrationRepository;
  children: ReactNode;
}) {
  return (
    <RegistrationRepositoryContext.Provider value={repository}>
      {children}
    </RegistrationRepositoryContext.Provider>
  );
}
