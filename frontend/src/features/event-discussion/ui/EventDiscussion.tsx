import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { MessageCircle, RefreshCw } from "lucide-react";
import {
  CommentCard,
  commentKeys,
  commentPageQuery,
  commentErrorMessage,
  useCommentRepository,
} from "../../../entities/comment";
import type {
  DiscussionComment,
  CommentPage,
} from "../../../entities/comment/model";
import { sessionQuery } from "../../../entities/session";
import { ErrorState } from "../../../shared/ui/Feedback";
import { PublishCommentForm } from "./PublishCommentForm";

export function EventDiscussion({
  eventId,
  published,
  organizerUserId,
  onReport,
}: {
  eventId: string;
  published: boolean;
  organizerUserId?: string;
  onReport?: (comment: DiscussionComment) => void;
}) {
  const repository = useCommentRepository();
  const session = useQuery(sessionQuery);
  const client = useQueryClient();
  const viewerId = session.data?.user.id;
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState("");
  const panel = useRef<HTMLElement>(null);
  const location = useLocation();
  useEffect(() => {
    if (location.hash === "#event-discussion")
      panel.current?.scrollIntoView?.({ block: "start" });
  }, [location.hash]);
  const options = commentPageQuery(repository, eventId, viewerId, page);
  const query = useQuery({
    ...options,
    enabled: !session.isPending && !session.isError,
  });
  const onPublished = (comment: DiscussionComment) => {
    setNotice("Сообщение опубликовано.");
    void client
      .invalidateQueries({ queryKey: commentKeys.event(eventId) })
      .then(() => {
        if (
          client.getQueryData(sessionQuery.queryKey)?.user.id !==
          comment.author.id
        )
          return;
        const state = client.getQueryState<CommentPage>(options.queryKey);
        if (state?.status === "success" && state.data)
          setPage(
            Math.max(
              0,
              Math.ceil(state.data.totalCount / state.data.pageSize) - 1,
            ),
          );
      });
  };
  return (
    <section
      id="event-discussion"
      ref={panel}
      className="discussion-panel"
      aria-labelledby="discussion-heading"
    >
      <div className="discussion-heading">
        <div>
          <h2 id="discussion-heading">Обсуждение встречи</h2>
          <p className="join-note">
            Уточните условия или помогите другим подготовиться.
          </p>
        </div>
        <button
          className="button secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCw size={18} />
          {query.isFetching ? "Обновляем…" : "Обновить обсуждение"}
        </button>
      </div>
      {query.isPending ? (
        <p role="status">Загружаем обсуждение…</p>
      ) : query.isError ? (
        <ErrorState
          message={commentErrorMessage(query.error)}
          error={query.error}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          <p className="discussion-count">Сообщений: {query.data.totalCount}</p>
          {query.data.comments.length === 0 ? (
            <div className="discussion-empty">
              <MessageCircle size={28} />
              <p>
                {query.data.totalCount === 0
                  ? "Пока нет сообщений. Задайте первый вопрос."
                  : "На этой странице нет сообщений. Вернитесь к предыдущей странице."}
              </p>
            </div>
          ) : (
            <ol className="comment-list" aria-labelledby="discussion-heading">
              {query.data.comments.map((comment) => (
                <li key={comment.id}>
                  <CommentCard
                    comment={comment}
                    organizerUserId={organizerUserId}
                    action={
                      onReport && comment.visibility !== "hidden" ? (
                        <button
                          className="comment-report-button"
                          onClick={() => onReport(comment)}
                          type="button"
                        >
                          Пожаловаться
                        </button>
                      ) : undefined
                    }
                  />
                </li>
              ))}
            </ol>
          )}
          {(query.data.totalCount > query.data.pageSize || page > 0) && (
            <nav className="pagination" aria-label="Страницы обсуждения">
              <button
                className="button secondary"
                disabled={page === 0}
                onClick={() => setPage((value) => value - 1)}
              >
                Назад
              </button>
              <span>
                Страница {page + 1} из{" "}
                {Math.max(
                  1,
                  Math.ceil(query.data.totalCount / query.data.pageSize),
                )}
              </span>
              <button
                className="button secondary"
                disabled={
                  (page + 1) * query.data.pageSize >= query.data.totalCount
                }
                onClick={() => setPage((value) => value + 1)}
              >
                Далее
              </button>
            </nav>
          )}
        </>
      )}
      {notice && (
        <p className="discussion-success success" role="status">
          {notice}
        </p>
      )}
      {!published ? (
        <p className="notice">
          Событие не опубликовано. Новые сообщения недоступны.
        </p>
      ) : session.isPending ? (
        <p role="status">Проверяем аккаунт для отправки…</p>
      ) : session.isError ? (
        <div className="discussion-login" role="alert">
          <p>Не удалось проверить аккаунт для отправки.</p>
          <button
            className="button secondary"
            onClick={() => void session.refetch()}
          >
            Повторить проверку аккаунта
          </button>
        </div>
      ) : viewerId ? (
        <PublishCommentForm
          key={`${eventId}:${viewerId}`}
          eventId={eventId}
          viewerId={viewerId}
          onPublished={onPublished}
        />
      ) : (
        <div className="discussion-login">
          <p>
            Читать обсуждение можно без входа. Чтобы написать, выберите аккаунт.
          </p>
          <Link
            className="button secondary"
            to={`/login?next=event-discussion&eventId=${encodeURIComponent(eventId)}`}
            state={location.state}
          >
            Войти и написать
          </Link>
        </div>
      )}
    </section>
  );
}
