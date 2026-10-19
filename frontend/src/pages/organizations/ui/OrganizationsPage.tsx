import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Building2, Plus, ArrowLeft, LockKeyhole } from "lucide-react";
import { sessionQuery } from "../../../entities/session";
import { MyOrganizations } from "../../../features/organization-application";
import { ErrorState } from "../../../shared/ui/Feedback";
import { Toast } from "../../../shared/ui/Toast";
import { OrganizationsDirectory } from "./OrganizationsDirectory";
import { OrganizationApplication } from "./OrganizationApplication";

export function OrganizationsPage() {
  const session = useQuery(sessionQuery);
  const [params, setParams] = useSearchParams();
  const view =
    params.get("view") === "apply"
      ? "apply"
      : params.get("view") === "mine"
        ? "mine"
        : "all";
  const [notice, setNotice] = useState<{ id: string; text: string } | null>(
    null,
  );
  const dismissNotice = useCallback(() => setNotice(null), []);
  function search(nextView: "all" | "mine" | "apply") {
    const next = new URLSearchParams(params);
    if (nextView === "all") next.delete("view");
    else next.set("view", nextView);
    return next;
  }
  function destination(nextView: "all" | "mine" | "apply") {
    const next = search(nextView);
    return `/organizations${next.size ? `?${next}` : ""}`;
  }
  return (
    <section className="workspace-page organization-hub">
      <header className="organization-hub-heading">
        <div className="organization-hub-intro">
          <span className="organization-hub-icon">
            <Building2 size={28} aria-hidden="true" />
          </span>
          <div>
            <span className="eyebrow muted">Клубы и сообщества</span>
            <h1>Организации</h1>
            <p>Найдите свою команду или развивайте собственный клуб.</p>
          </div>
        </div>
        {view !== "apply" && (
          <Link className="button primary" to={destination("apply")}>
            <Plus size={18} aria-hidden="true" />
            Добавить организацию
          </Link>
        )}
      </header>
      <nav className="organization-hub-nav" aria-label="Разделы организаций">
        <Link
          to={destination("all")}
          aria-current={view === "all" ? "page" : undefined}
        >
          Все организации
        </Link>
        <Link
          to={destination("mine")}
          aria-current={view !== "all" ? "page" : undefined}
        >
          Мои организации
        </Link>
      </nav>
      {session.isError ? (
        <ErrorState
          error={session.error}
          retry={() => void session.refetch()}
        />
      ) : view === "all" ? (
        <OrganizationsDirectory key={params.get("q") ?? ""} />
      ) : session.isPending ? (
        <p className="page-state" role="status">
          Проверяем сессию…
        </p>
      ) : !session.data ? (
        <div className="organization-access">
          <LockKeyhole size={28} aria-hidden="true" />
          <h2>
            {view === "apply"
              ? "Расскажите о своём клубе"
              : "Ваши организации и заявки"}
          </h2>
          <p>
            Войдите, чтобы подать заявку, следить за её статусом и публиковать
            встречи от организации.
          </p>
          <Link
            className="button primary"
            to={`/login?next=${view === "apply" ? "organization-apply" : "organization"}`}
          >
            Войти в аккаунт
          </Link>
        </div>
      ) : view === "mine" ? (
        <div className="organization-mine">
          <p className="organization-section-description">
            Здесь собраны ваши клубы, статусы заявок и доступ к публикации
            встреч.
          </p>
          <MyOrganizations
            key={session.data.user.id}
            viewerId={session.data.user.id}
          />
        </div>
      ) : (
        <div className="organization-application-page">
          <Link className="back-link" to={destination("mine")}>
            <ArrowLeft size={16} aria-hidden="true" />К моим организациям
          </Link>
          <div className="organization-section-heading">
            <h2>Добавьте свой клуб</h2>
            <p>
              Заполните короткую заявку. После одобрения вы сможете публиковать
              встречи от имени организации.
            </p>
          </div>
          <OrganizationApplication
            key={session.data.user.id}
            viewerId={session.data.user.id}
            onCreated={(organization) => {
              setNotice({
                id: organization.id,
                text: `«${organization.name}»: заявка отправлена на рассмотрение.`,
              });
              setParams(search("mine"));
            }}
          />
        </div>
      )}
      {notice && (
        <Toast
          key={notice.id}
          message={notice.text}
          onDismiss={dismissNotice}
        />
      )}
    </section>
  );
}
