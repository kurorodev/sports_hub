import { localeTag } from "../../../shared/i18n/preferences";
import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { Textarea } from "../../../shared/ui/Textarea";
import { Select } from "../../../shared/ui/Select";
import { useState, lazy, Suspense } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useSupportRepository } from "../../../entities/support";
import {
  categoryLabels,
  statusLabels,
  priorityLabels,
  reasonLabels,
  statuses,
  priorities,
  type SupportStatus,
  type SupportPriority,
  type SupportTicket,
} from "../../../entities/support/model";
import { sessionQuery } from "../../../entities/session";
import { ApiError, errorMessage } from "../../../shared/api/client";
import { ErrorState } from "../../../shared/ui/Feedback";
import { relativeTime } from "../../../shared/lib/relative-time";
import { useNow } from "../../../shared/lib/use-now";
import { hasPoint } from "../../../shared/lib/map";
import { ApproveVenueForm } from "./ApproveVenueForm";
const GeoMap = lazy(() =>
  import("../../../shared/ui/GeoMap").then((module) => ({
    default: module.GeoMap,
  })),
);

export function SupportThread({
  id,
  viewerId,
  admin,
}: {
  id: string;
  viewerId: string;
  admin: boolean;
}) {
  useLocale();
  const now = useNow();
  const [mapOpen, setMapOpen] = useState(false);
  const repo = useSupportRepository();
  const client = useQueryClient();
  const root = ["support", viewerId];
  const query = useQuery({
    queryKey: [...root, "ticket", id],
    queryFn: ({ signal }) => repo.get(id, signal),
    refetchInterval: 10000,
    retry: false,
  });
  const thread = useInfiniteQuery({
    queryKey: [...root, "messages", id],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => repo.messages(id, pageParam, signal),
    getNextPageParam: (p) =>
      p.page + 1 < p.totalPages ? p.page + 1 : undefined,
    enabled: query.isSuccess,
    refetchInterval: 10000,
    retry: false,
  });
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");
  async function refresh() {
    await client.invalidateQueries({ queryKey: root });
    void client.invalidateQueries({ queryKey: ["notifications", viewerId] });
  }
  const current = () =>
    client.getQueryData(sessionQuery.queryKey)?.user.id === viewerId;
  const reply = useMutation({
    mutationFn: (draft: string) => repo.reply(id, draft),
    onSuccess: async () => {
      if (!current()) return;
      setText("");
      setNotice("Сообщение отправлено");
      await refresh();
    },
  });
  const update = useMutation({
    mutationFn: (input: {
      status?: SupportStatus;
      priority?: SupportPriority;
    }) => repo.update(id, input),
    onSuccess: async () => {
      if (!current()) return;
      setNotice("Изменения сохранены");
      await refresh();
    },
  });
  if (query.isPending)
    return (
      <p className="page-state" role="status">
        {tr("Загружаем обращение…")}
      </p>
    );
  if (query.isError)
    return (
      <>
        <Link to="/support">{tr("← В поддержку")}</Link>
        <ErrorState
          error={query.error}
          message={
            query.error instanceof ApiError && query.error.status === 404
              ? tr("Обращение не найдено или недоступно вашему аккаунту.")
              : undefined
          }
          retry={() => void query.refetch()}
        />
      </>
    );
  const t = query.data;
  const closed = t.status === "CLOSED" || t.status === "RESOLVED";
  const messages = [
    ...new Map(
      thread.data?.pages.flatMap((p) => p.items).map((m) => [m.id, m]),
    ).values(),
  ].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const pending = reply.isPending || update.isPending;
  return (
    <section className="support-thread-page">
      <Link
        className="back-link"
        to={admin ? "/support?view=queue" : "/support"}
      >
        ← {admin ? tr("К очереди поддержки") : tr("Мои обращения")}
      </Link>
      <header className="support-thread-heading">
        <span className="eyebrow muted">
          {tr(categoryLabels[t.category])} · №{id.slice(0, 8)}
        </span>
        <h1>{t.title}</h1>
        <div className="support-ticket-meta">
          <span
            className={`support-status support-status-${t.status.toLowerCase()}`}
          >
            {tr(statusLabels[t.status])}
          </span>
          <span>
            {tr("Создано ")}
            {relativeTime(t.createdAt, now)}
          </span>
        </div>
      </header>
      {notice && (
        <p className="notice success" role="status">
          {tr(notice)}
        </p>
      )}
      <div className="support-thread-layout">
        <div className="support-conversation">
          <article className="support-original">
            <div className="support-section-heading">
              <strong>
                {t.author.displayName}{" "}
                <span className="muted">@{t.author.nickname}</span>
              </strong>
              <span className="eyebrow muted">{tr("Обращение")}</span>
            </div>
            <p>{t.description}</p>
            {t.venueCity && (
              <div className="support-quote">
                <strong>{tr("Предложение площадки")}</strong>
                <p>
                  {t.venueCity} · {t.venueAddress}
                </p>
                {hasPoint({
                  city: t.venueCity,
                  address: t.venueAddress ?? "",
                  latitude: t.venueLatitude,
                  longitude: t.venueLongitude,
                }) && (
                  <>
                    <p>
                      {tr("Точка: ")}
                      {t.venueLatitude!.toFixed(5)},{" "}
                      {t.venueLongitude!.toFixed(5)}
                    </p>
                    <button
                      className="button secondary"
                      type="button"
                      aria-expanded={mapOpen}
                      onClick={() => setMapOpen(!mapOpen)}
                    >
                      {mapOpen
                        ? tr("Скрыть карту площадки")
                        : tr("Показать площадку на карте")}
                    </button>
                    {mapOpen && (
                      <Suspense
                        fallback={<p role="status">{tr("Загружаем карту…")}</p>}
                      >
                        <GeoMap
                          compact
                          center={{
                            latitude: t.venueLatitude!,
                            longitude: t.venueLongitude!,
                          }}
                          point={{
                            latitude: t.venueLatitude!,
                            longitude: t.venueLongitude!,
                          }}
                          zoom={16}
                          locate={false}
                        />
                      </Suspense>
                    )}
                  </>
                )}
                <span className="field-hint">
                  {t.publishedVenueId
                    ? tr("Площадка добавлена в список доступных площадок.")
                    : tr(
                        "Площадка появится на карте после проверки и добавления администратором.",
                      )}
                </span>
                {t.publishedVenueId && (
                  <Link
                    className="button primary"
                    to={`/map?venueId=${t.publishedVenueId}&lat=${t.venueLatitude}&lng=${t.venueLongitude}&zoom=16&events=0`}
                  >
                    {tr("Открыть добавленную площадку")}
                  </Link>
                )}
                {admin && !t.publishedVenueId && (
                  <ApproveVenueForm
                    ticket={t}
                    viewerId={viewerId}
                    onPublished={refresh}
                  />
                )}
              </div>
            )}
            {t.commentId && (
              <div className="support-quote">
                <strong>
                  {tr("Комментарий: ")}
                  {t.commentAuthor}
                </strong>
                <p>{t.commentText}</p>
                <p>
                  {tr("Причина:")}{" "}
                  {t.reportReason
                    ? tr(reasonLabels[t.reportReason])
                    : tr("Другая")}
                </p>
                <Link to={`/events/${t.eventId}#event-discussion`}>
                  {tr("Открыть обсуждение")}
                </Link>
                {admin && (
                  <Link to={`/admin?section=comments&eventId=${t.eventId}`}>
                    {tr("Перейти к модерации комментария")}
                  </Link>
                )}
                <span className="field-hint">
                  {tr("Сохранён текст на момент жалобы.")}
                </span>
              </div>
            )}
          </article>
          <section
            className="support-correspondence"
            aria-labelledby="support-thread-title"
          >
            <div className="support-section-heading">
              <h2 id="support-thread-title">{tr("Переписка")}</h2>
              <button
                className="button secondary"
                disabled={thread.isFetching}
                onClick={() => void thread.refetch()}
              >
                {tr("Обновить переписку")}
              </button>
            </div>
            {thread.isPending ? (
              <p role="status">{tr("Загружаем переписку…")}</p>
            ) : thread.isError ? (
              <ErrorState
                error={thread.error}
                retry={() => void thread.refetch()}
              />
            ) : (
              <>
                {thread.hasNextPage && (
                  <button
                    className="button secondary"
                    disabled={thread.isFetchingNextPage}
                    onClick={() => void thread.fetchNextPage()}
                  >
                    {tr("Показать более ранние сообщения")}
                  </button>
                )}
                {messages.length === 0 ? (
                  <p className="join-note">
                    {tr(
                      "Пока без ответов. Здесь появится переписка со специалистом.",
                    )}
                  </p>
                ) : (
                  <ol className="support-messages">
                    {messages.map((m) => (
                      <li
                        key={m.id}
                        className={
                          m.kind === "STATUS"
                            ? "support-system-message"
                            : m.fromSupport
                              ? "support-message support-message-staff"
                              : "support-message"
                        }
                      >
                        <header>
                          <strong>
                            {m.fromSupport ? tr("Поддержка · ") : ""}
                            {m.author.displayName}
                          </strong>
                          <time dateTime={m.createdAt}>
                            {new Intl.DateTimeFormat(localeTag(), {
                              dateStyle: "short",
                              timeStyle: "short",
                            }).format(new Date(m.createdAt))}
                          </time>
                        </header>
                        <p>{m.text}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </section>
          {closed ? (
            <div className="support-closed">
              <h3>
                {t.status === "RESOLVED"
                  ? tr("Вопрос решён")
                  : tr("Обращение закрыто")}
              </h3>
              <p>
                {tr(
                  "Если вопрос остался, откройте обращение повторно — история сохранится.",
                )}
              </p>
              <button
                className="button secondary"
                disabled={pending}
                onClick={() => update.mutate({ status: "OPEN" })}
              >
                {tr("Открыть повторно")}
              </button>
            </div>
          ) : (
            <form
              className="support-reply"
              onSubmit={(e) => {
                e.preventDefault();
                if (!pending && text.trim()) reply.mutate(text.trim());
              }}
            >
              <label className="form-field">
                {admin
                  ? tr("Ответ пользователю")
                  : tr("Ваше сообщение в поддержку")}
                <Textarea
                  disabled={pending}
                  required
                  maxLength={5000}
                  rows={4}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={tr("Дополните обращение или ответьте на вопрос")}
                />
              </label>
              <p className="field-hint">
                {tr("Переписка видна только автору и администраторам.")}
              </p>
              <button
                className="button primary"
                disabled={pending || !text.trim()}
                type="submit"
              >
                {reply.isPending ? tr("Отправляем…") : tr("Отправить ответ")}
              </button>
            </form>
          )}
          {(reply.isError || update.isError) && (
            <p role="alert" className="notice error">
              {tr(errorMessage(reply.error ?? update.error))}
            </p>
          )}
        </div>
        <aside className="support-sidebar">
          <h2>{tr("Об обращении")}</h2>
          <dl>
            <dt>{tr("Статус")}</dt>
            <dd>{tr(statusLabels[t.status])}</dd>
            <dt>{tr("Приоритет")}</dt>
            <dd>{tr(priorityLabels[t.priority])}</dd>
            <dt>{tr("Специалист")}</dt>
            <dd>{t.assignedTo?.displayName ?? tr("Ещё не назначен")}</dd>
          </dl>
          {admin ? (
            <TicketControls
              key={`${t.status}:${t.priority}`}
              ticket={t}
              pending={pending}
              save={(input) => update.mutate(input)}
            />
          ) : (
            !closed && (
              <button
                className="button secondary full-width"
                disabled={pending}
                onClick={() => update.mutate({ status: "CLOSED" })}
              >
                {tr("Вопрос решён, закрыть")}
              </button>
            )
          )}
          <p className="join-note">
            {tr(
              "Мы сохраняем историю обращений. О новых ответах сообщим в колокольчик.",
            )}
          </p>
        </aside>
      </div>
    </section>
  );
}
function TicketControls({
  ticket,
  pending,
  save,
}: {
  ticket: SupportTicket;
  pending: boolean;
  save: (input: { status: SupportStatus; priority: SupportPriority }) => void;
}) {
  useLocale();
  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save({ status, priority });
      }}
    >
      <label className="form-field">
        {tr("Изменить статус")}
        <Select
          disabled={pending}
          value={status}
          onChange={(e) => setStatus(e.target.value as SupportStatus)}
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {tr(statusLabels[s])}
            </option>
          ))}
        </Select>
      </label>
      <label className="form-field">
        {tr("Приоритет обращения")}
        <Select
          disabled={pending}
          value={priority}
          onChange={(e) => setPriority(e.target.value as SupportPriority)}
        >
          {priorities.map((p) => (
            <option key={p} value={p}>
              {tr(priorityLabels[p])}
            </option>
          ))}
        </Select>
      </label>
      <button
        className="button primary full-width"
        type="submit"
        disabled={pending}
      >
        {pending ? tr("Сохраняем…") : tr("Сохранить изменения")}
      </button>
      <p className="field-hint">
        {ticket.category === "VENUE_SUGGESTION" &&
          !ticket.publishedVenueId &&
          tr(
            "Смена статуса не добавляет площадку. Для одобрения используйте «Добавить площадку и решить обращение» выше. ",
          )}
        {tr(
          "При ответе или изменении вы назначаетесь специалистом по обращению.",
        )}
      </p>
    </form>
  );
}
