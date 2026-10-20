import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { sessionQuery } from "../../../entities/session";
import { EventDiscussion } from "../../../features/event-discussion";
import { RegistrationRequests } from "../../../features/review-registrations";
import { isUuid } from "../../../shared/lib/identifiers";
import { toEventParticipation, EventLocation } from "../../../entities/event";
import { safeMapReturn } from "../../../shared/lib/activity-navigation";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
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
import { useCallback, useState } from "react";
import { Toast } from "../../../shared/ui/Toast";
import { ReportCommentDialog } from "../../../features/support";
import type { DiscussionComment } from "../../../entities/comment/model";

export function EventPage() {
  useLocale();
  const [report, setReport] = useState<DiscussionComment | null>(null);
  const { eventId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const dismissCreated = useCallback(() => {
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      preventScrollReset: true,
      state: { ...location.state, created: false },
    });
  }, [navigate, location]);
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
            {tr(
              "Не удалось обновить состояние встречи. Показаны последние полученные данные, введённый текст сохранён.",
            )}
          </p>
          <button
            className="button secondary"
            onClick={() => void query.refetch()}
          >
            {tr("Обновить состояние встречи")}
          </button>
        </div>
      )}
      <Link to={mapReturn ?? "/#activities"} className="back-link">
        <ArrowLeft size={18} />
        {mapReturn ? tr("Назад к карте") : tr("Все активности")}
      </Link>
      {created && (
        <Toast
          message={tr("Мероприятие создано")}
          placement="top"
          tone="success"
          onDismiss={dismissCreated}
        />
      )}
      <div className="detail-title">
        {event.viewerIsOrganizer && (
          <span className="owner-label">{tr("Вы организатор")}</span>
        )}
        <span className="eyebrow muted">{event.sport.name}</span>
        {event.customSportName && (
          <p className="field-hint">
            {tr("Активность: ")}
            {event.customSportName}
          </p>
        )}
        <h1>{event.title}</h1>
      </div>
      {event.status !== "PUBLISHED" && (
        <div className="notice" role="status">
          <strong>
            {tr("Запись закрыта ·")}{" "}
            {event.status === "DRAFT"
              ? tr("Черновик")
              : tr("Снято с публикации")}
          </strong>
        </div>
      )}
      <div className="detail-grid">
        <div>
          <img
            className="detail-art"
            src={event.sport.imageUrl || sportImage(event.sport.name)}
            alt={tr("Спортивная иллюстрация: {0}", [event.sport.name])}
            width="600"
            height="360"
          />
          <p className="detail-description">{event.description}</p>
          {event.requirements?.trim() && (
            <section
              className="event-requirements"
              aria-labelledby="event-requirements-heading"
            >
              <h2 id="event-requirements-heading">{tr("Условия участия")}</h2>
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
            onReport={
              session.data && !session.data.systemRoles.includes("ADMIN")
                ? setReport
                : undefined
            }
            eventId={event.id}
            published={event.status === "PUBLISHED"}
            organizerUserId={
              event.organizer.type === "USER" ? event.organizer.id : undefined
            }
          />
          {report &&
            session.data &&
            !session.data.systemRoles.includes("ADMIN") && (
              <ReportCommentDialog
                viewerId={session.data.user.id}
                comment={{
                  id: report.id,
                  text: report.text,
                  author: report.author.displayName,
                }}
                onClose={() => setReport(null)}
              />
            )}
        </div>
        <aside className="detail-summary">
          <h2>{tr("Встречаемся здесь")}</h2>
          <JoinAction
            event={toEventParticipation(event, event.team)}
            publicationClosed={event.status !== "PUBLISHED"}
          />
          <p>
            <CalendarDays size={20} />
            <time dateTime={event.startsAt}>
              {eventDate(event.startsAt)}
              <small>
                {tr("Часовой пояс: ")}
                {eventTimezone(event.startsAt)}
              </small>
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
            {tr(skillLabels[event.skillLevel])}
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
              ? tr("Свободная запись")
              : tr("Участие после одобрения организатора")}
            {event.maxParticipants != null &&
              event.confirmedCount >= event.maxParticipants && (
                <strong>{tr("Все места заняты")}</strong>
              )}
          </div>
        </aside>
      </div>
    </section>
  );
}
