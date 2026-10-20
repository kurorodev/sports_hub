import { tr } from "../../../shared/i18n/translate";
import {
  ModerationFailure,
  type EventStatus,
  type ModerationFailureCode,
} from "../model";
export const moderationStatuses: Record<
  EventStatus,
  { label: string; tone: string }
> = {
  DRAFT: { label: "Черновик", tone: "muted" },
  PUBLISHED: { label: "Опубликовано", tone: "success" },
  UNPUBLISHED: { label: "Снято с публикации", tone: "warning" },
  DELETED: { label: "Удалено", tone: "danger" },
};
const messages: Record<ModerationFailureCode, string> = {
  network: "Нет связи с сервером. Проверьте список перед повторной отправкой.",
  unauthenticated: "Войдите в аккаунт администратора.",
  forbidden: "У этого аккаунта нет прав на модерацию.",
  "not-found": "Объект не найден или недоступен.",
  conflict: "Статус уже изменился. Обновите список.",
  "invalid-input": "Укажите причину от 3 до 1000 символов.",
  "invalid-response":
    "Не удалось подтвердить ответ сервера. Проверьте список перед повторной отправкой.",
  unavailable:
    "Сервис временно недоступен. Проверьте список и попробуйте снова.",
  unknown: "Не удалось выполнить действие. Попробуйте ещё раз.",
};
export function moderationErrorMessage(error: unknown) {
  return tr(
    error instanceof ModerationFailure
      ? messages[error.code]
      : messages.unknown,
  );
}
