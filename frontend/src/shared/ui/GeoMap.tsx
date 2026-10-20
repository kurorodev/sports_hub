import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Map as LibreMap,
  NavigationControl,
  setWorkerUrl,
  type MapMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import {
  boundsToBbox,
  demoCenter,
  toMapCoordinates,
  type Point,
} from "../lib/map";
import { GeoMapContext } from "../lib/geo-map-context";
import type { MapView } from "../lib/activity-navigation";
import { GeoMarker } from "./GeoMarker";
import { CurrentLocationMarker } from "./CurrentLocationMarker";
import type { CurrentLocationState } from "../lib/current-location-context";

// Explicit asset URL keeps the SDK worker available after Vite bundling.
setWorkerUrl(mapWorkerUrl);

export function GeoMap({
  center,
  point,
  onPoint,
  onBounds,
  children,
  compact = false,
  zoom = 17,
  onView,
  locate = true,
  tileErrorMessage,
  location,
}: {
  center?: Point;
  point?: Point;
  onPoint?: (point: Point) => void;
  onBounds?: (bbox: string) => void;
  children?: ReactNode;
  compact?: boolean;
  zoom?: number;
  onView?: (view: MapView) => void;
  locate?: boolean;
  tileErrorMessage?: string;
  location?: CurrentLocationState;
}) {
  const container = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onPoint, onBounds, onView });
  const requested = useRef({ center: center ?? demoCenter, zoom });
  const [map, setMap] = useState<LibreMap | null>(null);
  const [failed, setFailed] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState("");
  const [locatedPosition, setLocatedPosition] = useState<Point | null>(null);
  const currentPosition = location ? location.position : locatedPosition;
  const awaitingLocation = useRef(false);
  const activeMap = useRef<LibreMap | null>(null);
  useLayoutEffect(() => {
    callbacks.current = { onPoint, onBounds, onView };
    requested.current = { center: center ?? demoCenter, zoom };
  });
  useEffect(() => {
    if (!container.current) return;
    let instance: LibreMap | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setFailed(false);
    setTileError(false);
    try {
      instance = new LibreMap({
        container: container.current,
        style:
          import.meta.env.VITE_MAP_STYLE_URL ||
          "https://tiles.openfreemap.org/styles/liberty",
        center: toMapCoordinates(requested.current.center),
        zoom: requested.current.zoom,
        minZoom: 8,
        maxZoom: 19,
        renderWorldCopies: false,
        attributionControl: { compact: true },
        locale: {
          "NavigationControl.ZoomIn": "Приблизить",
          "NavigationControl.ZoomOut": "Отдалить",
          "Popup.Close": "Закрыть",
        },
      });
      const current = instance;
      // A 360° longitude range wraps to zero in MapLibre 6 bounds constraints.
      // Keep a small seam at the antimeridian to avoid a singular camera matrix.
      current.setMaxBounds([
        [-179.99999, -85],
        [179.99999, 85],
      ]);
      activeMap.current = current;
      current.addControl(
        new NavigationControl({ showCompass: false }),
        "top-left",
      );
      current.dragRotate.disable();
      current.touchZoomRotate.disableRotation();
      if (compact) current.scrollZoom.disable();
      const report = () => {
        callbacks.current.onBounds?.(boundsToBbox(current.getBounds()));
        const next = current.getCenter();
        callbacks.current.onView?.({
          latitude: next.lat,
          longitude: next.lng,
          zoom: Math.round(current.getZoom()),
        });
      };
      const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(report, 300);
      };
      current.on("moveend", schedule);
      current.on("resize", schedule);
      current.on("click", (event: MapMouseEvent) => {
        const target = event.originalEvent.target;
        if (
          target instanceof Element &&
          target.closest(".map-marker,.maplibregl-popup,.maplibregl-ctrl")
        )
          return;
        callbacks.current.onPoint?.({
          latitude: event.lngLat.lat,
          longitude: event.lngLat.lng,
        });
      });
      let fallbackStyle = false;
      current.on("error", () => {
        setTileError(true);
        // A failed initial style otherwise leaves the SDK render loop inactive.
        // An empty valid style keeps camera interaction and DOM markers working.
        if (!fallbackStyle && !current.getStyle()) {
          fallbackStyle = true;
          current.setStyle({ version: 8, sources: {}, layers: [] });
        }
      });
      current.on("load", () => {
        if (!fallbackStyle) setTileError(false);
      });
      callbacks.current.onBounds?.(boundsToBbox(current.getBounds()));
      setMap(current);
    } catch {
      instance?.remove();
      instance = undefined;
      activeMap.current = null;
      setMap(null);
      setFailed(true);
    }
    return () => {
      clearTimeout(timer);
      activeMap.current = null;
      instance?.remove();
    };
  }, [attempt, compact]);
  const latitude = center?.latitude,
    longitude = center?.longitude;
  useEffect(() => {
    if (!failed) return;
    // Keep the server-backed list useful around the requested center without WebGL.
    const point = {
      latitude: latitude ?? demoCenter.latitude,
      longitude: longitude ?? demoCenter.longitude,
    };
    callbacks.current.onBounds?.(
      boundsToBbox({
        getWest: () => point.longitude - 0.02,
        getEast: () => point.longitude + 0.02,
        getSouth: () => point.latitude - 0.01,
        getNorth: () => point.latitude + 0.01,
      }),
    );
  }, [failed, latitude, longitude]);
  useEffect(() => {
    if (!map || latitude == null || longitude == null) return;
    const current = map.getCenter();
    if (
      Math.abs(current.lat - latitude) > 0.0000051 ||
      Math.abs(current.lng - longitude) > 0.0000051 ||
      Math.round(map.getZoom()) !== zoom
    )
      map.jumpTo({ center: [longitude, latitude], zoom });
  }, [map, latitude, longitude, zoom]);
  useEffect(() => {
    if (!map || !currentPosition || !awaitingLocation.current) return;
    awaitingLocation.current = false;
    map.jumpTo({ center: toMapCoordinates(currentPosition), zoom: 14 });
  }, [map, currentPosition]);
  useEffect(() => {
    if (location?.status === "idle" || location?.status === "error")
      awaitingLocation.current = false;
  }, [location?.status]);
  return (
    <div className={`geo-map ${compact ? "compact" : ""}`}>
      <div
        ref={container}
        className="map-canvas"
        aria-label="Интерактивная карта"
        hidden={failed}
      />
      {map && !failed && (
        <GeoMapContext.Provider value={map}>
          {currentPosition && <CurrentLocationMarker point={currentPosition} />}
          {point && (
            <GeoMarker
              point={point}
              title="Выбранная точка"
              draggable={Boolean(onPoint)}
              onDragEnd={onPoint}
            />
          )}
          {children}
        </GeoMapContext.Provider>
      )}
      {failed && (
        <div className="map-unavailable" role="status">
          <p>Не удалось открыть карту. Проверьте поддержку WebGL в браузере.</p>
          <button
            type="button"
            className="button secondary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Повторить загрузку карты
          </button>
        </div>
      )}
      {map && !failed && locate && (
        <div className="map-location-control">
          <button
            type="button"
            disabled={location?.status === "locating"}
            onClick={() => {
              if (location) {
                if (location.position) {
                  map.jumpTo({
                    center: toMapCoordinates(location.position),
                    zoom: 14,
                  });
                } else {
                  awaitingLocation.current = true;
                  location.request();
                }
                return;
              }
              if (!navigator.geolocation) {
                setMessage(
                  "Браузер не поддерживает определение местоположения",
                );
                return;
              }
              setMessage("Определяем местоположение…");
              const current = map;
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  if (activeMap.current !== current) return;
                  setLocatedPosition({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                  });
                  current.jumpTo({
                    center: [
                      position.coords.longitude,
                      position.coords.latitude,
                    ],
                    zoom: 14,
                  });
                  setMessage("");
                },
                () => {
                  if (activeMap.current === current) {
                    setLocatedPosition(null);
                    setMessage(
                      "Не удалось определить местоположение. Найдите адрес или переместите карту.",
                    );
                  }
                },
                { timeout: 10_000 },
              );
            }}
          >
            {location?.status === "locating"
              ? "Определяем местоположение…"
              : "Моё местоположение"}
          </button>
          {(location?.error || message) && (
            <p role="status">{location?.error || message}</p>
          )}
        </div>
      )}
      {(tileError || failed) && (
        <p className="map-tile-warning" role="status">
          {tileErrorMessage ??
            (compact
              ? "Подложка карты недоступна. Адрес можно ввести вручную."
              : "Подложка карты недоступна. Объекты доступны в списке под картой.")}
        </p>
      )}
    </div>
  );
}
