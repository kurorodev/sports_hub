import { Link, useLocation } from "react-router-dom";
import type { EventCardDto, VenueMapItem } from "../../../shared/api/types";
import { hasPoint } from "../../../shared/lib/map";
import { GeoMarker } from "../../../shared/ui/GeoMarker";
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
          <GeoMarker
            key={event.id}
            point={{
              latitude: event.location.latitude!,
              longitude: event.location.longitude!,
            }}
            title={`Мероприятие: ${event.title}`}
            onSelect={() => onSelect("event", event.id)}
            tooltip={
              <>
                {event.title} · {event.sport.name} · {eventDate(event.startsAt)}{" "}
                {eventTimezone(event.startsAt)} · {event.location.address} ·{" "}
                {participantCount(event.confirmedCount, event.maxParticipants)}
              </>
            }
          >
            <MapEventSummary event={event} />
          </GeoMarker>
        ))}
      {venues.map((venue) => {
        const presentation =
          occupancyPresentation[currentOccupancy(venue, now)];
        return (
          <GeoMarker
            key={venue.id}
            point={venue.location}
            tone={presentation.tone}
            title={`Площадка: ${venue.name} — ${presentation.label}`}
            tooltip={
              <>
                {venue.name} · {presentation.label}
              </>
            }
            onSelect={() => onSelect("venue", venue.id)}
          >
            <VenueSummary venue={venue} now={now} />
            <button
              type="button"
              className="button secondary"
              onClick={() => onReport(venue.id)}
            >
              Оценить загруженность
            </button>
          </GeoMarker>
        );
      })}
    </>
  );
}
