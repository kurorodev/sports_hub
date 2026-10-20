import { AdminListFilters } from "../../../shared/ui/AdminListFilters";
import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
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
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState("");
  const query = useQuery(
    organizationsQuery(repo, { q, page, admin: true, status }, viewerId),
  );
  return (
    <section aria-labelledby="admin-organizations-heading">
      <h2 id="admin-organizations-heading">{tr("Заявки организаций")}</h2>
      <AdminListFilters
        statusLabel={tr("Статус организаций")}
        title={tr("Фильтры организаций")}
        label={tr("Название или описание организации")}
        placeholder={tr("Поиск по названию или описанию")}
        query={q}
        status={status ?? ""}
        options={[
          { value: "", label: tr("Все статусы") },
          { value: "PENDING", label: tr("На рассмотрении") },
          { value: "APPROVED", label: tr("Одобренные") },
          { value: "REJECTED", label: tr("Отклонённые") },
        ]}
        refreshing={query.isFetching}
        onApply={(text, nextStatus) => {
          setQ(text);
          setStatus(
            (nextStatus || undefined) as OrganizationStatus | undefined,
          );
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
