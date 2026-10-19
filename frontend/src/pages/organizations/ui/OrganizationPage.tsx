import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { sessionQuery } from "../../../entities/session";
import {
  OrganizationCard,
  organizationQuery,
  useOrganizationRepository,
  organizationErrorMessage,
} from "../../../entities/organization";
import { OrganizationFailure } from "../../../entities/organization/model";
import { EventCard, organizationEventsQuery } from "../../../entities/event";
import { registrationPresentation } from "../../../entities/registration";
import { ErrorState, NotFound, Skeletons } from "../../../shared/ui/Feedback";
import { isUuid } from "../../../shared/lib/identifiers";
export function OrganizationPage() {
  const { organizationId = "" } = useParams();
  const repo = useOrganizationRepository();
  const session = useQuery(sessionQuery);
  const [page, setPage] = useState(0);
  const viewerKnown = !session.isPending && !session.isError;
  const query = useQuery({
    ...organizationQuery(repo, organizationId, session.data?.user.id),
    enabled: isUuid(organizationId) && viewerKnown,
  });
  const events = useQuery({
    ...organizationEventsQuery(organizationId, page, session.data?.user.id),
    enabled: isUuid(organizationId) && viewerKnown && query.isSuccess,
  });
  if (!isUuid(organizationId)) return <NotFound />;
  if (session.isPending)
    return (
      <p className="page-state" role="status">
        Проверяем сессию для страницы организации…
      </p>
    );
  if (session.isError)
    return (
      <ErrorState error={session.error} retry={() => void session.refetch()} />
    );
  if (query.isPending)
    return (
      <p role="status" className="page-state">
        Загружаем организацию…
      </p>
    );
  if (query.isError)
    return query.error instanceof OrganizationFailure &&
      query.error.code === "not-found" ? (
      <NotFound />
    ) : (
      <ErrorState
        error={query.error}
        message={organizationErrorMessage(query.error)}
        retry={() => void query.refetch()}
      />
    );
  const organization = query.data;
  return (
    <section className="workspace-page organization-profile">
      <Link className="back-link" to="/organizations">
        Все организации
      </Link>
      <h1>{organization.name}</h1>
      <OrganizationCard organization={organization} showTitle={false}>
        {session.data?.manageableOrganizationIds.includes(organization.id) && (
          <Link
            className="button primary"
            to={`/events/new?organizationId=${organization.id}`}
          >
            Создать встречу от организации
          </Link>
        )}
      </OrganizationCard>
      <h2 className="organization-events-title">Встречи организации</h2>
      {events.isPending ? (
        <Skeletons />
      ) : events.isError ? (
        <ErrorState error={events.error} retry={() => void events.refetch()} />
      ) : (
        <>
          {events.data.items.length === 0 ? (
            <p className="notice">
              Пока нет доступных встреч этой организации.
            </p>
          ) : (
            <div className="event-grid">
              {events.data.items.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  participation={
                    event.viewerRegistrationStatus
                      ? registrationPresentation[event.viewerRegistrationStatus]
                      : undefined
                  }
                />
              ))}
            </div>
          )}
          {(events.data.total > events.data.size || page > 0) && (
            <nav
              className="pagination"
              aria-label="Страницы встреч организации"
            >
              <button
                className="button secondary"
                disabled={page === 0}
                onClick={() => setPage((value) => value - 1)}
              >
                Назад
              </button>
              <span>Страница {page + 1}</span>
              <button
                className="button secondary"
                disabled={(page + 1) * events.data.size >= events.data.total}
                onClick={() => setPage((value) => value + 1)}
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
