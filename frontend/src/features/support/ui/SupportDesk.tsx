import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { LifeBuoy, Lightbulb, MapPin, Bug, MessagesSquare } from "lucide-react";
import { useSupportRepository } from "../../../entities/support";
import {
  categories,
  statuses,
  categoryLabels,
  statusLabels,
  priorityLabels,
  type SupportFilters,
} from "../../../entities/support/model";
import { ErrorState } from "../../../shared/ui/Feedback";
import { relativeTime } from "../../../shared/lib/relative-time";
import { useNow } from "../../../shared/lib/use-now";

const choices = [
  {
    category: "HELP",
    icon: LifeBuoy,
    title: "Помочь разобраться",
    text: "Аккаунт, запись на встречу и другие вопросы",
  },
  {
    category: "BUG",
    icon: Bug,
    title: "Сообщить об ошибке",
    text: "Что-то работает не так? Расскажите нам",
  },
  {
    category: "VENUE_SUGGESTION",
    icon: MapPin,
    title: "Предложить площадку",
    text: "Добавим больше мест для спорта",
  },
  {
    category: "IDEA",
    icon: Lightbulb,
    title: "Поделиться идеей",
    text: "Вместе сделаем ДВИЖ удобнее",
  },
] as const;
export function SupportDesk({
  viewerId,
  admin,
}: {
  viewerId: string;
  admin: boolean;
}) {
  const now = useNow();
  const repo = useSupportRepository();
  const [params, setParams] = useSearchParams();
  const queue = admin;
  const [draft, setDraft] = useState(params.get("q") ?? "");
  const status = statuses.find((s) => s === params.get("status"));
  const category = categories.find((c) => c === params.get("category"));
  const page = Math.max(
    0,
    Math.min(100000, Number.parseInt(params.get("page") ?? "0", 10) || 0),
  );
  const filters: SupportFilters = {
    q: params.get("q") ?? undefined,
    status,
    category,
    page,
  };
  const query = useQuery({
    queryKey: ["support", viewerId, "list", queue, filters],
    queryFn: ({ signal }) => repo.list(queue, filters, signal),
    refetchInterval: 15000,
    retry: false,
  });
  function change(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  }
  return (
    <>
      <header className="support-hero">
        <span className="eyebrow muted">ДВИЖ рядом</span>
        <h1>Центр поддержки</h1>
        <p>
          {admin
            ? "Рассматривайте обращения, отвечайте пользователям и управляйте статусами."
            : "Поможем с вопросом, проверим жалобу и услышим вашу идею."}
        </p>
      </header>
      {!admin && (
        <div className="support-choices">
          {choices.map(({ category, icon: Icon, title, text }) => (
            <Link
              key={category}
              className="support-choice"
              to={`/support/new?category=${category}`}
            >
              <Icon size={24} aria-hidden="true" />
              <strong>{title}</strong>
              <span>{text}</span>
            </Link>
          ))}
        </div>
      )}
      <section
        className="support-requests"
        aria-labelledby="support-list-title"
      >
        <div className="support-section-heading">
          <h2 id="support-list-title">
            <MessagesSquare size={24} aria-hidden="true" />{" "}
            {queue ? "Очередь поддержки" : "Мои обращения"}
          </h2>
        </div>
        <form
          className="support-filters"
          onSubmit={(e) => {
            e.preventDefault();
            change("q", draft.trim());
          }}
        >
          <label className="form-field">
            Поиск обращений
            <input
              maxLength={160}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Заголовок или подробности"
            />
          </label>
          <label className="form-field">
            Статус обращения
            <select
              value={status ?? ""}
              onChange={(e) => change("status", e.target.value)}
            >
              <option value="">Все статусы</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Категория
            <select
              value={category ?? ""}
              onChange={(e) => change("category", e.target.value)}
            >
              <option value="">Все категории</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {categoryLabels[c]}
                </option>
              ))}
            </select>
          </label>
          <button className="button secondary" type="submit">
            Найти
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Обновить
          </button>
        </form>
        {query.isPending ? (
          <p role="status">Загружаем обращения…</p>
        ) : query.isError ? (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        ) : (
          <>
            <p className="join-note">Найдено: {query.data.total}</p>
            {query.data.items.length === 0 ? (
              <div className="support-empty">
                <LifeBuoy size={32} />
                <h3>Здесь пока нет обращений</h3>
                <p>
                  {admin
                    ? "Новые обращения появятся здесь. Попробуйте изменить фильтры."
                    : "Создайте обращение или измените фильтры."}
                </p>
              </div>
            ) : (
              <ol className="support-ticket-list">
                {query.data.items.map((t) => (
                  <li key={t.id}>
                    <Link
                      className="support-ticket-card"
                      to={`/support/${t.id}`}
                    >
                      <div className="support-section-heading">
                        <span className="eyebrow muted">
                          {categoryLabels[t.category]} · №{t.id.slice(0, 8)}
                        </span>
                        <span
                          className={`support-status support-status-${t.status.toLowerCase()}`}
                        >
                          {statusLabels[t.status]}
                        </span>
                      </div>
                      <h3>{t.title}</h3>
                      <p>{t.description}</p>
                      <div className="support-ticket-meta">
                        <span>
                          {queue
                            ? `${t.author.displayName} · @${t.author.nickname}`
                            : t.assignedTo
                              ? `С вами ${t.assignedTo.displayName}`
                              : "Ожидает специалиста"}
                        </span>
                        <span>
                          {queue && t.priority !== "NORMAL"
                            ? `${priorityLabels[t.priority]} · `
                            : ""}
                          {relativeTime(t.updatedAt, now)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
            {(query.data.totalPages > 1 || page > 0) && (
              <nav className="pagination" aria-label="Страницы обращений">
                <button
                  className="button secondary"
                  disabled={page === 0}
                  onClick={() => change("page", String(page - 1))}
                >
                  Назад
                </button>
                <span>Страница {page + 1}</span>
                <button
                  className="button secondary"
                  disabled={page + 1 >= query.data.totalPages}
                  onClick={() => change("page", String(page + 1))}
                >
                  Далее
                </button>
              </nav>
            )}
          </>
        )}
      </section>
      {!admin && (
        <section className="support-faq">
          <h2>Быстрые ответы</h2>
          <details>
            <summary>Где следить за ответом?</summary>
            <p>
              Все ответы остаются в обращении. При ответе специалиста придёт
              уведомление в колокольчик. Пока вкладка открыта, переписка
              обновляется автоматически.
            </p>
          </details>
          <details>
            <summary>Как пожаловаться на комментарий?</summary>
            <p>
              Откройте обсуждение встречи и нажмите «Пожаловаться» под
              сообщением. Выберите причину и поясните ситуацию. Жалоба не
              публикуется в обсуждении.
            </p>
          </details>
          <details>
            <summary>Когда площадка появится на карте?</summary>
            <p>
              Передайте название, город и точный адрес. Администратор проверит
              предложение и ответит в обращении. Отправка предложения не
              публикует площадку автоматически.
            </p>
          </details>
        </section>
      )}
    </>
  );
}
