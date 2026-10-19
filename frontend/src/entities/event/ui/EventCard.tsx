import {
  ArrowUpRight,
  CalendarDays,
  MapPin,
  Users,
  Building2,
  UserRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { EventCardDto } from "../../../shared/api/types";
import {
  eventDate,
  sportImage,
  skillLabels,
  participantCount,
} from "../lib/presentation";

export function EventCard({
  event,
  participation,
}: {
  event: EventCardDto;
  participation?: { label: string; tone: string };
}) {
  const places = event.spotsLeft ?? Infinity;
  const OrganizerIcon =
    event.organizer.type === "ORGANIZATION" ? Building2 : UserRound;
  return (
    <article className="event-card">
      <div className="event-art">
        <img
          src={sportImage(event.sport.name)}
          alt=""
          loading="lazy"
          width="600"
          height="360"
        />
        <span className="sport-badge">{event.sport.name}</span>
        <span className="art-caption">Иллюстрация</span>
      </div>
      <div className="event-card-body">
        <div className="event-meta-top">
          <span>{skillLabels[event.skillLevel]}</span>
          <span className="tiny-dot" />
          <span>
            {event.joinMode === "OPEN" ? "Свободная запись" : "По заявке"}
          </span>
        </div>
        {participation && (
          <span className={`card-registration ${participation.tone}`}>
            {participation.label}
          </span>
        )}
        <h3>
          <Link to={`/events/${event.id}`}>
            {event.title}
            <ArrowUpRight size={20} />
          </Link>
        </h3>
        <p className="event-info">
          <CalendarDays size={16} />
          <time dateTime={event.startsAt}>{eventDate(event.startsAt)}</time>
        </p>
        <p className="event-info">
          <MapPin size={16} />
          <span>
            {event.location.city} · {event.location.address}
          </span>
        </p>
        <div className="event-organizer">
          <OrganizerIcon size={16} />
          {event.organizer.type === "ORGANIZATION" ? (
            <Link to={`/organizations/${event.organizer.id}`}>
              {event.organizer.name}
            </Link>
          ) : (
            <span>{event.organizer.name}</span>
          )}
        </div>
        <div className="card-bottom">
          <span className={places > 0 ? "places" : "places full"}>
            <Users size={16} />
            {participantCount(event.confirmedCount, event.maxParticipants)}
          </span>
          <Link
            className="card-link"
            to={`/events/${event.id}`}
            aria-label={`Подробнее: ${event.title}`}
          >
            <ArrowUpRight size={20} />
          </Link>
        </div>
      </div>
    </article>
  );
}
