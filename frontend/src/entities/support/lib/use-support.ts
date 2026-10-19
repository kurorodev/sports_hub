import { useContext } from "react";
import { SupportContext } from "./context";
export function useSupportRepository() {
  const repository = useContext(SupportContext);
  if (!repository) throw new Error("SupportProvider required");
  return repository;
}
