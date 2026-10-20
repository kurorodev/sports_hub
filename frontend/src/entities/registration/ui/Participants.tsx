import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { Link } from "react-router-dom";
import { useRegistrationRepository } from "../lib/use-registration-repository";
import { registrationErrorMessage } from "./presentation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { participantsQuery } from "../api/queries";
import { ErrorState } from "../../../shared/ui/Feedback";
import { Avatar } from "../../../shared/ui/Avatar";

export function Participants({ eventId }: { eventId: string }) {
  useLocale();
  const repository = useRegistrationRepository();
  const [page, setPage] = useState(0);
  const query = useQuery(participantsQuery(repository, eventId, page));
  return (
    <section
      className="participants-panel"
      aria-labelledby="participants-heading"
    >
      <div className="participants-heading">
        <h2 id="participants-heading">{tr("Кто идёт")}</h2>
        {query.data && (
          <span>
            {tr("Участников: ")}
            {query.data.totalCount}
          </span>
        )}
      </div>
      {query.isPending ? (
        <p className="join-note" role="status">
          {tr("Загружаем участников…")}
        </p>
      ) : query.isError ? (
        <ErrorState
          message={tr(registrationErrorMessage(query.error))}
          error={query.error}
          retry={() => void query.refetch()}
        />
      ) : query.data.totalCount === 0 ? (
        <div className="participants-empty">
          <Users size={28} />
          <p>{tr("Пока никто не записался.")}</p>
          <span>{tr("Компания только собирается.")}</span>
        </div>
      ) : (
        <>
          <ul
            className="participants-list"
            aria-labelledby="participants-heading"
          >
            {query.data.participants.map((participant) => (
              <li key={participant.id}>
                <Avatar
                  id={participant.id}
                  name={participant.displayName}
                  url={participant.avatarUrl}
                />
                <Link className="person-link" to={`/users/${participant.id}`}>
                  {participant.displayName}
                </Link>
              </li>
            ))}
          </ul>
          {(query.data.totalCount > query.data.pageSize || page > 0) && (
            <nav className="pagination" aria-label={tr("Страницы участников")}>
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
