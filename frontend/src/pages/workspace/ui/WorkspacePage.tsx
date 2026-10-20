import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { AdminEvents, AdminComments } from "../../../features/moderate-content";
import { useSearchParams } from "react-router-dom";
import { AdminOrganizations } from "../../../features/review-organizations";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { sessionQuery } from "../../../entities/session";
import { ErrorState } from "../../../shared/ui/Feedback";

export function WorkspacePage() {
  useLocale();
  const query = useQuery(sessionQuery);
  const [params] = useSearchParams();
  const section = params.get("section");
  if (query.isPending)
    return (
      <p className="page-state" role="status">
        {tr("Проверяем сессию…")}
      </p>
    );
  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  if (!query.data)
    return (
      <section className="feedback page-state">
        <LockKeyhole size={32} />
        <h1>{tr("Нужен вход")}</h1>
        <p>{tr("Войдите в аккаунт с доступом к этому разделу.")}</p>
        <Link className="button primary" to="/login">
          {tr("Выбрать аккаунт")}
        </Link>
      </section>
    );
  const allowed = query.data.systemRoles.includes("ADMIN");
  if (!allowed)
    return (
      <section className="feedback page-state">
        <LockKeyhole size={32} />
        <h1>{tr("Нет доступа")}</h1>
        <p>{tr("В текущей сессии нет прав для этого раздела.")}</p>
        <Link className="button secondary" to="/login">
          {tr("Сменить аккаунт")}
        </Link>
      </section>
    );
  return (
    <section className="workspace-page">
      <span className="eyebrow muted">{tr("Демо-аккаунт")}</span>
      <h1>{tr("Кабинет администратора")}</h1>
      <nav className="admin-sections" aria-label={tr("Разделы модерации")}>
        <Link to="/support?view=queue">{tr("Поддержка")}</Link>
        <Link
          to="/admin"
          aria-current={
            section !== "events" && section !== "comments" ? "page" : undefined
          }
        >
          {tr("Организации")}
        </Link>
        <Link
          to="/admin?section=events"
          aria-current={section === "events" ? "page" : undefined}
        >
          {tr("Мероприятия")}
        </Link>
        <Link
          to="/admin?section=comments"
          aria-current={section === "comments" ? "page" : undefined}
        >
          {tr("Комментарии")}
        </Link>
      </nav>
      {section === "events" ? (
        <AdminEvents viewerId={query.data.user.id} />
      ) : section === "comments" ? (
        <AdminComments viewerId={query.data.user.id} />
      ) : (
        <AdminOrganizations viewerId={query.data.user.id} />
      )}
    </section>
  );
}
