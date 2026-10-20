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
  return (
    <div className="feedback" role="alert">
      <AlertCircle size={30} />
      <h2>Не удалось загрузить данные</h2>
      <p>{message ?? errorMessage(error)}</p>
      {retry && (
        <button className="button secondary" onClick={retry}>
          Повторить
        </button>
      )}
    </div>
  );
}
export function EmptyState({ reset }: { reset: () => void }) {
  return (
    <div className="feedback">
      <SearchX size={36} />
      <h2>Пока без совпадений</h2>
      <p>
        Попробуйте другой спорт, город или дату. Ваша компания ещё найдётся.
      </p>
      <button className="button primary" onClick={reset}>
        Сбросить фильтры
      </button>
      <Link className="button secondary" to="/events/new">
        Создать свою встречу
      </Link>
    </div>
  );
}
export function NotFound() {
  return (
    <section className="feedback page-state">
      <span className="eyebrow">404 · Здесь пока тихо</span>
      <h1>Кажется, мы сбились с маршрута</h1>
      <p>Такой страницы нет. Вернёмся к спортивным встречам?</p>
      <Link className="button primary" to="/">
        <ArrowLeft size={18} />К активностям
      </Link>
    </section>
  );
}
export function Skeletons() {
  return (
    <div className="event-grid" aria-label="Загружаем активности" role="status">
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
