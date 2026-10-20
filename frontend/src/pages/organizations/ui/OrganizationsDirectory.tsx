import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
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
  useLocale();
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
        <h2 id="organization-directory-heading">
          {tr("Найдите свою команду")}
        </h2>
        <p>{tr("Клубы и сообщества с допуском к публикации встреч.")}</p>
      </div>
      <form
        className="organization-search"
        onSubmit={(event) => {
          event.preventDefault();
          change(draft.trim(), 0);
        }}
      >
        <label htmlFor="organization-search">
          {tr("Название или описание организации")}
        </label>
        <div>
          <input
            id="organization-search"
            placeholder={tr("Например, беговой клуб")}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button className="button secondary" type="submit">
            {tr("Найти организации")}
          </button>
        </div>
      </form>
      {query.isPending ? (
        <p className="page-state" role="status">
          {tr("Загружаем организации…")}
        </p>
      ) : query.isError ? (
        <ErrorState
          message={tr(organizationErrorMessage(query.error))}
          error={query.error}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          <p className="organization-count">
            {tr("Найдено организаций: ")}
            {query.data.totalCount}
          </p>
          {query.data.organizations.length === 0 ? (
            <div className="notice">
              <p>{tr("Организаций по этим условиям пока нет.")}</p>
              {q && (
                <button
                  className="button secondary"
                  onClick={() => {
                    setDraft("");
                    change("", 0);
                  }}
                >
                  {tr("Сбросить поиск организаций")}
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
            <nav className="pagination" aria-label={tr("Страницы организаций")}>
              <button
                className="button secondary"
                disabled={page === 0}
                onClick={() => change(q, page - 1)}
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
                onClick={() => change(q, page + 1)}
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
