import { tr } from "../i18n/translate";
import { useLocale } from "../i18n/use-preferences";
import { Navigation } from "lucide-react";
import type { Location } from "../api/types";
import { useCurrentLocation } from "../lib/current-location-context";
import { distanceMeters, formatDistance } from "../lib/distance";
import { hasPoint } from "../lib/map";

export function EventDistance({ location }: { location: Location }) {
  useLocale();
  const { position } = useCurrentLocation();
  if (!position) return null;
  return (
    <p
      className="event-info event-distance"
      title={tr("Примерное расстояние по прямой до точки мероприятия")}
    >
      <Navigation size={16} aria-hidden="true" />
      <span>
        {hasPoint(location)
          ? tr("≈ {0} от вас", [
              formatDistance(distanceMeters(position, location)),
            ])
          : tr("Расстояние не определено: нет точки на карте")}
      </span>
    </p>
  );
}
