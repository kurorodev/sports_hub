import { tr } from "../../../shared/i18n/translate";
import { localeTag } from "../../../shared/i18n/preferences";
// Изображения сопоставляем с каталогом API; они не задают идентификаторы видов спорта.
export const sportArt: Record<string, string> = {
  default: "/art/sports/default.png",
  running: "/art/sports/running.jpg",
  basketball: "/art/sports/basketball.jpg",
  tennis: "/art/sports/tennis.jpg",
  chess: "/art/sports/chess.jpg",
  football: "/art/sports/football.jpg",
  volleyball: "/art/sports/volleyball.jpg",
  "table-tennis": "/art/sports/table-tennis.jpg",
  skiing: "/art/sports/skiing.jpg",
};
export function eventDate(value: string) {
  // Сохраняем смещение времени события, чтобы часовой пояс зрителя не менял указанную дату.
  const day = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  const date = new Intl.DateTimeFormat(localeTag(), {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(day);
  return `${date} · ${value.slice(11, 16)}`;
}

export const skillLabels = {
  ANY: "Любой уровень",
  BEGINNER: "Начинающий",
  AMATEUR: "Любитель",
  ADVANCED: "Продвинутый",
  PROFESSIONAL: "Профессиональный",
} as const;
export function participantCount(count: number, limit?: number | null) {
  return limit == null
    ? tr("Участников: {0} · без лимита", [count])
    : tr("{0} из {1} участников", [count, limit]);
}
export function sportIcon(name: string) {
  const key: Record<string, string> = {
    бег: "running",
    "легкая атлетика": "running",
    баскетбол: "basketball",
    теннис: "tennis",
    шахматы: "chess",
    футбол: "football",
    волейбол: "volleyball",
    "настольный теннис": "table-tennis",
    "лыжные гонки": "skiing",
    "лыжный спорт": "skiing",
    "горнолыжный спорт": "skiing",
  };
  return (
    sportArt[key[name.toLocaleLowerCase("ru").replaceAll("ё", "е")]] ??
    sportArt.default
  );
}
export function sportImage(name: string) {
  return sportIcon(name);
}
export function eventTimezone(value: string) {
  return value.endsWith("Z") ? "UTC" : `UTC${value.slice(-6)}`;
}
