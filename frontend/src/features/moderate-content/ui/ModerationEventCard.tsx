import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
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
  useLocale();
  const mutation = useModerateContent(onDone);
  const status = moderationStatuses[event.status];
  return (
    <article
      className="moderation-card"
      aria-label={tr("Мероприятие: {0}", [event.title])}
    >
      <h3>
        <Link to={`/events/${event.id}`}>{event.title}</Link>
      </h3>
      <span className={`card-registration ${status.tone}`}>
        {tr(status.label)}
      </span>
      <p className="moderation-text">{event.description}</p>
      <p className="join-note">
        {event.sportName} · {eventDate(event.startsAt)} UTC · {event.city},{" "}
        {event.address}
      </p>
      <p className="join-note">
        {tr("Организатор: ")}
        <OrganizerPreview organizer={event.organizer} />
      </p>
      <p className="join-note">
        {tr("Подтверждённых участников: ")}
        {event.confirmedParticipants}
      </p>
      <div className="moderation-links">
        <Link
          className="button secondary"
          to={`/admin?section=comments&eventId=${event.id}`}
        >
          {tr("Комментарии мероприятия")}
        </Link>
        <Link className="button secondary" to={`/events/${event.id}`}>
          {tr("Открыть мероприятие")}
        </Link>
      </div>
      {event.status === "PUBLISHED" && (
        <ModerationReasonForm
          id={event.id}
          action={tr("Снять с публикации")}
          consequence={tr(
            "Событие исчезнет из каталога. Новая запись и новые сообщения закроются; существующие регистрации сохранятся. Организатор получит причину в личных уведомлениях; записавшиеся узнают об изменении статуса.",
          )}
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
