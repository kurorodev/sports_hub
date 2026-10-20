import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { Select } from "../../../shared/ui/Select";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  organizationsQuery,
  organizationKeys,
  organizationErrorMessage,
  useOrganizationRepository,
} from "../../../entities/organization";
import type { OrganizationStatus } from "../../../entities/organization/model";
import { ErrorState } from "../../../shared/ui/Feedback";
import { OrganizationDecisionCard } from "./OrganizationDecisionCard";
export function AdminOrganizations({ viewerId }: { viewerId: string }) {
  useLocale();
  const repo = useOrganizationRepository();
  const client = useQueryClient();
  const [status, setStatus] = useState<OrganizationStatus | undefined>(
    "PENDING",
  );
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState("");
  const query = useQuery(
    organizationsQuery(repo, { q, page, admin: true, status }, viewerId),
  );
  return (
    <section aria-labelledby="admin-organizations-heading">
      <h2 id="admin-organizations-heading">{tr("Заявки организаций")}</h2>
      <div className="organization-toolbar">
        <form
          className="organization-search"
          onSubmit={(event) => {
            event.preventDefault();
            setQ(draft.trim());
            setPage(0);
          }}
        >
          <label htmlFor="admin-organization-search">
            {tr("Название или описание организации")}
          </label>
          <div>
            <input
              id="admin-organization-search"
              placeholder={tr("Например, беговой клуб")}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button className="button secondary" type="submit">
              {tr("Найти организации")}
            </button>
          </div>
        </form>
        <div className="form-field">
          <label htmlFor="organization-status">
            {tr("Статус организаций")}
          </label>
          <Select
            id="organization-status"
            value={status ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              if (
                value === "" ||
                value === "PENDING" ||
                value === "APPROVED" ||
                value === "REJECTED"
              ) {
                setStatus(value || undefined);
                setPage(0);
              }
            }}
          >
            <option value="PENDING">{tr("На рассмотрении")}</option>
            <option value="APPROVED">{tr("Одобренные")}</option>
            <option value="REJECTED">{tr("Отклонённые")}</option>
            <option value="">{tr("Все статусы")}</option>
          </Select>
        </div>
        <button
          className="button secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {tr("Обновить заявки организаций")}
        </button>
      </div>
      {notice && (
        <p className="notice success" role="status">
          {tr(notice)}
        </p>
      )}
      {query.isPending ? (
        <p role="status">{tr("Загружаем заявки организаций…")}</p>
      ) : query.isError ? (
        <ErrorState
          message={tr(organizationErrorMessage(query.error))}
          error={query.error}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          <p className="join-note">
            {tr("Найдено организаций: ")}
            {query.data.totalCount}
          </p>
          {query.data.organizations.length === 0 ? (
            <p className="notice">
              {tr(
                "Нет организаций по этим условиям. Измените поиск или статус.",
              )}
            </p>
          ) : (
            <div className="organization-list">
              {query.data.organizations.map((organization) => (
                <OrganizationDecisionCard
                  key={organization.id}
                  organization={organization}
                  viewerId={viewerId}
                  onDecided={(result) => {
                    setNotice(tr("«{0}»: решение сохранено.", [result.name]));
                    void client.invalidateQueries({
                      queryKey: organizationKeys.all,
                    });
                  }}
                />
              ))}
            </div>
          )}
          {(query.data.totalCount > query.data.pageSize || page > 0) && (
            <nav
              className="pagination"
              aria-label={tr("Страницы заявок организаций")}
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
