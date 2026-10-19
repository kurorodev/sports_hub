import { z } from "zod";
import { notificationKinds, type NotificationRepository } from "../model";
import type { components } from "../../../shared/api/generated/schema";

const notificationSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(notificationKinds),
  title: z.string(),
  text: z.string(),
  reason: z.string().nullable(),
  href: z
    .string()
    .regex(/^\/(events\/[0-9a-fA-F-]{36}|organization)$/)
    .nullable(),
  createdAt: z.string().datetime({ offset: true }),
  readAt: z.string().datetime({ offset: true }).nullable(),
});
const pageSchema = z.object({
  items: z.array(notificationSchema),
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  unreadCount: z.number().int().nonnegative(),
  asOf: z.string().datetime({ offset: true }),
});
type Transport = <T>(path: string, init?: RequestInit) => Promise<T>;
export function createHttpNotificationRepository(
  http: Transport,
): NotificationRepository {
  return {
    async list(page, signal) {
      return pageSchema.parse(
        await http<components["schemas"]["NotificationPage"]>(
          `/me/notifications?page=${page}&size=20`,
          { signal },
        ),
      );
    },
    async read(id) {
      return notificationSchema.parse(
        await http<components["schemas"]["Notification"]>(
          `/me/notifications/${id}/read`,
          { method: "POST" },
        ),
      );
    },
    readAll(through) {
      const body: components["schemas"]["NotificationsReadRequest"] = {
        through,
      };
      return http<void>("/me/notifications/read-all", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
  };
}
