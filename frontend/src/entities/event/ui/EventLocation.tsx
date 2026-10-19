import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import type { Location } from "../../../shared/api/types";
import { hasPoint } from "../../../shared/lib/map";
import { writeMapView } from "../../../shared/lib/activity-navigation";

const GeoMap = lazy(() =>
  import("../../../shared/ui/GeoMap").then((module) => ({
    default: module.GeoMap,
  })),
);

export function EventLocation({
  location,
  eventId,
  mapReturn,
}: {
  location: Location;
  eventId: string;
  mapReturn?: string;
}) {
  const [open, setOpen] = useState(false);
  const pinned = hasPoint(location);
  const params = new URLSearchParams(mapReturn?.split("?")[1]);
  params.set("eventId", eventId);
  params.delete("venueId");
  params.delete("events");
  // Explicit coordinates belong to the event; an address alone is never guessed into a pin.
  const href = pinned
    ? `/map?${writeMapView(params, { ...location, zoom: 16 })}`
    : undefined;
  return (
    <section
      className="event-location"
      aria-labelledby={`event-location-${eventId}`}
    >
      <h2 id={`event-location-${eventId}`}>
        <MapPin size={22} /> Место встречи
      </h2>
      <p>
        {location.city}, {location.address}
      </p>
      {pinned ? (
        <>
          <div className="event-location-actions">
            <button
              className="button secondary"
              aria-expanded={open}
              aria-controls={`event-map-${eventId}`}
              onClick={() => setOpen(!open)}
            >
              {open ? "Скрыть карту места" : "Показать место на карте"}
            </button>
            <Link className="button secondary" to={href!}>
              Открыть карту района
            </Link>
          </div>
          {open && (
            <div id={`event-map-${eventId}`}>
              <Suspense fallback={<p role="status">Загружаем карту места…</p>}>
                <GeoMap
                  compact
                  center={location}
                  point={location}
                  zoom={16}
                  locate={false}
                  tileErrorMessage="Подложка недоступна. Адрес встречи и точка организатора сохранены."
                />
              </Suspense>
              <p className="field-hint">
                Точка указана организатором. Уточнения по месту — в обсуждении
                встречи.
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="field-hint">
          Точная точка не указана. Ориентируйтесь на адрес или уточните место у
          организатора.
        </p>
      )}
    </section>
  );
}
