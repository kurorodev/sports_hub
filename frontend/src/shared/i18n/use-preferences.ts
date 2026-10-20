import { useSyncExternalStore } from "react";
import { getPreferences, subscribePreferences } from "./preferences";
export function usePreferences() {
  return useSyncExternalStore(
    subscribePreferences,
    getPreferences,
    getPreferences,
  );
}
export function useLocale() {
  return usePreferences().locale;
}
