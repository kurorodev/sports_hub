import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { Select } from "../../../shared/ui/Select";
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
  useLocale();
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
      tr("{0}: {1}. Решение сохранено.", [
        registration.participant.displayName,
        tr(
          registrationPresentation[registration.status].organizerLabel,
        ).toLocaleLowerCase(),
      ]),
    );
  return (
    <section
      id="event-requests"
      className="requests-panel"
      aria-labelledby="requests-heading"
    >
      <div className="participants-heading">
        <h2 id="requests-heading">{tr("Заявки на участие")}</h2>
        {query.data && (
          <span>
            {tr("Заявок: ")}
            {query.data.totalCount}
          </span>
        )}
      </div>
      <p className="join-note">
        {tr(
          "Ожидающие заявки не занимают места. Участник появится в составе после одобрения.",
        )}
      </p>
      <div className="request-toolbar">
        <label>
          {tr("Статус заявок")}
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as Registration["status"] | "");
              setPage(0);
              setAnnouncement("");
            }}
          >
            <option value="PENDING">{tr("Ожидают решения")}</option>
            <option value="CONFIRMED">{tr("Одобренные")}</option>
            <option value="REJECTED">{tr("Отклонённые")}</option>
            <option value="">{tr("Все заявки")}</option>
          </Select>
        </label>
        <button
          className="button secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCw size={18} />
          {query.isFetching ? tr("Обновляем…") : tr("Обновить заявки")}
        </button>
      </div>
      {announcement && (
        <p className="request-success success" role="status">
          {announcement}
        </p>
      )}
      {!decisionsOpen && (
        <p className="join-note">
          {tr("Событие не опубликовано. Рассмотрение заявок закрыто.")}
        </p>
      )}
      {session.isError ? (
        <ErrorState
          error={session.error}
          retry={() => void session.refetch()}
        />
      ) : !session.isPending && !viewerId ? (
        <p className="join-note">
          {tr("Войдите в аккаунт организатора, чтобы рассмотреть заявки.")}
        </p>
      ) : query.isPending ? (
        <p role="status">{tr("Загружаем заявки…")}</p>
      ) : query.isError ? (
        <ErrorState
          message={tr(registrationErrorMessage(query.error))}
          error={query.error}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          {query.data.registrations.length === 0 ? (
            <p className="requests-empty">
              {query.data.totalCount > 0
                ? tr(
                    "На этой странице больше нет заявок. Вернитесь на предыдущую.",
                  )
                : status === "PENDING"
                  ? tr("Нет заявок, ожидающих решения.")
                  : tr("Заявок с таким статусом пока нет.")}
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
            <nav className="pagination" aria-label={tr("Страницы заявок")}>
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
                {tr(" из")}{" "}
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
                {tr("Далее")}
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
