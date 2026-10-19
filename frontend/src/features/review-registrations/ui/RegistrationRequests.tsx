import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { sessionQuery } from "../../../entities/session";
import {
  registrationKeys,
  registrationErrorMessage,
  registrationPresentation,
  useRegistrationRepository,
} from "../../../entities/registration";
import {
  RegistrationFailure,
  type Registration,
} from "../../../entities/registration/model";
import { ErrorState } from "../../../shared/ui/Feedback";
import { RequestRow } from "./RequestRow";
export function RegistrationRequests({
  eventId,
  decisionsOpen,
}: {
  eventId: string;
  decisionsOpen: boolean;
}) {
  const repository = useRegistrationRepository();
  const session = useQuery(sessionQuery);
  const viewerId = session.data?.user.id;
  const [status, setStatus] = useState<Registration["status"] | "">("PENDING");
  const [page, setPage] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const query = useQuery({
    queryKey: [
      ...registrationKeys.event(eventId),
      "requests",
      viewerId,
      status,
      page,
    ],
    enabled: Boolean(viewerId),
    retry: false,
    staleTime: 0,
    refetchInterval: 10000,
    queryFn: async ({ signal }) => {
      const result = await repository.listRequests(
        eventId,
        page,
        status || undefined,
        signal,
      );
      if (
        result.registrations.some(
          (item) =>
            item.eventId !== eventId || (status && item.status !== status),
        )
      )
        throw new RegistrationFailure("invalid-response");
      return result;
    },
  });
  const onDecided = (registration: Registration) =>
    setAnnouncement(
      `${registration.participant.displayName}: ${registrationPresentation[registration.status].organizerLabel.toLocaleLowerCase("ru")}. Решение сохранено.`,
    );
  return (
    <section
      id="event-requests"
      className="requests-panel"
      aria-labelledby="requests-heading"
    >
      <div className="participants-heading">
        <h2 id="requests-heading">Заявки на участие</h2>
        {query.data && <span>Заявок: {query.data.totalCount}</span>}
      </div>
      <p className="join-note">
        Ожидающие заявки не занимают места. Участник появится в составе после
        одобрения.
      </p>
      <div className="request-toolbar">
        <label>
          Статус заявок
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as Registration["status"] | "");
              setPage(0);
              setAnnouncement("");
            }}
          >
            <option value="PENDING">Ожидают решения</option>
            <option value="CONFIRMED">Одобренные</option>
            <option value="REJECTED">Отклонённые</option>
            <option value="">Все заявки</option>
          </select>
        </label>
        <button
          className="button secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCw size={18} />
          {query.isFetching ? "Обновляем…" : "Обновить заявки"}
        </button>
      </div>
      {announcement && (
        <p className="request-success success" role="status">
          {announcement}
        </p>
      )}
      {!decisionsOpen && (
        <p className="join-note">
          Событие не опубликовано. Рассмотрение заявок закрыто.
        </p>
      )}
      {session.isError ? (
        <ErrorState
          error={session.error}
          retry={() => void session.refetch()}
        />
      ) : !session.isPending && !viewerId ? (
        <p className="join-note">
          Войдите в аккаунт организатора, чтобы рассмотреть заявки.
        </p>
      ) : query.isPending ? (
        <p role="status">Загружаем заявки…</p>
      ) : query.isError ? (
        <ErrorState
          message={registrationErrorMessage(query.error)}
          error={query.error}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          {query.data.registrations.length === 0 ? (
            <p className="requests-empty">
              {query.data.totalCount > 0
                ? "На этой странице больше нет заявок. Вернитесь на предыдущую."
                : status === "PENDING"
                  ? "Нет заявок, ожидающих решения."
                  : "Заявок с таким статусом пока нет."}
            </p>
          ) : (
            <ul className="requests-list" aria-labelledby="requests-heading">
              {query.data.registrations.map((registration) => (
                <RequestRow
                  key={registration.id}
                  registration={registration}
                  viewerId={viewerId!}
                  decisionsOpen={decisionsOpen}
                  onDecided={onDecided}
                />
              ))}
            </ul>
          )}
          {(query.data.totalCount > query.data.pageSize || page > 0) && (
            <nav className="pagination" aria-label="Страницы заявок">
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
    </section>
  );
}
