import { createContext, useContext } from "react";
import type { Point } from "./map";

export const CurrentLocationContext = createContext<{
  position: Point | null;
  accuracy: number | null;
  status: "idle" | "locating" | "ready" | "error";
  error: string;
  request: () => void;
  stop: () => void;
}>({
  position: null,
  accuracy: null,
  status: "idle",
  error: "",
  request: () => {},
  stop: () => {},
});
export const useCurrentLocation = () => useContext(CurrentLocationContext);
