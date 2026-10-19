import { useContext } from "react";
import { NotificationContext } from "./repository-context";
export function useNotificationRepository() {
  const repository = useContext(NotificationContext);
  if (!repository)
    throw new Error("NotificationRepositoryProvider отсутствует");
  return repository;
}
