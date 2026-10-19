const relative = new Intl.RelativeTimeFormat("ru", { numeric: "auto" });
export function relativeTime(value: string, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(value)) / 1000));
  if (seconds < 60) return "только что";
  if (seconds < 3600)
    return relative.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400)
    return relative.format(-Math.floor(seconds / 3600), "hour");
  if (seconds < 604800)
    return relative.format(-Math.floor(seconds / 86400), "day");
  if (seconds < 2592000)
    return relative.format(-Math.floor(seconds / 604800), "week");
  return relative.format(-1, "month");
}
