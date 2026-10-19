import { useContext } from "react";
import { RegistrationRepositoryContext } from "./repository-context";

export function useRegistrationRepository() {
  const repository = useContext(RegistrationRepositoryContext);
  if (!repository)
    throw new Error("RegistrationRepositoryProvider is required");
  return repository;
}
