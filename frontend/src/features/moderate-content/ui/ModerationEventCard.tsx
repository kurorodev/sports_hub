import { Link } from "react-router-dom";
import type { ModerationEvent } from "../../../entities/moderation/model";
import { moderationStatuses } from "../../../entities/moderation";
import { eventDate, OrganizerPreview } from "../../../entities/event";
import { ModerationReasonForm } from "./ModerationReasonForm";
import { useModerateContent } from "./use-moderate-content";
export function ModerationEventCard({
  event,
  viewerId,
  onDone,
}: {
  event: ModerationEvent;
  viewerId: string;
  onDone: () => void;
}) {
  const mutation = useModerateContent(onDone);
  const status = moderationStatuses[event.status];
  return (
    <article
      className="moderation-card"
      aria-label={`Мероприятие: ${event.title}`}
    >
      <h3>
        <Link to={`/events/${event.id}`}>{event.title}</Link>
      </h3>
      <span className={`card-registration ${status.tone}`}>{status.label}</span>
      <p className="moderation-text">{event.description}</p>
      <p className="join-note">
        {event.sportName} · {eventDate(event.startsAt)} UTC · {event.city},{" "}
        {event.address}
      </p>
      <p className="join-note">
        Организатор: <OrganizerPreview organizer={event.organizer} />
      </p>
      <p className="join-note">
        Подтверждённых участников: {event.confirmedParticipants}
      </p>
      <div className="moderation-links">
        <Link
          className="button secondary"
          to={`/admin?section=comments&eventId=${event.id}`}
        >
          Комментарии мероприятия
        </Link>
        <Link className="button secondary" to={`/events/${event.id}`}>
          Открыть мероприятие
        </Link>
      </div>
      {event.status === "PUBLISHED" && (
        <ModerationReasonForm
          id={event.id}
          action="Снять с публикации"
          consequence="Событие исчезнет из каталога. Новая запись и новые сообщения закроются; существующие регистрации сохранятся. Организатор получит причину в личных уведомлениях; записавшиеся узнают об изменении статуса."
          pending={mutation.isPending}
          error={mutation.error}
          onConfirm={(reason) =>
            mutation.mutate({ kind: "event", id: event.id, reason, viewerId })
          }
        />
      )}
    </article>
  );
}
