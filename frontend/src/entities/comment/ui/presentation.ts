import { CommentFailure, type CommentFailureCode } from "../model";
const messages: Record<CommentFailureCode, string> = {
  network:
    "Нет связи с сервером. Проверьте обсуждение перед повторной отправкой.",
  unauthenticated: "Войдите в аккаунт, чтобы написать сообщение.",
  forbidden: "Нет доступа. Обновите страницу и проверьте аккаунт.",
  "not-found": "Обсуждение недоступно или событие больше не найдено.",
  closed: "Обсуждение этого события закрыто для новых сообщений.",
  "invalid-input": "Проверьте сообщение: от 1 до 2000 символов.",
  conflict: "Данные изменились. Обновите обсуждение и повторите действие.",
  unavailable:
    "Сервис временно недоступен. Проверьте обсуждение и попробуйте ещё раз.",
  "invalid-response":
    "Не удалось подтвердить ответ сервера. Обновите обсуждение перед повторной отправкой.",
  unknown: "Не удалось выполнить действие. Попробуйте ещё раз.",
};
export function commentErrorMessage(error: unknown) {
  return error instanceof CommentFailure
    ? messages[error.code]
    : messages.unknown;
}
