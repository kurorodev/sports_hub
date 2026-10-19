import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, UserRound } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Brand } from "../shared/ui/Brand";
import { apiConfig } from "../shared/api/client";
import { sessionQuery } from "../entities/session";

export function Layout() {
  const session = useQuery(sessionQuery);
  const location = useLocation();
  return (
    <>
      <a href="#main-content" className="skip-link">
        Перейти к содержимому
      </a>
      {apiConfig.mode === "mock" && (
        <div className="demo-strip">
          <span className="live-dot" />
          Демо на моках
          <span className="demo-detail"> · Java API ещё не подключён</span>
        </div>
      )}
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          <nav className="main-nav" aria-label="Основная навигация">
            <NavLink to="/" end>
              Активности
            </NavLink>
            <NavLink to="/events/new">Создать</NavLink>
            <NavLink to="/map">Карта</NavLink>
            <NavLink to="/organizations">Организации</NavLink>
            {session.data ? (
              <NavLink to="/organization">Организация</NavLink>
            ) : null}
            {session.data?.systemRoles.includes("ADMIN") && (
              <NavLink to="/admin">Модерация</NavLink>
            )}
          </nav>
          <Link className="header-account" to="/login">
            <UserRound size={18} />
            <span>
              {session.isPending
                ? "Сессия…"
                : (session.data?.user.displayName ?? "Войти")}
            </span>
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>
      {session.isError && (
        <div className="session-warning" role="alert">
          Не удалось восстановить сессию.{" "}
          <button onClick={() => void session.refetch()}>Повторить</button>
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
          <p>Спорт начинается с компании.</p>
          <span>ДВИЖ · прототип 2026</span>
        </div>
      </footer>
    </>
  );
}
