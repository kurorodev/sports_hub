import { localeTag } from "../../../shared/i18n/preferences";
import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { MentionText } from "../../../shared/ui/MentionText";
import { Avatar } from "../../../shared/ui/Avatar";
import { Link } from "react-router-dom";
import { BadgeCheck } from "lucide-react";
import type { DiscussionComment } from "../model";
import type { ReactNode } from "react";
export function CommentCard({
  comment,
  organizerUserId,
  action,
}: {
  comment: DiscussionComment;
  organizerUserId?: string;
  action?: ReactNode;
}) {
  useLocale();
  const date = new Intl.DateTimeFormat(localeTag(), {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(comment.publishedAt));
  return (
    <article
      id={`comment-${comment.id}`}
      className={`comment-card ${comment.visibility === "hidden" ? "comment-hidden" : ""}`}
      aria-label={tr("Сообщение: {0}", [comment.author.displayName])}
    >
      <header className="comment-heading">
        <Avatar
          id={comment.author.id}
          name={comment.author.displayName}
          url={comment.author.avatarUrl}
          tone={organizerUserId === comment.author.id ? "organizer" : undefined}
          size={40}
        />
        <strong>
          <Link className="person-link" to={`/users/${comment.author.id}`}>
            {comment.author.displayName}
          </Link>
        </strong>
        {comment.author.nickname && (
          <span className="comment-handle">@{comment.author.nickname}</span>
        )}
        {organizerUserId === comment.author.id && (
          <span className="comment-organizer">
            <BadgeCheck size={16} />
            {tr("Организатор")}
          </span>
        )}
        <time dateTime={comment.publishedAt}>{date}</time>
      </header>
      <p className="comment-text">
        {comment.visibility === "hidden" ? (
          tr("Комментарий скрыт модератором.")
        ) : (
          <MentionText text={comment.text} mentions={comment.mentions} />
        )}
      </p>
      {action}
    </article>
  );
}
