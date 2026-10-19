import { MyOrganizations } from "../../../features/organization-application";
import { AdminOrganizations } from "../../../features/review-organizations";
import { sportsQuery } from "../../../entities/event";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { sessionQuery } from "../../../entities/session";
import { ErrorState } from "../../../shared/ui/Feedback";

export function WorkspacePage({ kind }: { kind: "admin" | "organization" }) {
  const query = useQuery(sessionQuery);
  const sports = useQuery({
    ...sportsQuery,
    enabled: kind === "organization" && Boolean(query.data),
  });
  if (query.isPending)
    return (
      <p className="page-state" role="status">
        Проверяем сессию…
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
        <h1>Нужен вход</h1>
        <p>Войдите в аккаунт с доступом к этому разделу.</p>
        <Link
          className="button primary"
          to={kind === "organization" ? "/login?next=organization" : "/login"}
        >
          Выбрать аккаунт
        </Link>
      </section>
    );
  const allowed =
    kind === "admin" ? query.data.systemRoles.includes("ADMIN") : true;
  if (!allowed)
    return (
      <section className="feedback page-state">
        <LockKeyhole size={32} />
        <h1>Нет доступа</h1>
        <p>В текущей сессии нет прав для этого раздела.</p>
        <Link className="button secondary" to="/login">
          Сменить аккаунт
        </Link>
      </section>
    );
  return (
    <section className="workspace-page">
      <span className="eyebrow muted">Демо-аккаунт</span>
      <h1>
        {kind === "admin" ? "Кабинет администратора" : "Кабинет организации"}
      </h1>
      {kind === "admin" ? (
        <AdminOrganizations viewerId={query.data.user.id} />
      ) : sports.isPending ? (
        <p role="status">Загружаем виды спорта…</p>
      ) : sports.isError ? (
        <ErrorState error={sports.error} retry={() => void sports.refetch()} />
      ) : (
        <MyOrganizations viewerId={query.data.user.id} sports={sports.data} />
      )}
    </section>
  );
}
