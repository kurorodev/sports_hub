import { Select } from "../../../shared/ui/Select";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  moderationEventsQuery,
  moderationErrorMessage,
  useModerationRepository,
} from "../../../entities/moderation";
import type { EventStatus } from "../../../entities/moderation/model";
import { ErrorState } from "../../../shared/ui/Feedback";
import { ModerationEventCard } from "./ModerationEventCard";
export function AdminEvents({ viewerId }: { viewerId: string }) {
  const repo = useModerationRepository();
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<EventStatus | undefined>("PUBLISHED");
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState("");
  const query = useQuery(
    moderationEventsQuery(repo, viewerId, { q, status, page }),
  );
  return (
    <section aria-labelledby="moderation-events-heading">
      <h2 id="moderation-events-heading">Модерация мероприятий</h2>
      <div className="organization-toolbar">
        <form
          className="organization-search"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(draft.trim());
            setPage(0);
          }}
        >
          <label htmlFor="moderation-search">
            Название или описание мероприятия
          </label>
          <div>
            <input
              id="moderation-search"
              placeholder="Название встречи или ключевое слово"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button className="button secondary" type="submit">
              Найти мероприятия
            </button>
          </div>
        </form>
        <div className="form-field">
          <label htmlFor="moderation-status">Статус мероприятий</label>
          <Select
            id="moderation-status"
            value={status ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              if (
                value === "" ||
                value === "DRAFT" ||
                value === "PUBLISHED" ||
                value === "UNPUBLISHED" ||
                value === "DELETED"
              ) {
                setStatus(value || undefined);
                setPage(0);
              }
            }}
          >
            <option value="PUBLISHED">Опубликованные</option>
            <option value="UNPUBLISHED">Снятые с публикации</option>
            <option value="DRAFT">Черновики</option>
            <option value="DELETED">Удалённые</option>
            <option value="">Все статусы</option>
          </Select>
        </div>
        <button
          className="button secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Обновить мероприятия
        </button>
      </div>
      {notice && (
        <p className="notice success" role="status">
          {notice}
        </p>
      )}
      {query.isPending ? (
        <p role="status">Загружаем мероприятия…</p>
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          message={moderationErrorMessage(query.error)}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          <p className="join-note">
            Найдено мероприятий: {query.data.totalCount}
          </p>
          {query.data.items.length === 0 ? (
            <p className="notice">
              Нет мероприятий по этим условиям. Измените поиск или статус.
            </p>
          ) : (
            <div className="moderation-list">
              {query.data.items.map((event) => (
                <ModerationEventCard
                  key={event.id}
                  event={event}
                  viewerId={viewerId}
                  onDone={() =>
                    setNotice(
                      `«${event.title}»: снято с публикации. Решение сохранено.`,
                    )
                  }
                />
              ))}
            </div>
          )}
          {(query.data.totalCount > query.data.pageSize || page > 0) && (
            <nav
              className="pagination"
              aria-label="Страницы модерации мероприятий"
            >
              <button
                className="button secondary"
                disabled={page === 0}
                onClick={() => setPage((value) => value - 1)}
              >
                Назад
              </button>
              <span>Страница {page + 1}</span>
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
    </section>
  );
}
