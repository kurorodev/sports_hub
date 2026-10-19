// Presentation-only assets. Sport identifiers and labels await the shared contract.
export const sportArt: Record<string, string> = {
  running: "/art/running.svg",
  basketball: "/art/basketball.svg",
  tennis: "/art/tennis.svg",
  chess: "/art/chess.svg",
};
export function eventDate(value: string) {
  // Preserve the event's supplied offset rather than silently converting to the viewer's zone.
  const day = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  const date = new Intl.DateTimeFormat("ru-RU", {
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
    ? `Участников: ${count} · без лимита`
    : `${count} из ${limit} участников`;
}
export function sportImage(name: string) {
  const key: Record<string, string> = {
    бег: "running",
    баскетбол: "basketball",
    теннис: "tennis",
    шахматы: "chess",
  };
  return sportArt[key[name.toLocaleLowerCase("ru")]] ?? "/art/activity.svg";
}
export function eventTimezone(value: string) {
  return value.endsWith("Z") ? "UTC" : `UTC${value.slice(-6)}`;
}
