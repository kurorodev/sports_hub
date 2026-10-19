import { useQuery, useQueryClient } from "@tanstack/react-query";
import { sportsQuery } from "../../../entities/event";
import { organizationKeys } from "../../../entities/organization";
import type { Organization } from "../../../entities/organization/model";
import { OrganizationApplicationForm } from "../../../features/organization-application";
import { ErrorState } from "../../../shared/ui/Feedback";

export function OrganizationApplication({
  viewerId,
  onCreated,
}: {
  viewerId: string;
  onCreated: (organization: Organization) => void;
}) {
  const sports = useQuery(sportsQuery);
  const client = useQueryClient();
  if (sports.isPending) return <p role="status">Загружаем виды спорта…</p>;
  if (sports.isError)
    return (
      <ErrorState error={sports.error} retry={() => void sports.refetch()} />
    );
  return (
    <OrganizationApplicationForm
      viewerId={viewerId}
      sports={sports.data}
      onCreated={(organization) => {
        void client.invalidateQueries({ queryKey: organizationKeys.all });
        onCreated(organization);
      }}
    />
  );
}
