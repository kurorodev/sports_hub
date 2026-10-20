import { tr } from "../i18n/translate";
import { useLocale } from "../i18n/use-preferences";
import { AlertCircle, ArrowLeft, SearchX } from "lucide-react";
import { Link } from "react-router-dom";
import { errorMessage } from "../api/client";

export function ErrorState({
  error,
  retry,
  message,
}: {
  error: unknown;
  retry?: () => void;
  message?: string;
}) {
  useLocale();
  return (
    <div className="feedback" role="alert">
      <AlertCircle size={30} />
      <h2>{tr("Не удалось загрузить данные")}</h2>
      <p>{tr(message ?? errorMessage(error))}</p>
      {retry && (
        <button className="button secondary" onClick={retry}>
          {tr("Повторить")}
        </button>
      )}
    </div>
  );
}
export function EmptyState({
  reset,
  canCreate = true,
}: {
  reset: () => void;
  canCreate?: boolean;
}) {
  useLocale();
  return (
    <div className="feedback">
      <SearchX size={36} />
      <h2>{tr("Пока без совпадений")}</h2>
      <p>
        {tr(
          "Попробуйте другой спорт, город или дату. Ваша компания ещё найдётся.",
        )}
      </p>
      <button className="button primary" onClick={reset}>
        {tr("Сбросить фильтры")}
      </button>
      {canCreate && (
        <Link className="button secondary" to="/events/new">
          {tr("Создать свою встречу")}
        </Link>
      )}
    </div>
  );
}
export function NotFound() {
  useLocale();
  return (
    <section className="feedback page-state">
      <span className="eyebrow">{tr("404 · Здесь пока тихо")}</span>
      <h1>{tr("Кажется, мы сбились с маршрута")}</h1>
      <p>{tr("Такой страницы нет. Вернёмся к спортивным встречам?")}</p>
      <Link className="button primary" to="/">
        <ArrowLeft size={18} />
        {tr("К активностям")}
      </Link>
    </section>
  );
}
export function Skeletons() {
  useLocale();
  return (
    <div
      className="event-grid"
      aria-label={tr("Загружаем активности")}
      role="status"
    >
      {[1, 2, 3].map((id) => (
        <div className="skeleton-card" key={id}>
          <div className="skeleton skeleton-image" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
          <div className="skeleton skeleton-line" />
        </div>
      ))}
    </div>
  );
}
