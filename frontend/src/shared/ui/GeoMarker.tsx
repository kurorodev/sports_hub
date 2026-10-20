import {
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Marker, Popup, type MapMouseEvent } from "maplibre-gl";
import { GeoMapContext } from "../lib/geo-map-context";
import { toMapCoordinates, type Point } from "../lib/map";

export function GeoMarker({
  point,
  title,
  tone,
  tooltip,
  children,
  onSelect,
  draggable = false,
  onDragEnd,
}: {
  point: Point;
  title: string;
  tone?: string;
  tooltip?: ReactNode;
  children?: ReactNode;
  onSelect?: () => void;
  draggable?: boolean;
  onDragEnd?: (point: Point) => void;
}) {
  const map = useContext(GeoMapContext);
  const [root] = useState(() => {
    const element = document.createElement("div");
    element.className = "map-marker";
    return element;
  });
  const [popupRoot] = useState(() => document.createElement("div"));
  const marker = useRef<Marker | null>(null);
  const popup = useRef<Popup | null>(null);
  const latest = useRef({ point, onDragEnd });
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const tooltipId = useId();
  const hasPopup = Boolean(children);
  useLayoutEffect(() => {
    latest.current = { point, onDragEnd };
  });
  useEffect(() => {
    if (!map) return;
    const instance = new Marker({ element: root, draggable })
      .setLngLat(toMapCoordinates(latest.current.point))
      .addTo(map);
    marker.current = instance;
    instance.on("dragend", () => {
      const next = instance.getLngLat();
      latest.current.onDragEnd?.({ latitude: next.lat, longitude: next.lng });
    });
    return () => {
      instance.remove();
      marker.current = null;
    };
  }, [map, root, draggable]);
  useEffect(() => {
    marker.current?.setLngLat([point.longitude, point.latitude]);
    popup.current?.setLngLat([point.longitude, point.latitude]);
  }, [point.latitude, point.longitude]);
  useEffect(() => {
    if (!map || !open || !hasPopup) return;
    const instance = new Popup({
      closeButton: true,
      closeOnClick: false,
      focusAfterOpen: false,
      maxWidth: "300px",
      offset: 22,
    })
      .setLngLat(toMapCoordinates(latest.current.point))
      .setDOMContent(popupRoot)
      .addTo(map);
    const close = () => setOpen(false);
    // React can flush this effect before the opening click reaches the map.
    // Ignore that marker click, but close on a click elsewhere (including another marker).
    const closeFromMap = (event: MapMouseEvent) => {
      const target = event.originalEvent.target;
      if (
        target instanceof Node &&
        (root.contains(target) || popupRoot.contains(target))
      )
        return;
      setOpen(false);
    };
    map.on("click", closeFromMap);
    instance.on("close", close);
    popup.current = instance;
    return () => {
      map.off("click", closeFromMap);
      instance.off("close", close);
      instance.remove();
      popup.current = null;
    };
  }, [map, open, hasPopup, popupRoot, root]);
  return (
    <>
      {createPortal(
        <>
          <button
            type="button"
            className={`map-pin ${tone ? `map-pin-venue occupancy-${tone}` : "map-pin-event"}`}
            title={title}
            aria-label={title}
            aria-describedby={hovered && tooltip ? tooltipId : undefined}
            aria-expanded={hasPopup ? open : undefined}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocus={() => setHovered(true)}
            onBlur={() => setHovered(false)}
            onClick={() => {
              if (hasPopup) setOpen((value) => !value);
              onSelect?.();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
              if (
                !draggable ||
                !map ||
                !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
                  event.key,
                )
              )
                return;
              event.preventDefault();
              const pixel = map.project(toMapCoordinates(latest.current.point));
              const step = event.shiftKey ? 10 : 1;
              pixel.x +=
                event.key === "ArrowRight"
                  ? step
                  : event.key === "ArrowLeft"
                    ? -step
                    : 0;
              pixel.y +=
                event.key === "ArrowDown"
                  ? step
                  : event.key === "ArrowUp"
                    ? -step
                    : 0;
              const next = map.unproject(pixel);
              latest.current.onDragEnd?.({
                latitude: next.lat,
                longitude: next.lng,
              });
            }}
          >
            <span aria-hidden="true">{tone ? "●" : "⌖"}</span>
          </button>
          {hovered && tooltip && (
            <div id={tooltipId} role="tooltip" className="map-marker-tooltip">
              {tooltip}
            </div>
          )}
        </>,
        root,
      )}
      {hasPopup &&
        createPortal(
          <div className="map-popup-content" role="dialog" aria-label={title}>
            {children}
          </div>,
          popupRoot,
        )}
    </>
  );
}
