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
  const page = Math.max(0, Math.floor(Number(params.get("page")) || 0));
  const query = useQuery(
    myEventsQuery(viewerId, history ? "HISTORY" : "UPCOMING", page),
  );
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
        <Link to="/my-events" aria-current={!history ? "page" : undefined}>
          {tr("Предстоящие")}
        </Link>
        <Link
          to="/my-events?view=history"
          aria-current={history ? "page" : undefined}
        >
          {tr("История")}
        </Link>
      </nav>
      {query.isPending ? (
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
                  ) && Date.parse(event.startsAt) > now;
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
                        {event.status !== "PUBLISHED" ? (
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
                      {registration.decisionReason && (
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
