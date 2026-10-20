import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  myOrganizationsQuery,
  OrganizationCard,
  organizationErrorMessage,
  useOrganizationRepository,
} from "../../../entities/organization";
import { sessionQuery } from "../../../entities/session";
import { ErrorState } from "../../../shared/ui/Feedback";
export function MyOrganizations({ viewerId }: { viewerId: string }) {
  useLocale();
  const repo = useOrganizationRepository();
  const client = useQueryClient();
  const session = useQuery(sessionQuery);
  const query = useQuery(myOrganizationsQuery(repo, viewerId));
  const approved = query.data
    ?.filter((item) => item.status === "APPROVED")
    .map((item) => item.id)
    .sort()
    .join(",");
  const available = session.data?.manageableOrganizationIds
    .slice()
    .sort()
    .join(",");
  useEffect(() => {
    if (approved !== undefined && approved !== available)
      void client.invalidateQueries({ queryKey: sessionQuery.queryKey });
  }, [approved, available, client]);
  return (
    <>
      <div className="organization-toolbar">
        <h2>{tr("Мои организации")}</h2>
        <button
          className="button secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {tr("Обновить мои организации")}
        </button>
      </div>
      {query.isPending ? (
        <p role="status">{tr("Загружаем ваши заявки…")}</p>
      ) : query.isError ? (
        <ErrorState
          message={tr(organizationErrorMessage(query.error))}
          error={query.error}
          retry={() => void query.refetch()}
        />
      ) : query.data.length === 0 ? (
        <p className="notice">
          {tr(
            "У вас пока нет организаций. Нажмите «Добавить организацию», чтобы подать первую заявку.",
          )}
        </p>
      ) : (
        <div className="organization-list">
          {query.data.map((organization) => (
            <OrganizationCard key={organization.id} organization={organization}>
              {organization.status === "APPROVED" ? (
                <Link
                  className="button primary"
                  to={`/events/new?organizationId=${organization.id}`}
                >
                  {tr("Создать встречу от организации")}
                </Link>
              ) : (
                <p className="join-note">
                  {tr("Публикация от организации недоступна")}{" "}
                  {organization.status === "PENDING"
                    ? tr("до одобрения заявки")
                    : tr("после отказа")}
                  .
                </p>
              )}
            </OrganizationCard>
          ))}
        </div>
      )}
    </>
  );
}
