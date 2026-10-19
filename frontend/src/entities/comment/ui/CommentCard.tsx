import { MentionText } from "../../../shared/ui/MentionText";
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
  const date = new Intl.DateTimeFormat("ru-RU", {
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
      aria-label={`Сообщение: ${comment.author.displayName}`}
    >
      <header className="comment-heading">
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
            Организатор
          </span>
        )}
        <time dateTime={comment.publishedAt}>{date}</time>
      </header>
      <p className="comment-text">
        {comment.visibility === "hidden" ? (
          "Комментарий скрыт модератором."
        ) : (
          <MentionText text={comment.text} mentions={comment.mentions} />
        )}
      </p>
      {action}
    </article>
  );
}
