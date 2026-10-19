import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { mapEventsQuery, sportsQuery } from "../../../entities/event";
import {
  venuesQuery,
  occupancyPresentation,
  VenueSummary,
} from "../../../entities/venue";
import { sessionQuery } from "../../../entities/session";
import { CreateVenueForm } from "../../../features/create-venue";
import { ReportOccupancyForm } from "../../../features/report-occupancy";
import { GeoMap } from "../../../shared/ui/GeoMap";
import { ErrorState } from "../../../shared/ui/Feedback";
import type { Point } from "../../../shared/lib/map";
import { MapMarkers, MapEventSummary } from "./MapMarkers";
import { MapSearch } from "./MapSearch";

export function MapPage() {
  const session = useQuery(sessionQuery);
  const sports = useQuery(sportsQuery);
  const [bbox, setBbox] = useState("");
  const [center, setCenter] = useState<Point>();
  const [sportId, setSportId] = useState("");
  const [showEvents, setShowEvents] = useState(true);
  const [showVenues, setShowVenues] = useState(true);
  const [creating, setCreating] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (creating || reporting) panel.current?.focus();
  }, [creating, reporting]);
  const events = useQuery({
    ...mapEventsQuery(bbox, sportId, session.data?.user.id),
    enabled: Boolean(bbox) && showEvents && !session.isPending,
  });
  const venues = useQuery({
    ...venuesQuery(bbox, sportId),
    enabled: Boolean(bbox) && showVenues,
  });
  const eventItems = showEvents ? (events.data?.items ?? []) : [];
  const venueItems = showVenues ? (venues.data?.items ?? []) : [];
  const selectedVenue = venueItems.find((venue) => venue.id === reporting);
  function report(id: string) {
    setReporting(id);
    setCreating(false);
    setNotice("");
  }
  return (
    <section className="map-page">
      <div className="map-heading">
        <div>
          <span className="eyebrow muted">Спорт рядом</span>
          <h1>
            Карта активностей<span className="brand-dot">.</span>
          </h1>
          <p>Найдите компанию или площадку для своей игры.</p>
        </div>
        <button
          className="button primary"
          type="button"
          onClick={() => {
            setCreating(true);
            setReporting(null);
            setNotice("");
          }}
        >
          Добавить площадку
        </button>
      </div>
      <p className="field-hint">
        Начальная область: Самара · демо-регион. Для другого места найдите адрес
        или переместите карту.
      </p>
      <div className="map-toolbar">
        <MapSearch onSelect={setCenter} />
        <label className="form-field">
          Вид спорта на карте
          <select
            value={sportId}
            onChange={(event) => setSportId(event.target.value)}
          >
            <option value="">Все виды спорта</option>
            {sports.data?.map((sport) => (
              <option key={sport.id} value={sport.id}>
                {sport.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="map-layers">
          <legend>Слои карты</legend>
          <label>
            <input
              type="checkbox"
              checked={showEvents}
              onChange={(event) => setShowEvents(event.target.checked)}
            />
            Мероприятия
          </label>
          <label>
            <input
              type="checkbox"
              checked={showVenues}
              onChange={(event) => setShowVenues(event.target.checked)}
            />
            Площадки
          </label>
        </fieldset>
        <button
          type="button"
          className="button secondary"
          disabled={!bbox || events.isFetching || venues.isFetching}
          onClick={() => {
            if (showEvents) void events.refetch();
            if (showVenues) void venues.refetch();
          }}
        >
          Обновить
        </button>
      </div>
      {sports.isError && (
        <ErrorState error={sports.error} retry={() => void sports.refetch()} />
      )}
      <div className="map-legend" aria-label="Обозначения карты">
        <span>⌖ Мероприятие</span>
        {Object.entries(occupancyPresentation).map(([level, presentation]) => (
          <span key={level}>
            <i
              aria-hidden="true"
              className={`legend-dot occupancy-${presentation.tone}`}
            />
            {presentation.label}
          </span>
        ))}
      </div>
      <p className="field-hint">
        Оценки оставляют пользователи, это не измерение в реальном времени.
        Свежесть — 90 минут.
      </p>
      <GeoMap center={center} onBounds={setBbox}>
        <MapMarkers
          events={eventItems}
          venues={venueItems}
          now={now}
          onReport={report}
        />
      </GeoMap>
      <div aria-live="polite" className="map-feedback">
        {(events.isFetching || venues.isFetching) && (
          <p>Обновляем объекты в этой области…</p>
        )}
        {((showEvents && events.data?.truncated) ||
          (showVenues && venues.data?.truncated)) && (
          <p>Приблизьте карту, чтобы увидеть все объекты.</p>
        )}
        {notice && (
          <p role="status" className="success-note">
            {notice}
          </p>
        )}
      </div>
      {(creating || reporting) && (
        <div ref={panel} tabIndex={-1} className="map-action-panel">
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              setCreating(false);
              setReporting(null);
            }}
          >
            Закрыть форму
          </button>
          {session.isPending ? (
            <p role="status">Проверяем сессию…</p>
          ) : session.isError ? (
            <ErrorState
              error={session.error}
              retry={() => void session.refetch()}
            />
          ) : !session.data ? (
            <p>
              Войдите, чтобы{" "}
              {creating ? "добавить площадку" : "оценить загруженность"}.{" "}
              <Link className="button primary" to="/login?next=map">
                Войти и вернуться к карте
              </Link>
            </p>
          ) : creating ? (
            <CreateVenueForm
              key={session.data.user.id}
              session={session.data}
              sports={sports.data ?? []}
              onSuccess={(venue) => {
                setCenter(venue.location);
                setShowVenues(true);
                setCreating(false);
                setNotice(
                  "Площадка добавлена. Теперь можно оценить её загруженность.",
                );
              }}
            />
          ) : (
            <>
              <h2>{selectedVenue?.name ?? "Оценить загруженность площадки"}</h2>
              <ReportOccupancyForm
                key={`${session.data.user.id}:${reporting}`}
                venueId={reporting!}
                session={session.data}
                onSuccess={() => {
                  setReporting(null);
                  setNotice("Оценка загруженности сохранена");
                }}
              />
            </>
          )}
        </div>
      )}
      <div className="map-results">
        {showEvents && (
          <section aria-label="Мероприятия в этой области">
            <h2>
              Мероприятия <span className="muted">{eventItems.length}</span>
            </h2>
            {events.isError ? (
              <ErrorState
                error={events.error}
                retry={() => void events.refetch()}
              />
            ) : (
              !events.isPending &&
              !eventItems.length && <p>В этой области пока нет мероприятий.</p>
            )}
            {eventItems.map((event) => (
              <article className="map-result" key={event.id}>
                <MapEventSummary event={event} />
              </article>
            ))}
          </section>
        )}
        {showVenues && (
          <section aria-label="Площадки в этой области">
            <h2>
              Площадки <span className="muted">{venueItems.length}</span>
            </h2>
            {venues.isError ? (
              <ErrorState
                error={venues.error}
                retry={() => void venues.refetch()}
              />
            ) : (
              !venues.isPending &&
              !venueItems.length && <p>Здесь нет площадок; добавьте свою.</p>
            )}
            {venueItems.map((venue) => (
              <article className="map-result" key={venue.id}>
                <VenueSummary venue={venue} now={now} />
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => report(venue.id)}
                >
                  Оценить загруженность
                </button>
              </article>
            ))}
          </section>
        )}
      </div>
    </section>
  );
}
