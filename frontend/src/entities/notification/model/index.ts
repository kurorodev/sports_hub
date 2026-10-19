export const notificationKinds = [
  "REGISTRATION_STATUS",
  "NEW_REGISTRATION",
  "ORGANIZATION_STATUS",
  "EVENT_STATUS",
  "EVENT_UNPUBLISHED",
  "COMMENT_HIDDEN",
  "EVENT_UPDATED",
  "EVENT_STARTING",
  "MENTION",
  "SUPPORT_NEW",
  "SUPPORT_REPLY",
  "SUPPORT_STATUS",
] as const;
export interface Notification {
  id: string;
  type: (typeof notificationKinds)[number];
  title: string;
  text: string;
  reason: string | null;
  href: string | null;
  createdAt: string;
  readAt: string | null;
}
export interface NotificationPage {
  items: Notification[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
  unreadCount: number;
  asOf: string;
}
export interface NotificationRepository {
  list(page: number, signal?: AbortSignal): Promise<NotificationPage>;
  read(id: string): Promise<Notification>;
  readAll(through: string): Promise<void>;
}
