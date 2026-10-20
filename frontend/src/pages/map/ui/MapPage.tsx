import { useCurrentLocation } from "../../../shared/lib/current-location-context";
import { DistanceFilter } from "../../../shared/ui/DistanceFilter";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useMapParams } from "./use-map-params";
import {
  MapPin,
  ArrowUpRight,
  ChevronDown,
  X,
  Navigation2,
} from "lucide-react";
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
  const [datesOpen, setDatesOpen] = useState(() =>
    Boolean(params.get("from") || params.get("to")),
  );
  const dateFilters = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!datesOpen) return;
    function outside(event: PointerEvent) {
      if (!dateFilters.current?.contains(event.target as Node)) {
        setDatesOpen(false);
      }
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [datesOpen]);
  const view = readMapView(params);
  const location = useCurrentLocation();
  const { position } = location;
  const radius = params.get("radiusMeters") ?? "";
  const needsLocation = Boolean(radius) && !position;
  const radiusZoom = (value: string) => {
    const meters = Number(value);
    return meters > 0 && meters <= 5000
      ? Math.max(8, Math.min(17, Math.floor(17 - Math.log2(meters / 100))))
      : 17;
  };
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
      let next = new URLSearchParams(current);
      if (key === "radiusMeters") {
        next.delete("page");
        if (value && position)
          next = writeMapView(next, { ...position, zoom: radiusZoom(value) });
      }
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
    setReporting(null);
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
    setReporting(null);
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
  useEffect(() => {
    if (reporting && reporting !== selectedVenueId) setReporting(null);
  }, [reporting, selectedVenueId]);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now);
  const panel = useRef<HTMLDivElement>(null);
  const reportPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (creating) panel.current?.focus();
    else if (reporting) reportPanel.current?.focus();
  }, [creating, reporting]);
  const events = useQuery({
    ...mapEventsQuery(
      bbox,
      sportId,
      session.data?.user.id,
      {
        from: params.get("from") ?? undefined,
        to: params.get("to") ?? undefined,
      },
      radius ? { radius, origin: position } : undefined,
    ),
    enabled:
      Boolean(bbox) &&
      showEvents &&
      !needsLocation &&
      !session.isPending &&
      !session.isError,
  });
  const venues = useQuery({
    ...venuesQuery(bbox, sportId),
    enabled: Boolean(bbox) && showVenues,
  });
  const eventItems =
    showEvents && !needsLocation ? (events.data?.items ?? []) : [];
  const venueItems = showVenues ? (venues.data?.items ?? []) : [];
  const selectedEvent = eventItems.find(
    (event) => event.id === selectedEventId,
  );
  const selectedMapVenue = venueItems.find(
    (venue) => venue.id === selectedVenueId,
  );
  function report(id: string) {
    select("venue", id, venueItems.find((venue) => venue.id === id)?.location);
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
          На карте действуют вид спорта, даты, расстояние до мероприятий и
          видимая область. Только в списке: {unsupported.join(", ")}. Эти
          условия сохранены для возврата в список.
        </p>
      )}
      <p className="field-hint">
        Начальная область: Самара · демо-регион. Для другого места найдите адрес
        или переместите карту.
      </p>
      <div className="map-toolbar">
        <DistanceFilter
          value={radius}
          onChange={(value) => setParam("radiusMeters", value)}
        />
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
          ref={dateFilters}
          className="map-date-filters"
          open={datesOpen}
          onToggle={(event) => setDatesOpen(event.currentTarget.open)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setDatesOpen(false);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setDatesOpen(false);
              dateFilters.current?.querySelector("summary")?.focus();
            }
          }}
        >
          <summary>
            Даты встреч (UTC)
            <ChevronDown size={17} aria-hidden="true" />
          </summary>
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
        {position && (
          <span>
            <Navigation2
              className="map-current-location-key"
              size={18}
              aria-hidden="true"
            />{" "}
            Вы здесь
          </span>
        )}
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
          location={location}
          center={view ?? (radius && position ? position : undefined)}
          zoom={view?.zoom ?? (radius ? radiusZoom(radius) : 17)}
          onBounds={setBbox}
          onView={rememberView}
        >
          <MapMarkers
            events={eventItems}
            venues={venueItems}
            now={now}
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
                {reporting === selectedMapVenue.id ? (
                  <div
                    className="map-venue-rating"
                    ref={reportPanel}
                    tabIndex={-1}
                  >
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => {
                        setReporting(null);
                        selectionPanel.current?.focus({ preventScroll: true });
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
                        Войдите, чтобы оценить загруженность.{" "}
                        <Link
                          className="button primary"
                          to="/login?next=map"
                          state={{
                            mapReturn: `/map${params.size ? `?${params}` : ""}`,
                          }}
                        >
                          Войти и вернуться к карте
                        </Link>
                      </p>
                    ) : (
                      <ReportOccupancyForm
                        key={`${session.data.user.id}:${reporting}`}
                        venueId={reporting}
                        session={session.data}
                        onSuccess={() => {
                          setReporting(null);
                          setNotice("Оценка загруженности сохранена");
                          selectionPanel.current?.focus({
                            preventScroll: true,
                          });
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <button
                    className="button primary"
                    onClick={() => report(selectedMapVenue.id)}
                  >
                    Оценить загруженность
                  </button>
                )}
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
      {creating && (
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
              Войдите, чтобы добавить площадку.{" "}
              <Link
                className="button primary"
                to="/login?next=map"
                state={{ mapReturn: `/map${params.size ? `?${params}` : ""}` }}
              >
                Войти и вернуться к карте
              </Link>
            </p>
          ) : (
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
          )}
        </div>
      )}
      <div className="map-results">
        {showEvents && (
          <section aria-label="Мероприятия в этой области">
            <h2>
              Мероприятия <span className="muted">{eventItems.length}</span>
            </h2>
            {needsLocation ? (
              <p role="status">
                Включите геолокацию, чтобы найти мероприятия в выбранном
                радиусе.
              </p>
            ) : events.isError ? (
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
