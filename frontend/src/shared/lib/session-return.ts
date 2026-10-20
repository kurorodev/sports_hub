import { safeMapReturn } from "./activity-navigation";

/** После входа возвращаем только на разрешённые внутренние страницы, чтобы исключить внешний редирект. */
export function sessionReturn(
  params: URLSearchParams,
  state: unknown,
  fallback = "/",
) {
  const next = params.get("next");
  if (next === "organization-apply")
    return { to: "/organizations?view=apply", state: undefined };
  const mapReturn = safeMapReturn(state);
  const eventId = params.get("eventId") ?? "";
  const to =
    next === "support"
      ? "/support"
      : next === "my-events"
        ? "/my-events"
        : next === "profile"
          ? "/profile"
          : next === "map"
            ? (mapReturn ?? "/map")
            : next === "organization"
              ? "/organizations?view=mine"
              : next === "create-event"
                ? "/events/new"
                : ["join-event", "event-discussion"].includes(next ?? "") &&
                    /^[\w-]{1,100}$/.test(eventId)
                  ? `/events/${encodeURIComponent(eventId)}${next === "event-discussion" ? "#event-discussion" : ""}`
                  : fallback;
  return { to, state: mapReturn ? { mapReturn } : undefined };
}
