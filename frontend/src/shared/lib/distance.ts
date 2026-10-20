import { tr } from "../i18n/translate";
import { localeTag } from "../i18n/preferences";
import { hasPoint, type Point } from "./map";

export const distanceRadii = [100, 200, 500, 1000, 2000, 3000, 5000] as const;
export function distanceMeters(a: Point, b: Point) {
  const radians = Math.PI / 180;
  const x = Math.sin(((b.latitude - a.latitude) * radians) / 2);
  const y = Math.sin(((b.longitude - a.longitude) * radians) / 2);
  const h =
    x * x +
    Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * y * y;
  return 12742000 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
}
export function formatDistance(meters: number) {
  return meters < 1000
    ? tr("{0} м", [Math.round(meters)])
    : tr("{0} км", [
        new Intl.NumberFormat(localeTag(), { maximumFractionDigits: 1 }).format(
          meters / 1000,
        ),
      ]);
}
export function distanceParams(params: URLSearchParams, origin?: Point | null) {
  const next = new URLSearchParams(params);
  // Координаты из URL задают поиск, а не подтверждённое местоположение пользователя.
  next.delete("originLatitude");
  next.delete("originLongitude");
  if (next.has("radiusMeters") && origin) {
    next.set("originLatitude", String(origin.latitude));
    next.set("originLongitude", String(origin.longitude));
  } else next.delete("radiusMeters");
  return next;
}
export function distanceParamError(params: URLSearchParams) {
  const keys = ["originLatitude", "originLongitude", "radiusMeters"];
  if (!keys.some((key) => params.has(key))) return false;
  if (keys.some((key) => !params.get(key)?.trim())) return true;
  return (
    !distanceRadii.some(
      (radius) => radius === Number(params.get("radiusMeters")),
    ) ||
    !hasPoint({
      latitude: Number(params.get("originLatitude")),
      longitude: Number(params.get("originLongitude")),
      city: "",
      address: "",
    })
  );
}
export function withinDistance(
  location: { latitude?: number | null; longitude?: number | null },
  params: URLSearchParams,
) {
  if (!params.has("radiusMeters")) return true;
  if (!hasPoint({ ...location, city: "", address: "" })) return false;
  return (
    distanceMeters(
      {
        latitude: Number(params.get("originLatitude")),
        longitude: Number(params.get("originLongitude")),
      },
      location as Point,
    ) <=
    Number(params.get("radiusMeters")) + 0.001
  );
}
