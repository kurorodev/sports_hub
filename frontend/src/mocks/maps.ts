import { withinDistance, distanceParamError } from "../shared/lib/distance";
import { http, HttpResponse } from "msw";
import { z } from "zod";
import { getEvents, getSports, mockId } from "./database";
import type {
  GeoSuggestion,
  OccupancyReportCreate,
  Session,
  VenueMapItem,
} from "../shared/api/types";
import { hasPoint } from "../shared/lib/map";
import { eventFieldsSchema } from "../shared/api/event-schema";

// A real reference point, not a geocoder: https://www.wikidata.org/wiki/Q4365616
export const demoSuggestion: GeoSuggestion = {
  id: "demo-kuybyshev-square",
  label: "Самара, площадь Куйбышева",
  city: "Самара",
  address: "площадь Куйбышева",
  latitude: 53.195561,
  longitude: 50.101022,
};
const storageKey = "sport.mock.map.v1";
type Report = {
  venueId: string;
  userId: string;
  level: OccupancyReportCreate["level"];
  createdAt: string;
};
type Store = {
  venues: (VenueMapItem & { createdBy: string; createdAt: string })[];
  reports: Report[];
};
let memory: Store = { venues: [], reports: [] };
const demoReportTime = Date.now();
const reportSchema = z
  .object({
    level: z.enum(["LOW", "MEDIUM", "HIGH"]),
    peopleCount: z.number().int().min(0).max(1000).nullable().optional(),
  })
  .strict();
const createSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    sportId: z.uuid().nullable().optional(),
    location: eventFieldsSchema.shape.location
      .extend({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
      .strict(),
  })
  .strict();
function read(): Store {
  const saved =
    typeof localStorage !== "undefined"
      ? localStorage.getItem(storageKey)
      : null;
  return saved ? (JSON.parse(saved) as Store) : memory;
}
function save(store: Store) {
  memory = store;
  if (typeof localStorage !== "undefined")
    localStorage.setItem(storageKey, JSON.stringify(store));
}
export function resetMockMaps() {
  memory = { venues: [], reports: [] };
  if (typeof localStorage !== "undefined") localStorage.removeItem(storageKey);
}
function seedVenues(): VenueMapItem[] {
  return ["LOW", "MEDIUM", "HIGH", "UNKNOWN"].map((_, i) => ({
    id: mockId(`map-venue-${i}`),
    name: `Демо-площадка № ${i + 1} (условный объект)`,
    sportId: null,
    sportName: null,
    location: {
      city: "Самара",
      address: "площадь Куйбышева · демонстрационная точка",
      latitude: demoSuggestion.latitude + (i % 2) * 0.001,
      longitude: demoSuggestion.longitude + Math.floor(i / 2) * 0.001,
    },
    occupancy: {
      level: "UNKNOWN",
      validUntil: null,
      lastReportedAt: null,
      reportsCount: 0,
    },
  }));
}
function venueItems(): VenueMapItem[] {
  const store = read(),
    now = Date.now();
  const demoReports: Report[] = (["LOW", "MEDIUM", "HIGH", "LOW"] as const).map(
    (level, i) => ({
      venueId: mockId(`map-venue-${i}`),
      userId: mockId("demo-map-observer"),
      level,
      createdAt: new Date(
        demoReportTime - (i === 3 ? 120 : 10) * 60_000,
      ).toISOString(),
    }),
  );
  return [...seedVenues(), ...store.venues].map((venue) => {
    const all = [...demoReports, ...store.reports]
      .filter((report) => report.venueId === venue.id)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const latest = [
      ...new Map(
        all
          .filter(
            (report) =>
              Date.parse(report.createdAt) > now - 90 * 60_000 &&
              Date.parse(report.createdAt) <= now,
          )
          .reverse()
          .map((report) => [report.userId, report]),
      ).values(),
    ];
    const levels = latest
      .map((report) => ["LOW", "MEDIUM", "HIGH"].indexOf(report.level))
      .sort((a, b) => a - b);
    // Only public DTO fields leave the mock backend.
    return {
      id: venue.id,
      name: venue.name,
      sportId: venue.sportId,
      sportName: venue.sportName,
      location: venue.location,
      occupancy: {
        level: levels.length
          ? (["LOW", "MEDIUM", "HIGH"] as const)[
              levels[Math.floor(levels.length / 2)]
            ]
          : "UNKNOWN",
        lastReportedAt: all[0]?.createdAt ?? null,
        validUntil: latest.length
          ? new Date(
              Math.min(
                ...latest.map(
                  (report) => Date.parse(report.createdAt) + 90 * 60_000,
                ),
              ),
            ).toISOString()
          : null,
        reportsCount: latest.length,
      },
    };
  });
}
const fail = (status: number, message: string) =>
  HttpResponse.json(
    {
      code: (
        {
          400: "VALIDATION_ERROR",
          401: "UNAUTHENTICATED",
          403: "FORBIDDEN",
          404: "NOT_FOUND",
          409: "CONFLICT",
          429: "RATE_LIMITED",
        } as Record<number, string>
      )[status],
      message,
      details: [],
      requestId: crypto.randomUUID(),
    },
    {
      status,
      ...(status === 429 ? { headers: { "Retry-After": "600" } } : {}),
    },
  );
function windowParams(request: Request) {
  const params = new URL(request.url).searchParams;
  const parts = (params.get("bbox") ?? "").split(",");
  const coords = parts.map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !part.trim()) ||
    !coords.every(Number.isFinite)
  )
    return null;
  const [west, south, east, north] = coords;
  const limit = Number(params.get("limit") ?? 300),
    sport = params.get("sportId");
  if (
    west < -180 ||
    east > 180 ||
    south < -90 ||
    north > 90 ||
    west >= east ||
    south >= north ||
    east - west > 10 ||
    north - south > 10 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 500 ||
    (sport && !z.uuid().safeParse(sport).success)
  )
    return null;
  return {
    params,
    limit,
    sport,
    contains: (loc: { latitude?: number | null; longitude?: number | null }) =>
      loc.latitude != null &&
      loc.longitude != null &&
      loc.longitude >= west &&
      loc.longitude <= east &&
      loc.latitude >= south &&
      loc.latitude <= north,
  };
}

export function mapHandlers(
  api: string,
  getSession: () => Session | undefined,
) {
  function authorize(request: Request) {
    const session = getSession();
    if (!session) return fail(401, "Войдите в аккаунт");
    if (request.headers.get("X-CSRF-Token") !== session.csrfToken)
      return fail(403, "Обновите сессию");
    return session;
  }
  return [
    http.get(`${api}/geo/suggest`, ({ request }) => {
      const p = new URL(request.url).searchParams,
        q = (p.get("q") ?? "").trim(),
        city = p.get("city") ?? "",
        limit = Number(p.get("limit") ?? 5);
      if (
        q.length < 3 ||
        q.length > 160 ||
        city.length > 120 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 10
      )
        return fail(400, "Проверьте параметры поиска");
      const text = `${city} ${q}`.toLocaleLowerCase("ru");
      const matched =
        (demoSuggestion.label
          .toLocaleLowerCase("ru")
          .includes(q.toLocaleLowerCase("ru")) ||
          text.includes("куйбыш")) &&
        (!city || "самара".includes(city.toLocaleLowerCase("ru")));
      return HttpResponse.json({ items: matched ? [demoSuggestion] : [] });
    }),
    http.get(`${api}/geo/reverse`, ({ request }) => {
      const p = new URL(request.url).searchParams,
        latitude = Number(p.get("latitude")),
        longitude = Number(p.get("longitude"));
      if (
        !p.has("latitude") ||
        !p.has("longitude") ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 ||
        Math.abs(longitude) > 180
      )
        return fail(400, "Недопустимые координаты");
      return HttpResponse.json({
        location:
          Math.abs(latitude - demoSuggestion.latitude) < 0.002 &&
          Math.abs(longitude - demoSuggestion.longitude) < 0.002
            ? {
                city: "Самара",
                address: demoSuggestion.address,
                latitude,
                longitude,
              }
            : null,
      });
    }),
    http.get(`${api}/map/events`, ({ request }) => {
      const window = windowParams(request);
      if (!window)
        return fail(400, "Недопустимый bbox или limit. Приблизьте карту");
      if (distanceParamError(window.params))
        return fail(400, "Некорректные параметры расстояния");
      const from = window.params.get("from"),
        to = window.params.get("to");
      if (
        (from && !z.iso.datetime({ offset: true }).safeParse(from).success) ||
        (to && !z.iso.datetime({ offset: true }).safeParse(to).success) ||
        (from && to && Date.parse(from) >= Date.parse(to))
      )
        return fail(400, "Недопустимый интервал дат");
      const items = getEvents(getSession()?.user.id)
        .filter(
          (event) =>
            event.status === "PUBLISHED" &&
            Date.parse(event.startsAt) >=
              Math.max(Date.now(), from ? Date.parse(from) : 0) &&
            (!to || Date.parse(event.startsAt) <= Date.parse(to)) &&
            hasPoint(event.location) &&
            window.contains(event.location) &&
            withinDistance(event.location, window.params) &&
            (!window.sport || event.sport.id === window.sport),
        )
        .sort(
          (a, b) =>
            Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
            a.id.localeCompare(b.id),
        );
      return HttpResponse.json({
        items: items.slice(0, window.limit),
        truncated: items.length > window.limit,
      });
    }),
    http.get(`${api}/map/venues`, ({ request }) => {
      const window = windowParams(request);
      if (!window)
        return fail(400, "Недопустимый bbox или limit. Приблизьте карту");
      const items = venueItems()
        .filter(
          (venue) =>
            window.contains(venue.location) &&
            (!window.sport || venue.sportId === window.sport),
        )
        .sort((a, b) => a.id.localeCompare(b.id));
      return HttpResponse.json({
        items: items.slice(0, window.limit),
        truncated: items.length > window.limit,
      });
    }),
    http.post(`${api}/map/venues`, async ({ request }) => {
      const session = authorize(request);
      if (session instanceof Response) return session;
      const result = createMockVenue(
        await request.json().catch(() => null),
        session,
      );
      return result instanceof Response
        ? result
        : HttpResponse.json(result, { status: 201 });
    }),
    http.post(
      `${api}/map/venues/:venueId/reports`,
      async ({ request, params }) => {
        const session = authorize(request);
        if (session instanceof Response) return session;
        const parsed = reportSchema.safeParse(
          await request.json().catch(() => null),
        );
        if (!parsed.success)
          return fail(400, "Выберите оценку и количество людей от 0 до 1000");
        if (!venueItems().some((venue) => venue.id === params.venueId))
          return fail(404, "Площадка не найдена");
        const store = read(),
          venueId = String(params.venueId);
        if (
          store.reports.some(
            (report) =>
              report.venueId === venueId &&
              report.userId === session.user.id &&
              Date.parse(report.createdAt) > Date.now() - 600_000,
          )
        )
          return fail(429, "Повторную оценку можно оставить через 10 минут");
        save({
          ...store,
          reports: [
            ...store.reports,
            {
              venueId,
              userId: session.user.id,
              level: parsed.data.level,
              createdAt: new Date(Date.now()).toISOString(),
            },
          ],
        });
        return HttpResponse.json(
          venueItems().find((venue) => venue.id === venueId),
          { status: 201 },
        );
      },
    ),
  ];
}

export function createMockVenue(
  raw: unknown,
  session: Session,
  reviewed = false,
) {
  if (reviewed && !session.systemRoles.includes("ADMIN"))
    return fail(403, "Только администратор");
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success)
    return fail(400, "Проверьте название, адрес и координаты");
  const input = parsed.data;
  const sport = input.sportId
    ? getSports().find((s) => s.id === input.sportId)
    : null;
  if (input.sportId && !sport) return fail(404, "Вид спорта не найден");
  const store = read();
  if (
    !reviewed &&
    store.venues.filter(
      (venue) =>
        venue.createdBy === session.user.id &&
        Date.parse(venue.createdAt) > Date.now() - 3600_000,
    ).length >= 3
  )
    return fail(429, "Можно добавить не более 3 площадок за час");
  const normalize = (s: string) =>
    s.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru");
  if (
    venueItems().some(
      (venue) =>
        normalize(venue.name) === normalize(input.name) &&
        Math.hypot(
          (venue.location.latitude - input.location.latitude) * 111_195,
          (venue.location.longitude - input.location.longitude) *
            111_195 *
            Math.cos((input.location.latitude * Math.PI) / 180),
        ) < 30,
    )
  )
    return fail(409, "Такая площадка уже есть рядом");
  const venue: VenueMapItem = {
    id: crypto.randomUUID(),
    name: input.name,
    sportId: input.sportId ?? null,
    sportName: sport?.name ?? null,
    location: input.location,
    occupancy: {
      level: "UNKNOWN",
      lastReportedAt: null,
      validUntil: null,
      reportsCount: 0,
    },
  };
  save({
    ...store,
    venues: [
      ...store.venues,
      {
        ...venue,
        createdBy: session.user.id,
        createdAt: new Date(Date.now()).toISOString(),
      },
    ],
  });
  return venue;
}
