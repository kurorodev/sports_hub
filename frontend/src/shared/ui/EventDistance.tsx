import { Navigation } from "lucide-react";
import type { Location } from "../api/types";
import { useCurrentLocation } from "../lib/current-location-context";
import { distanceMeters, formatDistance } from "../lib/distance";
import { hasPoint } from "../lib/map";

export function EventDistance({ location }: { location: Location }) {
  const { position } = useCurrentLocation();
  if (!position) return null;
  return (
    <p
      className="event-info event-distance"
      title="Примерное расстояние по прямой до точки мероприятия"
    >
      <Navigation size={16} aria-hidden="true" />
      <span>
        {hasPoint(location)
          ? `≈ ${formatDistance(distanceMeters(position, location))} от вас`
          : "Расстояние не определено: нет точки на карте"}
      </span>
    </p>
  );
}
