import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { sessionQuery } from "../../../entities/session";
import {
  OrganizationCard,
  organizationsQuery,
  organizationErrorMessage,
  useOrganizationRepository,
} from "../../../entities/organization";
import { ErrorState } from "../../../shared/ui/Feedback";
export function OrganizationsDirectory() {
  const repo = useOrganizationRepository();
  const session = useQuery(sessionQuery);
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const page = Math.max(0, Math.floor(Number(params.get("page")) || 0));
  const [draft, setDraft] = useState(q);
  const query = useQuery({
    ...organizationsQuery(repo, { q, page }, session.data?.user.id),
    enabled: !session.isPending && !session.isError,
  });
  function change(nextQ: string, nextPage: number) {
    const next = new URLSearchParams(params);
    next.delete("q");
    next.delete("page");
    if (nextQ) next.set("q", nextQ);
    if (nextPage) next.set("page", String(nextPage));
    setParams(next);
  }
  return (
    <section
      className="organization-directory"
      aria-labelledby="organization-directory-heading"
    >
      <div className="organization-section-heading">
        <h2 id="organization-directory-heading">Найдите свою команду</h2>
        <p>Клубы и сообщества с допуском к публикации встреч.</p>
      </div>
      <form
        className="organization-search"
        onSubmit={(event) => {
          event.preventDefault();
          change(draft.trim(), 0);
        }}
      >
        <label htmlFor="organization-search">
          Название или описание организации
        </label>
        <div>
          <input
            id="organization-search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button className="button secondary" type="submit">
            Найти организации
          </button>
        </div>
      </form>
      {query.isPending ? (
        <p className="page-state" role="status">
          Загружаем организации…
        </p>
      ) : query.isError ? (
        <ErrorState
          message={organizationErrorMessage(query.error)}
          error={query.error}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          <p className="organization-count">
            Найдено организаций: {query.data.totalCount}
          </p>
          {query.data.organizations.length === 0 ? (
            <div className="notice">
              <p>Организаций по этим условиям пока нет.</p>
              {q && (
                <button
                  className="button secondary"
                  onClick={() => {
                    setDraft("");
                    change("", 0);
                  }}
                >
                  Сбросить поиск организаций
                </button>
              )}
            </div>
          ) : (
            <div className="organization-list">
              {query.data.organizations.map((organization) => (
                <OrganizationCard
                  key={organization.id}
                  organization={organization}
                />
              ))}
            </div>
          )}
          {(query.data.totalCount > query.data.pageSize || page > 0) && (
            <nav className="pagination" aria-label="Страницы организаций">
              <button
                className="button secondary"
                disabled={page === 0}
                onClick={() => change(q, page - 1)}
              >
                Назад
              </button>
              <span>Страница {page + 1}</span>
              <button
                className="button secondary"
                disabled={
                  (page + 1) * query.data.pageSize >= query.data.totalCount
                }
                onClick={() => change(q, page + 1)}
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
