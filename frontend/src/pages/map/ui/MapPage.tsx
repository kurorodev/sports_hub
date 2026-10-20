import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useMapParams } from "./use-map-params";
import { MapPin, ArrowUpRight, X } from "lucide-react";
import { ActivityViewSwitch } from "../../../shared/ui/ActivityViewSwitch";
import { DateRangeFields } from "../../../shared/ui/DateRangeFields";
import { SearchableSelect } from "../../../shared/ui/SearchableSelect";
import {
  listOnlyFilters,
  readMapView,
  writeMapView,
  type MapView,
} from "../../../shared/lib/activity-navigation";
import {
  mapEventsQuery,
  sportsQuery,
  sportIcon,
} from "../../../entities/event";
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
  const [params, setParams] = useMapParams();
  const view = readMapView(params);
  const sportId = params.get("sportId") ?? "";
  const showEvents = params.get("events") !== "off";
  const showVenues = params.get("venues") !== "off";
  const selectedEventId = params.get("eventId"),
    selectedVenueId = params.get("venueId");
  const selectionKey = selectedEventId
    ? `event:${selectedEventId}`
    : selectedVenueId
      ? `venue:${selectedVenueId}`
      : "";
  const selectionPanel = useRef<HTMLElement>(null);
  const focusSelection = useRef(false);
  const selectionTrigger = useRef<HTMLElement | null>(null);
  const unsupported = listOnlyFilters
    .filter(([key]) => Boolean(params.get(key)))
    .map(([, label]) => label);
  const setParam = (key: string, value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  const setShowEvents = (show: boolean) =>
    setParam("events", show ? "" : "off");
  const setShowVenues = (show: boolean) =>
    setParam("venues", show ? "" : "off");
  const rememberView = useCallback(
    (nextView: MapView) => {
      setParams(
        (current) => {
          const next = writeMapView(current, nextView);
          return next.toString() === current.toString() ? current : next;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  function setCenter(point: Point) {
    setParams((current) => writeMapView(current, { ...point, zoom: 16 }));
  }
  function select(kind: "event" | "venue", id: string, point?: Point) {
    selectionTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    focusSelection.current = true;
    setParams((current) => {
      const next = point
        ? writeMapView(current, { ...point, zoom: 17 })
        : new URLSearchParams(current);
      next.delete("eventId");
      next.delete("venueId");
      next.set(kind === "event" ? "eventId" : "venueId", id);
      return next;
    });
  }
  function closeSelection() {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("eventId");
        next.delete("venueId");
        return next;
      },
      { replace: true },
    );
    selectionTrigger.current?.focus({ preventScroll: true });
  }
  useEffect(() => {
    if (selectionKey && focusSelection.current) {
      selectionPanel.current?.focus({ preventScroll: true });
      selectionPanel.current?.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      });
      focusSelection.current = false;
    }
  }, [selectionKey]);
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
    ...mapEventsQuery(bbox, sportId, session.data?.user.id, {
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
    }),
    enabled:
      Boolean(bbox) && showEvents && !session.isPending && !session.isError,
  });
  const venues = useQuery({
    ...venuesQuery(bbox, sportId),
    enabled: Boolean(bbox) && showVenues,
  });
  const eventItems = showEvents ? (events.data?.items ?? []) : [];
  const venueItems = showVenues ? (venues.data?.items ?? []) : [];
  const selectedVenue = venueItems.find((venue) => venue.id === reporting);
  const selectedEvent = eventItems.find(
    (event) => event.id === selectedEventId,
  );
  const selectedMapVenue = venueItems.find(
    (venue) => venue.id === selectedVenueId,
  );
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
      <ActivityViewSwitch view="map" params={params} />
      {unsupported.length > 0 && (
        <p className="notice map-filter-notice">
          На карте действуют вид спорта, даты и видимая область. Только в
          списке: {unsupported.join(", ")}. Эти условия сохранены для возврата в
          список.
        </p>
      )}
      <p className="field-hint">
        Начальная область: Самара · демо-регион. Для другого места найдите адрес
        или переместите карту.
      </p>
      <div className="map-toolbar">
        <MapSearch onSelect={setCenter} />
        <div className="form-field">
          <label htmlFor="map-sport">Вид спорта на карте</label>
          <SearchableSelect
            id="map-sport"
            value={sportId}
            options={[
              { id: "", name: "Все виды спорта" },
              ...(sports.data ?? []).map((sport) => ({
                ...sport,
                imageUrl: sportIcon(sport.name),
              })),
            ]}
            onChange={(value) => setParam("sportId", value)}
            disabled={sports.isPending}
          />
        </div>
        <details
          className="map-date-filters"
          open={Boolean(params.get("from") || params.get("to"))}
        >
          <summary>Даты встреч (UTC)</summary>
          <div>
            <DateRangeFields
              from={params.get("from") ?? ""}
              to={params.get("to") ?? ""}
              onChange={setParam}
            />
          </div>
        </details>
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
        <span>
          <MapPin size={16} /> Мероприятие
        </span>
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
      <div className="map-explorer">
        <GeoMap
          center={view}
          zoom={view?.zoom ?? 17}
          onBounds={setBbox}
          onView={rememberView}
        >
          <MapMarkers
            events={eventItems}
            venues={venueItems}
            now={now}
            onReport={report}
            onSelect={select}
          />
        </GeoMap>
        {selectionKey && (
          <aside
            className="map-selection"
            ref={selectionPanel}
            tabIndex={-1}
            aria-label="Выбранный объект"
          >
            <div className="map-selection-heading">
              <span className="eyebrow muted">
                {selectedEventId ? "Мероприятие" : "Спортивная площадка"}
              </span>
              <button
                className="map-selection-close"
                aria-label="Закрыть карточку"
                onClick={closeSelection}
              >
                <X size={20} />
              </button>
            </div>
            {selectedEvent ? (
              <MapEventSummary event={selectedEvent} />
            ) : selectedMapVenue ? (
              <>
                <VenueSummary venue={selectedMapVenue} now={now} />
                <button
                  className="button primary"
                  onClick={() => report(selectedMapVenue.id)}
                >
                  Оценить загруженность
                </button>
              </>
            ) : events.isFetching || venues.isFetching || !bbox ? (
              <p role="status">Ищем выбранный объект…</p>
            ) : (
              <p>
                Объект не найден в этой области с текущими фильтрами. Он мог
                быть снят с публикации. Измените фильтры или выберите другой
                объект.
              </p>
            )}
          </aside>
        )}
      </div>
      <div aria-live="polite" className="map-feedback">
        {!showEvents && !showVenues && (
          <p className="notice">
            Оба слоя выключены. Включите мероприятия или площадки, чтобы увидеть
            объекты.
          </p>
        )}
        {showEvents && (
          <p>
            На карте — будущие опубликованные встречи с указанной точкой.
            Встречи без координат доступны в списке.
          </p>
        )}
        {session.isError && (
          <ErrorState
            error={session.error}
            retry={() => void session.refetch()}
          />
        )}
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
              <Link
                className="button primary"
                to="/login?next=map"
                state={{ mapReturn: `/map${params.size ? `?${params}` : ""}` }}
              >
                Войти и вернуться к карте
              </Link>
            </p>
          ) : creating ? (
            <CreateVenueForm
              key={session.data.user.id}
              session={session.data}
              sports={sports.data ?? []}
              onSuccess={(venue) => {
                setParams((current) => {
                  const next = writeMapView(current, {
                    ...venue.location,
                    zoom: 16,
                  });
                  next.delete("venues");
                  return next;
                });
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
                <button
                  className="button secondary"
                  onClick={() => {
                    if (
                      typeof event.location.latitude === "number" &&
                      typeof event.location.longitude === "number"
                    )
                      select("event", event.id, {
                        latitude: event.location.latitude,
                        longitude: event.location.longitude,
                      });
                  }}
                >
                  Показать на карте <ArrowUpRight size={16} />
                </button>
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
                  className="button secondary"
                  onClick={() => select("venue", venue.id, venue.location)}
                >
                  Показать на карте <ArrowUpRight size={16} />
                </button>
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
