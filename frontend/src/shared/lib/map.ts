import type { Location } from "../api/types";

export type Point = { latitude: number; longitude: number };
export const demoCenter: Point = {
  latitude: 53.196061,
  longitude: 50.101522,
};
export function hasPoint(location: Location): location is Location & Point {
  return (
    typeof location.latitude === "number" &&
    Number.isFinite(location.latitude) &&
    Math.abs(location.latitude) <= 90 &&
    typeof location.longitude === "number" &&
    Number.isFinite(location.longitude) &&
    Math.abs(location.longitude) <= 180
  );
}
export function boundsToBbox(bounds: {
  getWest(): number;
  getSouth(): number;
  getEast(): number;
  getNorth(): number;
}) {
  return [
    Math.max(-180, bounds.getWest()),
    Math.max(-90, bounds.getSouth()),
    Math.min(180, bounds.getEast()),
    Math.min(90, bounds.getNorth()),
  ]
    .map((value) => value.toFixed(5))
    .join(",");
}
export function unpin(
  location: Location,
  field: "city" | "address",
  value: string,
): Location {
  return { ...location, [field]: value, latitude: null, longitude: null };
}
