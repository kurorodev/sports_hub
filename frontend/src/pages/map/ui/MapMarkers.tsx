import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { EventDistance } from "../../../shared/ui/EventDistance";
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
} from "../../../entities/venue";

export function MapEventSummary({ event }: { event: EventCardDto }) {
  useLocale();
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
        {event.spotsLeft != null
          ? tr(" · Свободно: {0}", [event.spotsLeft])
          : ""}
      </p>
      <EventDistance location={event.location} />
      <p>
        {event.joinMode === "OPEN" ? tr("Свободная запись") : tr("По заявке")}
      </p>
      <Link
        className="button secondary"
        to={`/events/${event.id}`}
        state={{ mapReturn: `${location.pathname}${location.search}` }}
      >
        {tr("Подробнее")}
      </Link>
    </>
  );
}
export function MapMarkers({
  events,
  venues,
  now,
  onSelect,
}: {
  events: EventCardDto[];
  venues: VenueMapItem[];
  now: number;
  onSelect: (kind: "event" | "venue", id: string) => void;
}) {
  useLocale();
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
            title={tr("Мероприятие: {0}", [event.title])}
            onSelect={() => onSelect("event", event.id)}
            tooltip={
              <>
                {event.title} · {event.sport.name} · {eventDate(event.startsAt)}{" "}
                {eventTimezone(event.startsAt)} · {event.location.address} ·{" "}
                {participantCount(event.confirmedCount, event.maxParticipants)}
              </>
            }
          />
        ))}
      {venues.map((venue) => {
        const presentation =
          occupancyPresentation[currentOccupancy(venue, now)];
        return (
          <GeoMarker
            key={venue.id}
            point={venue.location}
            tone={presentation.tone}
            title={tr("Площадка: {0} — {1}", [venue.name, presentation.label])}
            tooltip={
              <>
                {venue.name} · {tr(presentation.label)}
              </>
            }
            onSelect={() => onSelect("venue", venue.id)}
          />
        );
      })}
    </>
  );
}
