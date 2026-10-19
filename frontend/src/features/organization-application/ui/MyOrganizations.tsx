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
        <h2>Мои организации</h2>
        <button
          className="button secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Обновить мои организации
        </button>
      </div>
      {query.isPending ? (
        <p role="status">Загружаем ваши заявки…</p>
      ) : query.isError ? (
        <ErrorState
          message={organizationErrorMessage(query.error)}
          error={query.error}
          retry={() => void query.refetch()}
        />
      ) : query.data.length === 0 ? (
        <p className="notice">
          У вас пока нет организаций. Нажмите «Добавить организацию», чтобы
          подать первую заявку.
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
                  Создать встречу от организации
                </Link>
              ) : (
                <p className="join-note">
                  Публикация от организации недоступна{" "}
                  {organization.status === "PENDING"
                    ? "до одобрения заявки"
                    : "после отказа"}
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
