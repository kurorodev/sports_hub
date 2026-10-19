import type { ReactNode } from "react";
import type { NotificationRepository } from "../model";
import { NotificationContext } from "./repository-context";
export function NotificationRepositoryProvider({
  repository,
  children,
}: {
  repository: NotificationRepository;
  children: ReactNode;
}) {
  return (
    <NotificationContext.Provider value={repository}>
      {children}
    </NotificationContext.Provider>
  );
}
