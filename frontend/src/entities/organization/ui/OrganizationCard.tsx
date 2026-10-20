import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import type { Organization } from "../model";
import { organizationStatuses } from "./presentation";
export function OrganizationCard({
  organization,
  children,
  showTitle = true,
}: {
  organization: Organization;
  children?: ReactNode;
  showTitle?: boolean;
}) {
  useLocale();
  const status = organizationStatuses[organization.status];
  return (
    <article
      className="organization-card"
      aria-label={tr("Организация: {0}", [organization.name])}
    >
      {showTitle && (
        <div className="organization-title">
          <Building2 size={24} />
          <h2>
            <Link to={`/organizations/${organization.id}`}>
              {organization.name}
            </Link>
          </h2>
        </div>
      )}
      <span className={`card-registration ${status.tone}`}>
        {tr(status.label)}
      </span>
      <p className="organization-description">{organization.description}</p>
      {organization.sports.length > 0 && (
        <p className="join-note">
          {organization.sports.map((sport) => sport.name).join(" · ")}
        </p>
      )}
      <p className="join-note">
        {tr("Представитель: ")}
        {organization.representative.displayName}
      </p>
      {organization.decisionReason && (
        <p className="organization-reason">
          <strong>{tr("Причина решения: ")}</strong>
          {organization.decisionReason}
        </p>
      )}
      {children}
    </article>
  );
}
