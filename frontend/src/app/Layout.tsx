import { tr } from "../shared/i18n/translate";
import { useLocale } from "../shared/i18n/use-preferences";
import { SiteOnboarding, useSiteOnboarding } from "../features/site-onboarding";
import { NotificationBell } from "../features/notifications";
import { QuestionnaireOnboarding } from "../features/user-questionnaire";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, UserRound, Headset } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Brand } from "../shared/ui/Brand";
import { Avatar } from "../shared/ui/Avatar";
import { apiConfig } from "../shared/api/client";
import { sessionQuery } from "../entities/session";

export function Layout() {
  useLocale();
  const session = useQuery(sessionQuery);
  const location = useLocation();
  const guide = useSiteOnboarding();
  return (
    <>
      <a href="#main-content" className="skip-link">
        {tr("Перейти к содержимому")}
      </a>
      {apiConfig.mode === "mock" && (
        <div className="demo-strip">
          <span className="live-dot" />
          {tr("Демо на моках")}
          <span className="demo-detail">
            {tr(" · Java API ещё не подключён")}
          </span>
        </div>
      )}
      <header className="site-header">
        <div className="header-inner">
          <Brand onDark />
          <nav className="main-nav" aria-label={tr("Основная навигация")}>
            <NavLink to="/" end>
              {tr("Активности")}
            </NavLink>
            {!session.data?.systemRoles.includes("ADMIN") && (
              <NavLink to="/events/new">{tr("Создать")}</NavLink>
            )}
            {session.data && !session.data.systemRoles.includes("ADMIN") && (
              <NavLink to="/my-events">{tr("Мои мероприятия")}</NavLink>
            )}
            <NavLink to="/map">{tr("Карта")}</NavLink>
            <NavLink to="/organizations">{tr("Организации")}</NavLink>
            {session.data?.systemRoles.includes("ADMIN") && (
              <NavLink to="/admin">{tr("Модерация")}</NavLink>
            )}
          </nav>
          <div className="header-actions">
            <Link
              className="support-header-link"
              to="/support"
              aria-label={tr("Техническая поддержка")}
              title={tr("Техническая поддержка")}
            >
              <Headset size={23} aria-hidden="true" />
            </Link>
            {session.data && !session.isError && (
              <NotificationBell
                key={session.data.user.id}
                viewerId={session.data.user.id}
              />
            )}
            <Link
              className={`header-account${session.data ? " is-authenticated" : ""}`}
              to={session.data ? "/profile" : "/login"}
            >
              {session.data ? (
                <Avatar
                  id={session.data.user.id}
                  name={session.data.user.displayName}
                  url={session.data.user.avatarUrl}
                  tone={
                    session.data.systemRoles.includes("ADMIN")
                      ? "admin"
                      : session.data.systemRoles.includes("ORGANIZATION")
                        ? "organizer"
                        : "user"
                  }
                  size={32}
                />
              ) : (
                <UserRound size={18} />
              )}
              <span className="header-account-name">
                {session.isPending
                  ? tr("Сессия…")
                  : (session.data?.user.displayName ?? tr("Войти"))}
              </span>
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </header>
      {session.isError && (
        <div className="session-warning" role="alert">
          {tr("Не удалось восстановить сессию.")}{" "}
          <button onClick={() => void session.refetch()}>
            {tr("Повторить")}
          </button>
        </div>
      )}
      <main id="main-content" className="container" tabIndex={-1}>
        <div key={`${session.data?.user.id ?? "guest"}:${location.pathname}`}>
          <Outlet />
        </div>
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <Brand />
          <p>{tr("Спорт начинается с компании.")}</p>
          <Link to="/support">{tr("Техническая поддержка")}</Link>
          <button
            type="button"
            className="site-guide-replay"
            onClick={guide.start}
          >
            {tr("Как пользоваться сайтом")}
          </button>
          <span>{tr("Спортивные встречи · 2026")}</span>
        </div>
      </footer>
      {guide.open && !session.isPending && (
        <SiteOnboarding
          key={session.data?.systemRoles.includes("ADMIN") ? "admin" : "user"}
          admin={Boolean(session.data?.systemRoles.includes("ADMIN"))}
          onClose={guide.close}
        />
      )}
      {!guide.open &&
        session.data &&
        !session.isError &&
        !session.data.systemRoles.includes("ADMIN") && (
          <QuestionnaireOnboarding
            key={session.data.user.id}
            userId={session.data.user.id}
          />
        )}
    </>
  );
}
