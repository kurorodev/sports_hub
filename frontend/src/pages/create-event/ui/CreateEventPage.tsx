import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  myOrganizationsQuery,
  useOrganizationRepository,
  organizationErrorMessage,
} from "../../../entities/organization";
import { Link } from "react-router-dom";
import { CalendarPlus } from "lucide-react";
import { sessionQuery } from "../../../entities/session";
import { sportsQuery } from "../../../entities/event";
import { ErrorState } from "../../../shared/ui/Feedback";
import { CreateEventForm } from "../../../features/create-event";

export function CreateEventPage() {
  useLocale();
  const session = useQuery(sessionQuery);
  const sports = useQuery(sportsQuery);
  const [params] = useSearchParams();
  const initialOrganizationId = params.get("organizationId") ?? undefined;
  const repo = useOrganizationRepository();
  const needOrganizations = Boolean(
    session.data?.manageableOrganizationIds.length || initialOrganizationId,
  );
  const organizations = useQuery({
    ...myOrganizationsQuery(repo, session.data?.user.id ?? ""),
    enabled: Boolean(session.data) && needOrganizations,
  });
  if (session.isPending)
    return (
      <p className="page-state" role="status">
        {tr("Восстанавливаем сессию…")}
      </p>
    );
  if (session.isError)
    return (
      <ErrorState error={session.error} retry={() => void session.refetch()} />
    );
  if (!session.data)
    return (
      <section className="feedback page-state">
        <CalendarPlus size={36} />
        <h1>{tr("Собери свою компанию")}</h1>
        <p>{tr("Войди в аккаунт, чтобы создать спортивную встречу.")}</p>
        <Link className="button primary" to="/login?next=create-event">
          {tr("Войти и создать")}
        </Link>
      </section>
    );
  if (sports.isPending)
    return (
      <p className="page-state" role="status">
        {tr("Загружаем виды спорта…")}
      </p>
    );
  if (sports.isError)
    return (
      <ErrorState error={sports.error} retry={() => void sports.refetch()} />
    );
  if (needOrganizations && organizations.isPending)
    return (
      <p role="status" className="page-state">
        {tr("Проверяем организации для публикации…")}
      </p>
    );
  if (needOrganizations && organizations.isError && !organizations.data)
    return (
      <ErrorState
        error={organizations.error}
        message={tr(organizationErrorMessage(organizations.error))}
        retry={() => void organizations.refetch()}
      />
    );
  const currentSession = session.data;
  const available = (organizations.data ?? []).filter(
    (item) =>
      item.status === "APPROVED" &&
      currentSession.manageableOrganizationIds.includes(item.id),
  );
  if (
    initialOrganizationId &&
    !available.some((item) => item.id === initialOrganizationId)
  )
    return (
      <section className="feedback page-state">
        <h1>{tr("Публикация от организации недоступна")}</h1>
        <p>{tr("Нужна одобренная организация, которую вы представляете.")}</p>
        <Link className="button secondary" to="/organizations?view=mine">
          {tr("Проверить мою заявку")}
        </Link>
      </section>
    );
  return (
    <>
      {needOrganizations && organizations.isError && (
        <div className="notice" role="alert">
          <p>
            {tr(
              "Не удалось обновить организации. Данные формы сохранены. При публикации сервер повторно проверит допуск.",
            )}
          </p>
          <button
            className="button secondary"
            onClick={() => void organizations.refetch()}
          >
            {tr("Обновить организации для публикации")}
          </button>
        </div>
      )}
      <CreateEventForm
        key={initialOrganizationId ?? "personal"}
        sports={sports.data}
        session={session.data}
        organizations={available}
        initialOrganizationId={initialOrganizationId}
      />
    </>
  );
}
