import { createContext } from "react";
import type { NotificationRepository } from "../model";
export const NotificationContext = createContext<NotificationRepository | null>(
  null,
);
