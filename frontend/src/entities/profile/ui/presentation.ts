import {
  ProfileFailure,
  type ProfileFailureCode,
  type SportRole,
  type ExperienceLevel,
  type PreferredTime,
  type Profile,
} from "../model";
export const sportRoleLabels: Record<SportRole, string> = {
  ATHLETE: "Спортсмен",
  COACH: "Тренер",
  REFEREE: "Судья",
  SPORTS_ORGANIZER: "Организатор спорта",
};
export const levelLabels: Record<ExperienceLevel, string> = {
  BEGINNER: "Начинающий",
  AMATEUR: "Любитель",
  ADVANCED: "Продвинутый",
  PROFESSIONAL: "Профессиональный",
};
export const timeLabels: Record<PreferredTime, string> = {
  MORNING: "Утром",
  DAY: "Днём",
  EVENING: "Вечером",
  ANY: "Любое время",
};
export const rankLabels: Record<Profile["rank"], string> = {
  ROOKIE: "Новичок",
  ACTIVE: "Активный",
  EXPERIENCED: "Опытный",
  ELITE: "Элита",
};
const messages: Record<ProfileFailureCode, string> = {
  network: "Нет связи с сервером. Проверьте подключение и повторите попытку.",
  unauthenticated: "Войдите в аккаунт, чтобы открыть свой профиль.",
  forbidden: "Нет доступа. Обновите сессию и повторите попытку.",
  "not-found": "Профиль не найден.",
  conflict: "Никнейм уже занят. Выберите другой.",
  "invalid-input":
    "Проверьте поля профиля. Никнейм — 3–40 символов, имя — 1–100, аватар — ссылка http или https.",
  "invalid-response":
    "Не удалось подтвердить данные профиля. Обновите страницу и повторите попытку.",
  unavailable: "Сервис временно недоступен. Попробуйте ещё раз.",
  unknown: "Не удалось сохранить профиль. Попробуйте ещё раз.",
};
export function profileErrorMessage(error: unknown) {
  return error instanceof ProfileFailure
    ? messages[error.code]
    : messages.unknown;
}
