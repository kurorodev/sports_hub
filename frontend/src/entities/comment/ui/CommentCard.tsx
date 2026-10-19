import { BadgeCheck } from "lucide-react";
import type { DiscussionComment } from "../model";
export function CommentCard({
  comment,
  organizerUserId,
}: {
  comment: DiscussionComment;
  organizerUserId?: string;
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
      className={`comment-card ${comment.visibility === "hidden" ? "comment-hidden" : ""}`}
      aria-label={`Сообщение: ${comment.author.displayName}`}
    >
      <header className="comment-heading">
        <strong>{comment.author.displayName}</strong>
        {organizerUserId === comment.author.id && (
          <span className="comment-organizer">
            <BadgeCheck size={16} />
            Организатор
          </span>
        )}
        <time dateTime={comment.publishedAt}>{date}</time>
      </header>
      <p className="comment-text">
        {comment.visibility === "hidden"
          ? "Комментарий скрыт модератором."
          : comment.text}
      </p>
    </article>
  );
}
