import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  MapContainer,
  TileLayer,
  ZoomControl,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { DomEvent } from "leaflet";
import { pointIcon } from "../lib/map-icons";
import "leaflet/dist/leaflet.css";
import { boundsToBbox, demoCenter, type Point } from "../lib/map";
import type { MapView } from "../lib/activity-navigation";

function Interactions({
  center,
  point,
  onPoint,
  onBounds,
  onView,
  zoom,
  locate,
}: {
  center?: Point;
  point?: Point;
  onPoint?: (point: Point) => void;
  onBounds?: (bbox: string) => void;
  onView?: (view: MapView) => void;
  zoom: number;
  locate: boolean;
}) {
  const map = useMap();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const locationControl = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");
  const latitude = center?.latitude,
    longitude = center?.longitude;
  useEffect(() => {
    if (latitude != null && longitude != null)
      map.setView([latitude, longitude], zoom);
  }, [map, latitude, longitude, zoom]);
  useEffect(() => {
    onBounds?.(boundsToBbox(map.getBounds()));
  }, [map, onBounds]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (locationControl.current)
      DomEvent.disableClickPropagation(locationControl.current);
  }, []);
  useMapEvents({
    click: (event) =>
      onPoint?.({ latitude: event.latlng.lat, longitude: event.latlng.lng }),
    moveend: () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        onBounds?.(boundsToBbox(map.getBounds()));
        const next = map.getCenter();
        onView?.({
          latitude: next.lat,
          longitude: next.lng,
          zoom: map.getZoom(),
        });
      }, 300);
    },
  });
  return (
    <>
      {point && (
        <Marker
          position={[point.latitude, point.longitude]}
          icon={pointIcon}
          draggable={Boolean(onPoint)}
          title="Выбранная точка"
          eventHandlers={{
            dragend: (event) => {
              const latlng = event.target.getLatLng();
              onPoint?.({ latitude: latlng.lat, longitude: latlng.lng });
            },
          }}
        />
      )}
      {locate && (
        <div className="map-location-control" ref={locationControl}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (!navigator.geolocation) {
                setMessage(
                  "Браузер не поддерживает определение местоположения",
                );
                return;
              }
              setMessage("Определяем местоположение…");
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  map.setView(
                    [position.coords.latitude, position.coords.longitude],
                    14,
                  );
                  setMessage("");
                },
                () =>
                  setMessage(
                    "Не удалось определить местоположение. Найдите адрес или переместите карту.",
                  ),
                { timeout: 10_000 },
              );
            }}
          >
            Моё местоположение
          </button>
          {message && <p role="status">{message}</p>}
        </div>
      )}
    </>
  );
}

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
}) {
  const [tileError, setTileError] = useState(false);
  return (
    <div className={`geo-map ${compact ? "compact" : ""}`}>
      <MapContainer
        center={[
          (center ?? demoCenter).latitude,
          (center ?? demoCenter).longitude,
        ]}
        zoom={zoom}
        zoomControl={false}
        minZoom={8}
        maxBounds={[
          [-85, -180],
          [85, 180],
        ]}
        scrollWheelZoom={!compact}
      >
        <ZoomControl zoomInTitle="Приблизить" zoomOutTitle="Отдалить" />
        <TileLayer
          url={
            import.meta.env.VITE_MAP_TILE_URL ||
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
          attribution={
            import.meta.env.VITE_MAP_TILE_ATTRIBUTION ||
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          }
          eventHandlers={{
            loading: () => setTileError(false),
            tileerror: () => setTileError(true),
          }}
        />
        <Interactions
          center={center}
          point={point}
          onPoint={onPoint}
          onBounds={onBounds}
          onView={onView}
          zoom={zoom}
          locate={locate}
        />
        {children}
      </MapContainer>
      {tileError && (
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
