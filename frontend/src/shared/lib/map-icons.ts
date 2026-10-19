import { divIcon } from "leaflet";

export const pointIcon = divIcon({
  className: "map-pin map-pin-event",
  html: "<span aria-hidden='true'>⌖</span>",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});
