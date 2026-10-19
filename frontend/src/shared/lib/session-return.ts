import { safeMapReturn } from "./activity-navigation";

/** Only known internal destinations survive login or signup. */
export function sessionReturn(
  params: URLSearchParams,
  state: unknown,
  fallback = "/",
) {
  const next = params.get("next");
  const mapReturn = safeMapReturn(state);
  const eventId = params.get("eventId") ?? "";
  const to =
    next === "support"
      ? "/support"
      : next === "profile"
        ? "/profile"
        : next === "map"
          ? (mapReturn ?? "/map")
          : next === "organization"
            ? "/organization"
            : next === "create-event"
              ? "/events/new"
              : ["join-event", "event-discussion"].includes(next ?? "") &&
                  /^[\w-]{1,100}$/.test(eventId)
                ? `/events/${encodeURIComponent(eventId)}${next === "event-discussion" ? "#event-discussion" : ""}`
                : fallback;
  return { to, state: mapReturn ? { mapReturn } : undefined };
}
