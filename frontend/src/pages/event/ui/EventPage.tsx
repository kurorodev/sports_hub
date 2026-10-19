import { sessionQuery } from "../../../entities/session";
import { EventDiscussion } from "../../../features/event-discussion";
import { RegistrationRequests } from "../../../features/review-registrations";
import { isUuid } from "../../../shared/lib/identifiers";
import { toEventParticipation, EventLocation } from "../../../entities/event";
import { safeMapReturn } from "../../../shared/lib/activity-navigation";
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
  OrganizerPreview,
} from "../../../entities/event";
import { JoinAction } from "../../../features/join-event";
import { Participants } from "../../../entities/registration";

export function EventPage() {
  const { eventId = "" } = useParams();
  const location = useLocation();
  const mapReturn = safeMapReturn(location.state);
  const session = useQuery(sessionQuery);
  const query = useQuery({
    ...eventQuery(eventId, session.data?.user.id),
    enabled: isUuid(eventId) && !session.isPending && !session.isError,
  });
  if (!isUuid(eventId)) return <NotFound />;
  if (session.isError)
    return (
      <ErrorState error={session.error} retry={() => void session.refetch()} />
    );
  if (session.isPending || query.isPending)
    return (
      <section className="page-state">
        <Skeletons />
      </section>
    );
  const accessLost =
    query.error instanceof ApiError &&
    [401, 403, 404].includes(query.error.status);
  if (!query.data || accessLost)
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
    event.viewerIsOrganizer &&
    event.status === "PUBLISHED";
  return (
    <section className="detail-page">
      {query.isError && (
        <div className="notice" role="alert">
          <p>
            Не удалось обновить состояние встречи. Показаны последние полученные
            данные, введённый текст сохранён.
          </p>
          <button
            className="button secondary"
            onClick={() => void query.refetch()}
          >
            Обновить состояние встречи
          </button>
        </div>
      )}
      <Link to={mapReturn ?? "/#activities"} className="back-link">
        <ArrowLeft size={18} />
        {mapReturn ? "Назад к карте" : "Все активности"}
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
        {event.customSportName && (
          <p className="field-hint">Активность: {event.customSportName}</p>
        )}
        <h1>{event.title}</h1>
      </div>
      {event.status !== "PUBLISHED" && (
        <div className="notice" role="status">
          <strong>
            Запись закрыта ·{" "}
            {event.status === "DRAFT" ? "Черновик" : "Снято с публикации"}
          </strong>
        </div>
      )}
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
          {event.requirements?.trim() && (
            <section
              className="event-requirements"
              aria-labelledby="event-requirements-heading"
            >
              <h2 id="event-requirements-heading">Условия участия</h2>
              <p>{event.requirements}</p>
            </section>
          )}
          <EventLocation
            location={event.location}
            eventId={event.id}
            mapReturn={mapReturn}
          />
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
          <JoinAction
            event={toEventParticipation(event, event.team)}
            publicationClosed={event.status !== "PUBLISHED"}
          />
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
            <OrganizerPreview organizer={event.organizer} />
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
