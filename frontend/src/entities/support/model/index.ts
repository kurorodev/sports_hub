export const categories = [
  "HELP",
  "BUG",
  "IDEA",
  "VENUE_SUGGESTION",
  "COMMENT_REPORT",
] as const;
export const statuses = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_USER",
  "RESOLVED",
  "CLOSED",
] as const;
export const priorities = ["NORMAL", "HIGH", "URGENT"] as const;
export const reportReasons = ["SPAM", "ABUSE", "UNSAFE", "OTHER"] as const;
export type SupportCategory = (typeof categories)[number];
export type SupportStatus = (typeof statuses)[number];
export type SupportPriority = (typeof priorities)[number];
export const categoryLabels: Record<SupportCategory, string> = {
  HELP: "Нужна помощь",
  BUG: "Ошибка в приложении",
  IDEA: "Предложение",
  VENUE_SUGGESTION: "Новая площадка",
  COMMENT_REPORT: "Жалоба на комментарий",
};
export const statusLabels: Record<SupportStatus, string> = {
  OPEN: "Открыто",
  IN_PROGRESS: "В работе",
  WAITING_USER: "Ожидаем вашего ответа",
  RESOLVED: "Решено",
  CLOSED: "Закрыто",
};
export const priorityLabels: Record<SupportPriority, string> = {
  NORMAL: "Обычный",
  HIGH: "Высокий",
  URGENT: "Срочный",
};
export const reasonLabels: Record<(typeof reportReasons)[number], string> = {
  SPAM: "Спам или реклама",
  ABUSE: "Оскорбления или травля",
  UNSAFE: "Опасный или запрещённый контент",
  OTHER: "Другая причина",
};
export interface SupportPerson {
  id: string;
  displayName: string;
  nickname: string;
}
export interface SupportTicket {
  id: string;
  author: SupportPerson;
  assignedTo: SupportPerson | null;
  category: SupportCategory;
  status: SupportStatus;
  priority: SupportPriority;
  title: string;
  description: string;
  commentId: string | null;
  eventId: string | null;
  commentText: string | null;
  commentAuthor: string | null;
  reportReason: (typeof reportReasons)[number] | null;
  venueCity: string | null;
  venueAddress: string | null;
  venueLatitude?: number | null;
  venueLongitude?: number | null;
  createdAt: string;
  updatedAt: string;
}
export interface SupportMessage {
  id: string;
  ticketId: string;
  author: SupportPerson;
  fromSupport: boolean;
  kind: "MESSAGE" | "STATUS";
  text: string;
  createdAt: string;
}
export interface SupportPage<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}
export interface SupportCreate {
  category: SupportCategory;
  title: string;
  description: string;
  commentId?: string;
  reportReason?: (typeof reportReasons)[number];
  venueCity?: string;
  venueAddress?: string;
  venueLatitude?: number;
  venueLongitude?: number;
}
export interface SupportFilters {
  q?: string;
  status?: SupportStatus;
  category?: SupportCategory;
  page: number;
}
export interface SupportRepository {
  list(
    queue: boolean,
    filters: SupportFilters,
    signal?: AbortSignal,
  ): Promise<SupportPage<SupportTicket>>;
  get(id: string, signal?: AbortSignal): Promise<SupportTicket>;
  create(input: SupportCreate): Promise<SupportTicket>;
  messages(
    id: string,
    page: number,
    signal?: AbortSignal,
  ): Promise<SupportPage<SupportMessage>>;
  reply(id: string, text: string): Promise<SupportMessage>;
  update(
    id: string,
    input: { status?: SupportStatus; priority?: SupportPriority },
  ): Promise<SupportTicket>;
}
