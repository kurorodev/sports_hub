import { EventDiscussion } from "../../../features/event-discussion";
import { RegistrationRequests } from "../../../features/review-registrations";
import { isUuid } from "../../../shared/lib/identifiers";
import { toEventParticipation } from "../../../entities/event";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Users,
  Gauge,
  Building2,
} from "lucide-react";
import { ApiError } from "../../../shared/api/client";
import { ErrorState, NotFound, Skeletons } from "../../../shared/ui/Feedback";
import { eventQuery } from "../../../entities/event";
import {
  eventDate,
  sportImage,
  skillLabels,
  participantCount,
  eventTimezone,
} from "../../../entities/event";
import { JoinAction } from "../../../features/join-event";
import { Participants } from "../../../entities/registration";

export function EventPage() {
  const { eventId = "" } = useParams();
  const location = useLocation();
  const query = useQuery(eventQuery(eventId));
  if (!isUuid(eventId)) return <NotFound />;
  if (query.isPending)
    return (
      <section className="page-state">
        <Skeletons />
      </section>
    );
  if (query.isError)
    return query.error instanceof ApiError && query.error.status === 404 ? (
      <NotFound />
    ) : (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const event = query.data;
  const created =
    location.state &&
    typeof location.state === "object" &&
    "created" in location.state &&
    location.state.created === true &&
    event.viewerIsOrganizer;
  return (
    <section className="detail-page">
      <Link to="/#activities" className="back-link">
        <ArrowLeft size={18} />
        Все активности
      </Link>
      {created && (
        <div className="creation-success" role="status">
          <strong>Встреча опубликована</strong>
          <p>Теперь её могут найти другие пользователи в каталоге.</p>
          <Link to="/" className="button secondary">
            Посмотреть в каталоге
          </Link>
        </div>
      )}
      <div className="detail-title">
        {event.viewerIsOrganizer && (
          <span className="owner-label">Вы организатор</span>
        )}
        <span className="eyebrow muted">{event.sport.name} · Иллюстрация</span>
        <h1>{event.title}</h1>
      </div>
      <div className="detail-grid">
        <div>
          <img
            className="detail-art"
            src={sportImage(event.sport.name)}
            alt={`Спортивная иллюстрация: ${event.sport.name}`}
            width="600"
            height="360"
          />
          <p className="detail-description">{event.description}</p>
          {event.status !== "PUBLISHED" && (
            <div className="notice" role="status">
              <strong>
                Запись закрыта ·{" "}
                {event.status === "DRAFT" ? "Черновик" : "Снято с публикации"}
              </strong>
              {event.moderationReason && <p>{event.moderationReason}</p>}
            </div>
          )}
          {event.viewerIsOrganizer && event.joinMode === "APPROVAL" && (
            <RegistrationRequests
              key={`${event.id}:${event.organizer.id}`}
              eventId={event.id}
              decisionsOpen={event.status === "PUBLISHED"}
            />
          )}
          <Participants eventId={event.id} />
          <EventDiscussion
            key={event.id}
            eventId={event.id}
            published={event.status === "PUBLISHED"}
            organizerUserId={
              event.organizer.type === "USER" ? event.organizer.id : undefined
            }
          />
        </div>
        <aside className="detail-summary">
          <h2>Встречаемся здесь</h2>
          <JoinAction event={toEventParticipation(event, event.team)} />
          <p>
            <CalendarDays size={20} />
            <time dateTime={event.startsAt}>
              {eventDate(event.startsAt)}
              <small>Часовой пояс: {eventTimezone(event.startsAt)}</small>
            </time>
          </p>
          <p>
            <MapPin size={20} />
            <span>
              {event.location.city}
              <small>{event.location.address}</small>
            </span>
          </p>
          <p>
            <Gauge size={20} />
            {skillLabels[event.skillLevel]}
          </p>
          <p>
            <Users size={20} />
            {participantCount(event.confirmedCount, event.maxParticipants)}
          </p>
          <p>
            <Building2 size={20} />
            {event.organizer.type === "ORGANIZATION" ? (
              <Link to={`/organizations/${event.organizer.id}`}>
                {event.organizer.name}
              </Link>
            ) : (
              event.organizer.name
            )}
          </p>
          <div className="detail-condition">
            {event.joinMode === "OPEN"
              ? "Свободная запись"
              : "Участие после одобрения организатора"}
            {event.maxParticipants != null &&
              event.confirmedCount >= event.maxParticipants && (
                <strong>Все места заняты</strong>
              )}
          </div>
        </aside>
      </div>
    </section>
  );
}
