import { Marker, Popup, Tooltip } from "react-leaflet";
import { divIcon } from "leaflet";
import { Link, useLocation } from "react-router-dom";
import type { EventCardDto, VenueMapItem } from "../../../shared/api/types";
import { hasPoint } from "../../../shared/lib/map";
import { pointIcon } from "../../../shared/lib/map-icons";
import {
  eventDate,
  eventTimezone,
  participantCount,
} from "../../../entities/event";
import {
  currentOccupancy,
  occupancyPresentation,
  VenueSummary,
} from "../../../entities/venue";

const venueIcons = Object.fromEntries(
  Object.entries(occupancyPresentation).map(([level, presentation]) => [
    level,
    divIcon({
      className: `map-pin map-pin-venue occupancy-${presentation.tone}`,
      html: "<span aria-hidden='true'>●</span>",
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    }),
  ]),
);

export function MapEventSummary({ event }: { event: EventCardDto }) {
  const location = useLocation();
  return (
    <>
      <h3>{event.title}</h3>
      <p>
        {event.sport.name} · {eventDate(event.startsAt)}{" "}
        {eventTimezone(event.startsAt)}
      </p>
      <p>
        {event.location.city}, {event.location.address}
      </p>
      <p>
        {participantCount(event.confirmedCount, event.maxParticipants)}
        {event.spotsLeft != null ? ` · Свободно: ${event.spotsLeft}` : ""}
      </p>
      <p>{event.joinMode === "OPEN" ? "Свободная запись" : "По заявке"}</p>
      <Link
        className="button secondary"
        to={`/events/${event.id}`}
        state={{ mapReturn: `${location.pathname}${location.search}` }}
      >
        Подробнее
      </Link>
    </>
  );
}
export function MapMarkers({
  events,
  venues,
  now,
  onReport,
  onSelect,
}: {
  events: EventCardDto[];
  venues: VenueMapItem[];
  now: number;
  onReport: (id: string) => void;
  onSelect: (kind: "event" | "venue", id: string) => void;
}) {
  return (
    <>
      {events
        .filter((event) => hasPoint(event.location))
        .map((event) => (
          <Marker
            key={event.id}
            position={[event.location.latitude!, event.location.longitude!]}
            icon={pointIcon}
            title={`Мероприятие: ${event.title}`}
            alt={`Мероприятие: ${event.title}`}
            eventHandlers={{ click: () => onSelect("event", event.id) }}
          >
            <Tooltip>
              {event.title} · {event.sport.name} · {eventDate(event.startsAt)}{" "}
              {eventTimezone(event.startsAt)} · {event.location.address} ·{" "}
              {participantCount(event.confirmedCount, event.maxParticipants)}
            </Tooltip>
            <Popup>
              <MapEventSummary event={event} />
            </Popup>
          </Marker>
        ))}
      {venues.map((venue) => (
        <Marker
          key={venue.id}
          position={[venue.location.latitude, venue.location.longitude]}
          icon={venueIcons[currentOccupancy(venue, now)]}
          title={`Площадка: ${venue.name} — ${occupancyPresentation[currentOccupancy(venue, now)].label}`}
          alt={`Площадка: ${venue.name}`}
          eventHandlers={{ click: () => onSelect("venue", venue.id) }}
        >
          <Tooltip>
            {venue.name} ·{" "}
            {occupancyPresentation[currentOccupancy(venue, now)].label}
          </Tooltip>
          <Popup>
            <VenueSummary venue={venue} now={now} />
            <button
              type="button"
              className="button secondary"
              onClick={() => onReport(venue.id)}
            >
              Оценить загруженность
            </button>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
