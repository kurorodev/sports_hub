import type { ReactNode } from "react";
import type { SupportRepository } from "../model";
import { SupportContext } from "./context";
export function SupportProvider({
  repository,
  children,
}: {
  repository: SupportRepository;
  children: ReactNode;
}) {
  return <SupportContext value={repository}>{children}</SupportContext>;
}
