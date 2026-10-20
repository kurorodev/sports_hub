import { tr } from "../../../shared/i18n/translate";
import {
  OrganizationFailure,
  type OrganizationStatus,
  type OrganizationFailureCode,
} from "../model";
export const organizationStatuses: Record<
  OrganizationStatus,
  { label: string; tone: string }
> = {
  PENDING: { label: "Заявка на рассмотрении", tone: "warning" },
  APPROVED: { label: "Организация подтверждена", tone: "success" },
  REJECTED: { label: "Заявка отклонена", tone: "danger" },
};
const messages: Record<OrganizationFailureCode, string> = {
  network: "Нет связи с сервером. Проверьте список перед повторной отправкой.",
  unauthenticated: "Войдите в аккаунт, чтобы продолжить.",
  forbidden: "У этого аккаунта нет доступа к действию.",
  "not-found": "Организация не найдена или недоступна для этого аккаунта.",
  conflict: "Заявка уже изменилась. Обновите список.",
  "invalid-input": "Проверьте поля заявки и причину решения.",
  "invalid-response":
    "Не удалось подтвердить ответ сервера. Обновите список перед повторной отправкой.",
  unavailable:
    "Сервис временно недоступен. Проверьте список и попробуйте снова.",
  unknown: "Не удалось выполнить действие. Попробуйте ещё раз.",
};
export function organizationErrorMessage(error: unknown) {
  return tr(
    error instanceof OrganizationFailure
      ? messages[error.code]
      : messages.unknown,
  );
}
