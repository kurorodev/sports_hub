import { useId } from "react";
import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { occupancyPresentation } from "./presentation";

// Демонстрационный график: столбцы не рассчитаны по сообщениям о загруженности площадки.
const days = [
  { short: "Пн", name: "Понедельник", level: "LOW", height: 16 },
  { short: "Вт", name: "Вторник", level: "LOW", height: 22 },
  { short: "Ср", name: "Среда", level: "MEDIUM", height: 30 },
  { short: "Чт", name: "Четверг", level: "LOW", height: 20 },
  { short: "Пт", name: "Пятница", level: "MEDIUM", height: 34 },
  { short: "Сб", name: "Суббота", level: "HIGH", height: 44 },
  { short: "Вс", name: "Воскресенье", level: "MEDIUM", height: 32 },
] as const;
export function VenueWeekPreview() {
  useLocale();
  const titleId = useId();
  const noteId = useId();
  return (
    <figure
      className="venue-week-preview"
      aria-labelledby={titleId}
      aria-describedby={noteId}
    >
      <figcaption id={titleId}>
        <strong>{tr("Загруженность на неделе")}</strong>
        <span className="venue-week-badge">{tr("Демо")}</span>
      </figcaption>
      <p id={noteId} className="venue-week-note">
        {tr("Пример прогноза на текущую неделю")}
      </p>
      <ol className="venue-week-days">
        {days.map((day) => {
          const status = occupancyPresentation[day.level];
          return (
            <li
              key={day.short}
              className={`occupancy-${status.tone}`}
              title={`${tr(day.name)}: ${tr(status.label)}`}
            >
              <span className="venue-week-track" aria-hidden="true">
                <span
                  className="venue-week-bar"
                  style={{ height: day.height }}
                />
              </span>
              <span className="venue-week-day" aria-hidden="true">
                {tr(day.short)}
              </span>
              <span className="sr-only">
                {tr(day.name)}: {tr(status.label)}
              </span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
