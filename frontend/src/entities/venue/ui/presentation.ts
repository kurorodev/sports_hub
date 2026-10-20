import { tr } from "../../../shared/i18n/translate";
import { localeTag } from "../../../shared/i18n/preferences";
import type { OccupancyLevel, VenueMapItem } from "../../../shared/api/types";

export const occupancyPresentation: Record<
  OccupancyLevel,
  { label: string; tone: string }
> = {
  LOW: { label: "Свободно / мало людей", tone: "low" },
  MEDIUM: { label: "Умеренная загруженность", tone: "medium" },
  HIGH: { label: "Много людей", tone: "high" },
  UNKNOWN: { label: "Нет актуальных данных", tone: "unknown" },
};
export function currentOccupancy(
  venue: VenueMapItem,
  now = Date.now(),
): OccupancyLevel {
  return venue.occupancy.validUntil &&
    Date.parse(venue.occupancy.validUntil) > now
    ? venue.occupancy.level
    : "UNKNOWN";
}
export function observationTime(venue: VenueMapItem, now = Date.now()) {
  const last = venue.occupancy.lastReportedAt;
  if (!last) return tr("Наблюдений пока нет");
  const minutes = Math.max(0, Math.floor((now - Date.parse(last)) / 60_000));
  const relative =
    minutes < 1
      ? tr("только что")
      : new Intl.RelativeTimeFormat(localeTag(), { numeric: "always" }).format(
          -Math.floor(minutes < 60 ? minutes : minutes / 60),
          minutes < 60 ? "minute" : "hour",
        );
  return currentOccupancy(venue, now) === "UNKNOWN"
    ? tr("Последнее наблюдение {0} — устарело", [relative])
    : tr("Информация обновлена {0}", [relative]);
}
