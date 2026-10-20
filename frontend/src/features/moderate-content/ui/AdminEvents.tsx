import { AdminListFilters } from "../../../shared/ui/AdminListFilters";
import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
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
  useLocale();
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
      <h2 id="moderation-events-heading">{tr("Модерация мероприятий")}</h2>
      <AdminListFilters
        statusLabel={tr("Статус мероприятий")}
        title={tr("Фильтры мероприятий")}
        label={tr("Название или описание мероприятия")}
        placeholder={tr("Поиск по названию или описанию")}
        query={q}
        status={status ?? ""}
        options={[
          { value: "", label: tr("Все статусы") },
          { value: "PUBLISHED", label: tr("Опубликованные") },
          { value: "UNPUBLISHED", label: tr("Снятые с публикации") },
          { value: "DRAFT", label: tr("Черновики") },
          { value: "DELETED", label: tr("Удалённые") },
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
          {tr(notice)}
        </p>
      )}
      {query.isPending ? (
        <p role="status">{tr("Загружаем мероприятия…")}</p>
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          message={tr(moderationErrorMessage(query.error))}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          <p className="join-note">
            {tr("Найдено мероприятий: ")}
            {query.data.totalCount}
          </p>
          {query.data.items.length === 0 ? (
            <p className="notice">
              {tr(
                "Нет мероприятий по этим условиям. Измените поиск или статус.",
              )}
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
                      tr("«{0}»: снято с публикации. Решение сохранено.", [
                        event.title,
                      ]),
                    )
                  }
                />
              ))}
            </div>
          )}
          {(query.data.totalCount > query.data.pageSize || page > 0) && (
            <nav
              className="pagination"
              aria-label={tr("Страницы модерации мероприятий")}
            >
              <button
                className="button secondary"
                disabled={page === 0}
                onClick={() => setPage((value) => value - 1)}
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
                onClick={() => setPage((value) => value + 1)}
              >
                {tr("Далее")}
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
