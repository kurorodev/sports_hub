export const sportOptions = [
  { id: "", name: "Все виды спорта" },
  { id: "running", name: "Бег" },
  { id: "basketball", name: "Баскетбол" },
  { id: "tennis", name: "Теннис" },
  { id: "chess", name: "Шахматы" },
];
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
