/** День считаем с явным смещением: часовой пояс браузера может отличаться от часового пояса события. */
export function calendarDate(offset = "+00:00", now = Date.now()) {
  const sign = offset.startsWith("-") ? -1 : 1;
  const minutes =
    sign * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6)));
  return new Date(now + minutes * 60_000).toISOString().slice(0, 10);
}
