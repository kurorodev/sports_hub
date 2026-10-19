import type { ReactNode } from "react";
import type { ProfileRepository } from "../model";
import { ProfileRepositoryContext } from "./repository-context";
export function ProfileRepositoryProvider({
  repository,
  children,
}: {
  repository: ProfileRepository;
  children: ReactNode;
}) {
  return (
    <ProfileRepositoryContext.Provider value={repository}>
      {children}
    </ProfileRepositoryContext.Provider>
  );
}
