import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { sessionQuery } from "../../../entities/session";
import { categories } from "../../../entities/support/model";
import {
  CreateSupportForm,
  SupportDesk,
  SupportThread,
} from "../../../features/support";
import { ErrorState, NotFound } from "../../../shared/ui/Feedback";
import { isUuid } from "../../../shared/lib/identifiers";
export function SupportPage({ create = false }: { create?: boolean }) {
  useLocale();
  const session = useQuery(sessionQuery);
  const { ticketId } = useParams();
  const [params] = useSearchParams();
  if (session.isPending)
    return (
      <p className="page-state" role="status">
        {tr("Проверяем сессию…")}
      </p>
    );
  if (session.isError)
    return (
      <ErrorState error={session.error} retry={() => void session.refetch()} />
    );
  if (!session.data)
    return (
      <section className="feedback page-state">
        <h1>{tr("Центр поддержки")}</h1>
        <p>
          {tr("Войдите, чтобы написать нам и видеть ответы в своём аккаунте.")}
        </p>
        <Link className="button primary" to="/login?next=support">
          {tr("Войти и написать")}
        </Link>
      </section>
    );
  const viewerId = session.data.user.id;
  const admin = session.data.systemRoles.includes("ADMIN");
  if (create && admin) return <Navigate to="/support" replace />;
  if (create) {
    const category =
      categories.find(
        (c) => c === params.get("category") && c !== "COMMENT_REPORT",
      ) ?? "HELP";
    return (
      <section className="support-create-page">
        <Link className="back-link" to="/support">
          {tr("← В поддержку")}
        </Link>
        <h1>{tr("Новое обращение")}</h1>
        <p>{tr("Расскажите нам о вопросе, ошибке или идее.")}</p>
        <CreateSupportForm
          key={category}
          viewerId={viewerId}
          initialCategory={category}
        />
      </section>
    );
  }
  if (ticketId)
    return isUuid(ticketId) ? (
      <SupportThread
        key={ticketId}
        id={ticketId}
        viewerId={viewerId}
        admin={admin}
      />
    ) : (
      <NotFound />
    );
  return <SupportDesk viewerId={viewerId} admin={admin} />;
}
