import messages from "./en.json";
import { getPreferences } from "./preferences";
const english: Record<string, string> = messages;
/** Translate interface copy only; interpolated user content is left intact. */
export function tr(text: string, values: readonly (string | number)[] = []) {
  const key = text.trim();
  const translated =
    getPreferences().locale === "en" && Object.hasOwn(english, key)
      ? english[key]
      : key;
  const result = translated.replace(/\{(\d+)\}/g, (match, index: string) =>
    String(values[Number(index)] ?? match),
  );
  return (
    text.slice(0, text.indexOf(key)) +
    result +
    text.slice(text.indexOf(key) + key.length)
  );
}
