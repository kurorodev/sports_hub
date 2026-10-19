import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, LockKeyhole } from "lucide-react";
import { sessionQuery } from "../../../entities/session";
import { ErrorState } from "../../../shared/ui/Feedback";

export function WorkspacePage({ kind }: { kind: "admin" | "organization" }) {
  const query = useQuery(sessionQuery);
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
        <Link className="button primary" to="/login">
          Выбрать аккаунт
        </Link>
      </section>
    );
  const allowed =
    kind === "admin"
      ? query.data.systemRoles.includes("ADMIN")
      : query.data.manageableOrganizationIds.length > 0;
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
      <div className="notice">
        <CheckCircle2 size={24} />
        <div>
          <strong>Сессия восстановлена: {query.data.user.name}</strong>
          <p>Вы вошли в аккаунт с доступом к этому разделу.</p>
        </div>
      </div>
      <h2>Раздел готовится</h2>
      <p>
        {kind === "admin"
          ? "Здесь появится проверка организаций, событий и комментариев. Пока можно ознакомиться с каталогом."
          : "Здесь появится заявка организации и управление встречами после её одобрения. Пока можно ознакомиться с каталогом."}
      </p>
      <Link to="/" className="button primary">
        К активностям
      </Link>
    </section>
  );
}
