import { useState } from "react";
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
export function AdminComments({ viewerId }: { viewerId: string }) {
  const repo = useModerationRepository();
  const [params, setParams] = useSearchParams();
  const eventId = params.get("eventId") ?? "";
  const page = Math.max(0, Math.floor(Number(params.get("page")) || 0));
  const valid = !eventId || isUuid(eventId);
  const [draft, setDraft] = useState(eventId);
  const [notice, setNotice] = useState("");
  const query = useQuery({
    ...moderationCommentsQuery(repo, viewerId, {
      eventId: eventId || undefined,
      page,
    }),
    enabled: valid,
  });
  function filter(id: string, nextPage: number) {
    const next = new URLSearchParams({ section: "comments" });
    if (id) next.set("eventId", id);
    if (nextPage) next.set("page", String(nextPage));
    setParams(next);
  }
  return (
    <section aria-labelledby="moderation-comments-heading">
      <h2 id="moderation-comments-heading">Модерация комментариев</h2>
      <p className="join-note">
        Ищите обсуждение через «Комментарии мероприятия» в разделе мероприятий
        или укажите его ID.
      </p>
      <div className="organization-toolbar">
        <form
          className="organization-search"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            filter(draft.trim(), 0);
          }}
        >
          <label htmlFor="moderation-event-id">
            ID мероприятия (необязательно)
          </label>
          <div>
            <input
              id="moderation-event-id"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-invalid={!valid}
              aria-describedby={
                !valid ? "moderation-event-id-error" : undefined
              }
            />
            <button className="button secondary" type="submit">
              Показать комментарии
            </button>
          </div>
        </form>
        <button
          className="button secondary"
          disabled={query.isFetching || !valid}
          onClick={() => void query.refetch()}
        >
          Обновить комментарии
        </button>
      </div>
      {!valid ? (
        <p id="moderation-event-id-error" role="alert" className="field-error">
          Укажите корректный UUID мероприятия или оставьте поле пустым.
        </p>
      ) : query.isPending ? (
        <p role="status">Загружаем комментарии…</p>
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          message={moderationErrorMessage(query.error)}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          <p className="join-note">
            Найдено комментариев: {query.data.totalCount}
          </p>
          {query.data.items.length === 0 ? (
            <p className="notice">
              На этой странице нет комментариев. Измените фильтр или страницу.
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
                      "Комментарий скрыт. Остальные сообщения сохранены.",
                    )
                  }
                />
              ))}
            </div>
          )}
          {(query.data.totalCount > query.data.pageSize || page > 0) && (
            <nav
              className="pagination"
              aria-label="Страницы модерации комментариев"
            >
              <button
                className="button secondary"
                disabled={page === 0}
                onClick={() => filter(eventId, page - 1)}
              >
                Назад
              </button>
              <span>Страница {page + 1}</span>
              <button
                className="button secondary"
                disabled={
                  (page + 1) * query.data.pageSize >= query.data.totalCount
                }
                onClick={() => filter(eventId, page + 1)}
              >
                Далее
              </button>
            </nav>
          )}
        </>
      )}
      {notice && (
        <p className="notice success" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
