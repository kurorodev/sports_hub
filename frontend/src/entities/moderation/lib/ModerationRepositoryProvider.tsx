import type { ReactNode } from "react";
import type { ModerationRepository } from "../model";
import { ModerationRepositoryContext } from "./repository-context";
export function ModerationRepositoryProvider({
  children,
  repository,
}: {
  children: ReactNode;
  repository: ModerationRepository;
}) {
  return (
    <ModerationRepositoryContext.Provider value={repository}>
      {children}
    </ModerationRepositoryContext.Provider>
  );
}
