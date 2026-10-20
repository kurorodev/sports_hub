export type Locale = "ru" | "en";
export type Theme = "light" | "dark";
export type InterfacePreferences = { locale: Locale; theme: Theme };
export const preferencesKey = "sport.interface.v1";
const listeners = new Set<() => void>();
function readPreferences(value: string | null): InterfacePreferences {
  try {
    const saved = value ? JSON.parse(value) : {};
    return {
      locale: saved?.locale === "en" ? "en" : "ru",
      theme: saved?.theme === "dark" ? "dark" : "light",
    };
  } catch {
    return { locale: "ru", theme: "light" };
  }
}
function initialPreferences() {
  try {
    return readPreferences(localStorage.getItem(preferencesKey));
  } catch {
    return readPreferences(null);
  }
}
let current = initialPreferences();
export function getPreferences() {
  return current;
}
export function localeTag() {
  return current.locale === "en" ? "en-GB" : "ru-RU";
}
export function subscribePreferences(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function applyPreferences() {
  document.documentElement.lang = current.locale;
  document.documentElement.dataset.theme = current.theme;
  document.documentElement.style.colorScheme = current.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute(
    "content",
    current.theme === "dark" ? "#151419" : "#f5f5f3",
  );
}
function update(next: InterfacePreferences) {
  if (next.locale === current.locale && next.theme === current.theme) return;
  current = next;
  if (typeof document !== "undefined") applyPreferences();
  listeners.forEach((listener) => listener());
}
export function setPreferences(patch: Partial<InterfacePreferences>) {
  const next = { ...current, ...patch };
  update(next);
  try {
    localStorage.setItem(preferencesKey, JSON.stringify(next));
  } catch {
    /* Keep settings usable when browser storage is unavailable. */
  }
}
export function initializePreferences() {
  applyPreferences();
  const onStorage = (event: StorageEvent) => {
    if (event.key === preferencesKey || event.key === null)
      update(readPreferences(event.newValue));
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
