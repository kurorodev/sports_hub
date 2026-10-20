import { localeTag } from "../../../shared/i18n/preferences";
import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { Link } from "react-router-dom";
import type { ModerationComment } from "../../../entities/moderation/model";
import { ModerationReasonForm } from "./ModerationReasonForm";
import { useModerateContent } from "./use-moderate-content";
export function ModerationCommentCard({
  comment,
  viewerId,
  onDone,
}: {
  comment: ModerationComment;
  viewerId: string;
  onDone: () => void;
}) {
  useLocale();
  const mutation = useModerateContent(onDone);
  return (
    <article
      className="moderation-card"
      aria-label={tr("Комментарий: {0}", [comment.author.displayName])}
    >
      <div className="comment-heading">
        <strong>{comment.author.displayName}</strong>
        <time dateTime={comment.publishedAt}>
          {new Intl.DateTimeFormat(localeTag(), {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "UTC",
          }).format(new Date(comment.publishedAt))}{" "}
          UTC
        </time>
      </div>
      <span
        className={`card-registration ${comment.status === "VISIBLE" ? "success" : "muted"}`}
      >
        {comment.status === "VISIBLE"
          ? tr("Виден всем")
          : tr("Скрыт модератором")}
      </span>
      <p className="moderation-text">{comment.text}</p>
      {comment.status === "HIDDEN" && (
        <p className="join-note">
          {tr("Скрытый текст доступен только в административном разделе.")}
        </p>
      )}
      <Link
        className="button secondary"
        to={`/events/${comment.eventId}#event-discussion`}
      >
        {tr("Открыть обсуждение")}
      </Link>
      {comment.status === "VISIBLE" && (
        <ModerationReasonForm
          id={comment.id}
          action={tr("Скрыть комментарий")}
          consequence={tr(
            "Это сообщение исчезнет из публичного обсуждения. Остальные сообщения и мероприятие сохранятся.",
          )}
          pending={mutation.isPending}
          error={mutation.error}
          onConfirm={(reason) =>
            mutation.mutate({
              kind: "comment",
              id: comment.id,
              eventId: comment.eventId,
              reason,
              viewerId,
            })
          }
        />
      )}
    </article>
  );
}
