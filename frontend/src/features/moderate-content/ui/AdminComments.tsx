import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  moderationCommentsQuery,
  moderationErrorMessage,
  useModerationRepository,
} from "../../../entities/moderation";
import { ErrorState } from "../../../shared/ui/Feedback";
import { isUuid } from "../../../shared/lib/identifiers";
import { ModerationCommentCard } from "./ModerationCommentCard";
import { AdminCommentFilters } from "./AdminCommentFilters";
export function AdminComments({ viewerId }: { viewerId: string }) {
  useLocale();
  const repo = useModerationRepository();
  const [params, setParams] = useSearchParams();
  const currentParams = useRef(params);
  useEffect(() => {
    currentParams.current = params;
  }, [params]);
  const eventId = params.get("eventId") ?? "";
  const authorId = params.get("authorId") ?? "";
  const latest = params.get("latest") === "true";
  const last24Hours = params.get("last24Hours") === "true";
  const page = latest
    ? 0
    : Math.max(0, Math.floor(Number(params.get("page")) || 0));
  const valid =
    (!eventId || isUuid(eventId)) && (!authorId || isUuid(authorId));
  const [notice, setNotice] = useState("");
  const query = useQuery({
    ...moderationCommentsQuery(repo, viewerId, {
      eventId: eventId || undefined,
      authorId: authorId || undefined,
      latest,
      last24Hours,
      page,
    }),
    enabled: valid,
  });
  function filter(changes: Record<string, string>, nextPage = 0) {
    const next = new URLSearchParams(currentParams.current);
    next.set("section", "comments");
    next.delete("page");
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (nextPage) next.set("page", String(nextPage));
    currentParams.current = next;
    setNotice("");
    setParams(next, { preventScrollReset: true });
  }
  return (
    <section aria-labelledby="moderation-comments-heading">
      <h2 id="moderation-comments-heading">{tr("Модерация комментариев")}</h2>
      <p className="join-note">
        {tr(
          "Выберите пользователя и/или мероприятие. Ограничения по количеству и времени применяются к выбранным условиям, без выбора — ко всем комментариям.",
        )}
      </p>
      <AdminCommentFilters
        key={JSON.stringify([eventId, authorId, latest, last24Hours])}
        viewerId={viewerId}
        eventId={eventId}
        authorId={authorId}
        latest={latest}
        last24Hours={last24Hours}
        onChange={filter}
        onRefresh={() => void query.refetch()}
        refreshing={query.isFetching}
      />
      {!valid ? (
        <p id="moderation-event-id-error" role="alert" className="field-error">
          {tr(
            "Укажите корректный UUID мероприятия и пользователя в ссылке или сбросьте фильтры.",
          )}
        </p>
      ) : query.isPending ? (
        <p role="status">{tr("Загружаем комментарии…")}</p>
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          message={tr(moderationErrorMessage(query.error))}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          <p className="comment-results-count" aria-live="polite">
            {tr("Найдено комментариев: ")}
            {query.data.totalCount}
          </p>
          {query.data.items.length === 0 ? (
            <p className="notice">
              {tr(
                "На этой странице нет комментариев. Измените фильтр или страницу.",
              )}
            </p>
          ) : (
            <div className="moderation-list">
              {query.data.items.map((comment) => (
                <ModerationCommentCard
                  key={comment.id}
                  comment={comment}
                  viewerId={viewerId}
                  onDone={() =>
                    setNotice(
                      tr("Комментарий скрыт. Остальные сообщения сохранены."),
                    )
                  }
                />
              ))}
            </div>
          )}
          {!latest &&
            (query.data.totalCount > query.data.pageSize || page > 0) && (
              <nav
                className="pagination"
                aria-label={tr("Страницы модерации комментариев")}
              >
                <button
                  className="button secondary"
                  disabled={page === 0}
                  onClick={() => filter({}, page - 1)}
                >
                  {tr("Назад")}
                </button>
                <span>
                  {tr("Страница ")}
                  {page + 1}
                </span>
                <button
                  className="button secondary"
                  disabled={
                    (page + 1) * query.data.pageSize >= query.data.totalCount
                  }
                  onClick={() => filter({}, page + 1)}
                >
                  {tr("Далее")}
                </button>
              </nav>
            )}
        </>
      )}
      {notice && (
        <p className="notice success" role="status">
          {tr(notice)}
        </p>
      )}
    </section>
  );
}
