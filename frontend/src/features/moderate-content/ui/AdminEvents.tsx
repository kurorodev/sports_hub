import { AdminListFilters } from "../../../shared/ui/AdminListFilters";
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
      <AdminListFilters
        statusLabel="Статус мероприятий"
        title="Фильтры мероприятий"
        label="Название или описание мероприятия"
        placeholder="Поиск по названию или описанию"
        query={q}
        status={status ?? ""}
        options={[
          { value: "", label: "Все статусы" },
          { value: "PUBLISHED", label: "Опубликованные" },
          { value: "UNPUBLISHED", label: "Снятые с публикации" },
          { value: "DRAFT", label: "Черновики" },
          { value: "DELETED", label: "Удалённые" },
        ]}
        refreshing={query.isFetching}
        onApply={(text, nextStatus) => {
          setQ(text);
          setStatus((nextStatus || undefined) as EventStatus | undefined);
          setPage(0);
        }}
        onRefresh={() => void query.refetch()}
      />
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
