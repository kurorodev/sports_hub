import { CheckCircle2, Clock, XCircle, MinusCircle } from "lucide-react";
import {
  RegistrationFailure,
  type Registration,
  type RegistrationFailureCode,
} from "../model";

export const registrationPresentation: Record<
  Registration["status"],
  {
    label: string;
    organizerLabel: string;
    tone: string;
    Icon: typeof CheckCircle2;
  }
> = {
  PENDING: {
    organizerLabel: "Ожидает решения",
    label: "Ожидает решения",
    tone: "warning",
    Icon: Clock,
  },
  REJECTED: {
    organizerLabel: "Отклонено",
    label: "Заявка отклонена",
    tone: "danger",
    Icon: XCircle,
  },
  CANCELLED: {
    organizerLabel: "Участие отменено",
    label: "Участие отменено",
    tone: "muted",
    Icon: MinusCircle,
  },
  WAITLISTED: {
    organizerLabel: "В листе ожидания",
    label: "В листе ожидания",
    tone: "warning",
    Icon: Clock,
  },
  CONFIRMED: {
    organizerLabel: "Одобрено",
    label: "Вы участвуете",
    tone: "success",
    Icon: CheckCircle2,
  },
};

const messages: Record<RegistrationFailureCode, string> = {
  "already-registered": "Вы уже записаны. Обновляем статус участия.",
  full: "Последнее место уже заняли. Выберите другую встречу.",
  closed: "Запись на эту встречу закрыта.",
  organizer: "Вы организатор этой встречи.",
  "unsupported-mode": "Запись по заявке пока недоступна.",
  network: "Нет связи с сервером. Проверьте подключение и повторите попытку.",
  unauthenticated: "Войдите в аккаунт, чтобы продолжить.",
  forbidden: "У этого аккаунта нет доступа к действию.",
  "not-found": "Не удалось найти запрошенные данные.",
  conflict: "Данные уже изменились. Обновите страницу и повторите действие.",
  "invalid-input": "Проверьте введённые данные.",
  unavailable: "Сервис временно недоступен. Попробуйте ещё раз.",
  "invalid-response":
    "Не удалось подтвердить данные сервера. Обновите страницу и повторите попытку.",
  unknown: "Что-то пошло не так. Попробуйте ещё раз.",
};

export function registrationErrorMessage(error: unknown): string {
  return error instanceof RegistrationFailure
    ? messages[error.code]
    : messages.unknown;
}
