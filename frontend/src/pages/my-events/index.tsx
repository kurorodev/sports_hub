import type { EventPreview, Page } from "../../shared/api/types";
import { request } from "../../shared/api/client";
import { CancelEvent } from "../../features/cancel-event";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { sessionQuery } from "../../entities/session";
import { myEventsQuery } from "../../entities/registration/api/my-events";
import { registrationPresentation } from "../../entities/registration";
import { eventDate, sportImage } from "../../entities/event";
import { CancelParticipation } from "../../features/join-event";
import { ErrorState, Skeletons } from "../../shared/ui/Feedback";
import { tr } from "../../shared/i18n/translate";
import { useNow } from "../../shared/lib/use-now";
import { useLocale } from "../../shared/i18n/use-preferences";

export function MyEventsPage() {
  useLocale();
  const session = useQuery(sessionQuery);
  if (session.isPending) return <Skeletons />;
  if (session.isError)
    return (
      <ErrorState error={session.error} retry={() => void session.refetch()} />
    );
  if (!session.data)
    return (
      <section className="page-state">
        <h1>{tr("Мои мероприятия")}</h1>
        <p>{tr("Войдите, чтобы увидеть свои участия и заявки.")}</p>
        <Link className="button primary" to="/login?next=my-events">
          {tr("Войти")}
        </Link>
      </section>
    );
  if (session.data.systemRoles.includes("ADMIN"))
    return (
      <section className="page-state">
        <h1>{tr("Мои мероприятия")}</h1>
        <p>{tr("Администратор не участвует в мероприятиях.")}</p>
        <Link to="/">{tr("Все активности")}</Link>
      </section>
    );
  return <MyEvents viewerId={session.data.user.id} />;
}

function MyEvents({ viewerId }: { viewerId: string }) {
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const history = params.get("view") === "history";
  const created = params.get("view") === "created";
  const page = Math.max(0, Math.floor(Number(params.get("page")) || 0));
  const query = useQuery({
    ...myEventsQuery(viewerId, history ? "HISTORY" : "UPCOMING", page),
    enabled: !created,
  });
  function destination(p: number) {
    return {
      ...(history ? { view: "history" } : {}),
      ...(p ? { page: String(p) } : {}),
    };
  }
  return (
    <section className="workspace-page my-events-page">
      <header>
        <span className="eyebrow muted">{tr("Ваши активности")}</span>
        <h1>{tr("Мои мероприятия")}</h1>
        <p>{tr("Участия, заявки и история встреч — в одном месте.")}</p>
      </header>
      <nav
        className="organization-hub-nav"
        aria-label={tr("Разделы моих мероприятий")}
      >
        <Link
          to="/my-events"
          aria-current={!history && !created ? "page" : undefined}
        >
          {tr("Предстоящие")}
        </Link>
        <Link
          to="/my-events?view=history"
          aria-current={history ? "page" : undefined}
        >
          {tr("История")}
        </Link>
        <Link
          to="/my-events?view=created"
          aria-current={created ? "page" : undefined}
        >
          {tr("Я организатор")}
        </Link>
      </nav>
      {created ? (
        <CreatedEvents viewerId={viewerId} page={page} />
      ) : query.isPending ? (
        <Skeletons />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {query.data.items.length === 0 ? (
            <div className="my-events-empty">
              <CalendarDays size={32} aria-hidden="true" />
              <h2>
                {history
                  ? tr("История пока пуста")
                  : tr("Предстоящих участий пока нет")}
              </h2>
              <p>
                {history
                  ? tr(
                      "Здесь появятся прошедшие встречи, отменённые участия и отклонённые заявки.",
                    )
                  : tr("Выберите мероприятие в каталоге и присоединяйтесь.")}
              </p>
              <Link className="button secondary" to="/#activities">
                {tr("Все активности")}
              </Link>
            </div>
          ) : (
            <div className="my-events-list">
              {query.data.items.map((registration) => {
                const event = registration.event;
                if (!event)
                  return (
                    <article className="my-event" key={registration.id}>
                      <Link to={`/events/${registration.eventId}`}>
                        {tr("Посмотреть мероприятие")}
                      </Link>
                      <p>
                        {tr(
                          registrationPresentation[registration.status].label,
                        )}
                      </p>
                    </article>
                  );
                const presentation =
                  registrationPresentation[registration.status];
                const finished =
                  Date.parse(event.endsAt || event.startsAt) <= now;
                const canCancel =
                  ["PENDING", "CONFIRMED", "WAITLISTED"].includes(
                    registration.status,
                  ) &&
                  event.status === "PUBLISHED" &&
                  Date.parse(event.startsAt) > now;
                return (
                  <article className="my-event" key={registration.id}>
                    <img
                      src={event.sport.imageUrl || sportImage(event.sport.name)}
                      alt=""
                      loading="lazy"
                      width={104}
                      height={104}
                    />
                    <div className="my-event-content">
                      <div className="my-event-labels">
                        <span
                          className={`my-event-status ${presentation.tone}`}
                        >
                          {tr(presentation.label)}
                        </span>
                        {event.cancelledAt ? (
                          <span>
                            {tr("Мероприятие отменено организатором")}
                          </span>
                        ) : event.status !== "PUBLISHED" ? (
                          <span>{tr("Снято с публикации")}</span>
                        ) : finished ? (
                          <span>{tr("Мероприятие завершено")}</span>
                        ) : null}
                      </div>
                      <h2>
                        <Link to={`/events/${event.id}`}>{event.title}</Link>
                      </h2>
                      <p>
                        <CalendarDays size={16} aria-hidden="true" />
                        <time dateTime={event.startsAt}>
                          {eventDate(event.startsAt)}
                        </time>
                      </p>
                      <p>
                        <MapPin size={16} aria-hidden="true" />
                        <span>
                          {event.location.city}, {event.location.address}
                        </span>
                      </p>
                      {registration.decisionReason && !event.cancelledAt && (
                        <p className="field-hint">
                          {registration.decisionReason}
                        </p>
                      )}
                    </div>
                    <div className="my-event-actions">
                      <Link
                        className="button secondary"
                        to={`/events/${event.id}`}
                      >
                        {tr("Подробнее")}
                      </Link>
                      {canCancel && (
                        <CancelParticipation
                          eventId={event.id}
                          viewerId={viewerId}
                        />
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {query.data.totalPages > 1 && (
            <nav className="pagination" aria-label={tr("Страницы мероприятий")}>
              <button
                className="button secondary"
                disabled={page === 0}
                onClick={() => setParams(destination(page - 1))}
              >
                {tr("Назад")}
              </button>
              <span>
                {page + 1} / {query.data.totalPages}
              </span>
              <button
                className="button secondary"
                disabled={page + 1 >= query.data.totalPages}
                onClick={() => setParams(destination(page + 1))}
              >
                {tr("Далее")}
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

function CreatedEvents({ viewerId, page }: { viewerId: string; page: number }) {
  const [, setParams] = useSearchParams();
  const query = useQuery({
    queryKey: ["events", "mine", viewerId, page],
    queryFn: ({ signal }) =>
      request<Page<EventPreview>>(`/me/events?page=${page}&size=12`, {
        signal,
      }),
    retry: false,
    refetchInterval: 15000,
  });
  if (query.isPending) return <Skeletons />;
  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  return (
    <>
      <p className="field-hint">
        {tr("Ваши личные мероприятия и встречи от ваших организаций.")}
      </p>
      {!query.data.items.length ? (
        <div className="my-events-empty">
          <h2>{tr("Вы пока не создали мероприятий")}</h2>
          <Link className="button primary" to="/events/new">
            {tr("Создать мероприятие")}
          </Link>
        </div>
      ) : (
        <div className="my-events-list">
          {query.data.items.map((event) => (
            <article className="my-event" key={event.id}>
              <img
                src={event.sport.imageUrl || sportImage(event.sport.name)}
                alt=""
                width={104}
                height={104}
                loading="lazy"
              />
              <div className="my-event-content">
                <div className="my-event-labels">
                  <span>
                    {event.cancelledAt
                      ? tr("Мероприятие отменено организатором")
                      : event.status === "DRAFT"
                        ? tr("Черновик")
                        : event.status === "PUBLISHED"
                          ? tr("Опубликовано")
                          : tr("Снято с публикации")}
                  </span>
                  <span>{event.organizer.name}</span>
                </div>
                <h2>
                  <Link to={`/events/${event.id}`}>{event.title}</Link>
                </h2>
                <p>
                  <CalendarDays size={16} aria-hidden="true" />
                  <time dateTime={event.startsAt}>
                    {eventDate(event.startsAt)}
                  </time>
                </p>
                <p>
                  <MapPin size={16} aria-hidden="true" />
                  <span>
                    {event.location.city}, {event.location.address}
                  </span>
                </p>
              </div>
              <div className="my-event-actions">
                <Link className="button secondary" to={`/events/${event.id}`}>
                  {tr("Подробнее")}
                </Link>
                <CancelEvent event={event} viewerId={viewerId} />
              </div>
            </article>
          ))}
        </div>
      )}
      {query.data.totalPages > 1 && (
        <nav className="pagination" aria-label={tr("Страницы мероприятий")}>
          <button
            className="button secondary"
            disabled={page === 0}
            onClick={() =>
              setParams({ view: "created", page: String(page - 1) })
            }
          >
            {tr("Назад")}
          </button>
          <span>
            {page + 1} / {query.data.totalPages}
          </span>
          <button
            className="button secondary"
            disabled={page + 1 >= query.data.totalPages}
            onClick={() =>
              setParams({ view: "created", page: String(page + 1) })
            }
          >
            {tr("Далее")}
          </button>
        </nav>
      )}
    </>
  );
}
