import { hasPoint, type Point } from "./map";

const catalogKeys = [
  "q",
  "sportId",
  "sport",
  "city",
  "from",
  "to",
  "skillLevel",
  "joinMode",
  "eventKind",
  "organizerType",
  "hasSpots",
  "includePast",
  "sort",
  "page",
  "size",
  "radiusMeters",
];
export const listOnlyFilters = [
  ["q", "поиск по тексту"],
  ["city", "город"],
  ["skillLevel", "уровень"],
  ["joinMode", "способ записи"],
  ["hasSpots", "свободные места"],
  ["includePast", "прошедшие встречи"],
  ["eventKind", "тип встречи"],
  ["organizerType", "тип организатора"],
  ["sport", "название спорта"],
] as const;

export function activityViewHref(
  view: "list" | "map",
  params: URLSearchParams,
) {
  const next =
    view === "map" ? new URLSearchParams(params) : new URLSearchParams();
  if (view === "list")
    for (const key of catalogKeys) {
      const value = params.get(key);
      if (value !== null) next.set(key, value);
    }
  return `${view === "map" ? "/map" : "/"}${next.size ? `?${next}` : ""}${view === "list" ? "#activities" : ""}`;
}

export type MapView = Point & { zoom: number };
export function readMapView(params: URLSearchParams): MapView | undefined {
  const lat = params.get("lat"),
    lng = params.get("lng");
  if (!lat?.trim() || !lng?.trim()) return;
  const point = {
    latitude: Number(lat),
    longitude: Number(lng),
    city: "",
    address: "",
  };
  const zoom = Number(params.get("zoom") ?? 17);
  if (
    hasPoint(point) &&
    Math.abs(point.latitude) <= 85 &&
    Number.isInteger(zoom) &&
    zoom >= 8 &&
    zoom <= 19
  )
    return { latitude: point.latitude, longitude: point.longitude, zoom };
}
export function writeMapView(params: URLSearchParams, view: MapView) {
  const next = new URLSearchParams(params);
  next.set("lat", view.latitude.toFixed(5));
  next.set("lng", view.longitude.toFixed(5));
  next.set("zoom", String(view.zoom));
  return next;
}
export function safeMapReturn(state: unknown): string | undefined {
  if (!state || typeof state !== "object" || !("mapReturn" in state)) return;
  const value = state.mapReturn;
  if (
    typeof value === "string" &&
    (value === "/map" || value.startsWith("/map?"))
  )
    return value;
}
export function dateBoundary(value: string | null, end = false) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T${end ? "23:59:59.999" : "00:00:00"}Z`
    : (value ?? "");
}
