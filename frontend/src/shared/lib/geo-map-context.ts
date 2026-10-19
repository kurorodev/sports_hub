import { createContext } from "react";
import type { Map } from "maplibre-gl";

export const GeoMapContext = createContext<Map | null>(null);
