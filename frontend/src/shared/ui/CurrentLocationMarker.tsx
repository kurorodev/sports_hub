import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Marker } from "maplibre-gl";
import { GeoMapContext } from "../lib/geo-map-context";
import { toMapCoordinates, type Point } from "../lib/map";

export function CurrentLocationMarker({ point }: { point: Point }) {
  const map = useContext(GeoMapContext);
  const [root] = useState(() => {
    const element = document.createElement("div");
    element.className = "map-marker map-current-location";
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", "Ваше текущее местоположение");
    element.title = "Вы здесь";
    return element;
  });
  const marker = useRef<Marker | null>(null);
  const latest = useRef(point);
  useLayoutEffect(() => {
    latest.current = point;
  });
  useEffect(() => {
    if (!map) return;
    const instance = new Marker({ element: root, anchor: "center" })
      .setLngLat(toMapCoordinates(latest.current))
      .addTo(map);
    marker.current = instance;
    return () => {
      instance.remove();
      marker.current = null;
    };
  }, [map, root]);
  useEffect(() => {
    marker.current?.setLngLat(toMapCoordinates(point));
  }, [point.latitude, point.longitude, point]);
  return createPortal(
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
      <path
        d="M20 4 33 34 20 27 7 34Z"
        fill="#e3313e"
        stroke="white"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M20 8 20 26 10 31Z" fill="#ff6770" />
    </svg>,
    root,
  );
}
