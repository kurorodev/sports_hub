import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "./setup";
import {
  activityViewHref,
  readMapView,
  writeMapView,
  safeMapReturn,
} from "../shared/lib/activity-navigation";
import { mapEventsQuery } from "../entities/event";
import { EventLocation } from "../entities/event/ui/EventLocation";
import type { Point } from "../shared/lib/map";

vi.mock("../shared/ui/GeoMap", () => ({
  GeoMap: ({ point }: { point?: Point }) => (
    <div
      role="img"
      aria-label={`Точка ${point?.latitude}, ${point?.longitude}`}
    />
  ),
}));
describe("catalog and map navigation", () => {
  it("preserves catalog filters both ways and excludes map-only state from catalog", () => {
    const filters = new URLSearchParams({
      q: "Вместе",
      sportId: "спорт",
      city: "Самара",
      from: "2026-11-01",
      joinMode: "OPEN",
      hasSpots: "true",
      page: "2",
    });
    const map = new URL(activityViewHref("map", filters), "http://localhost");
    expect(map.searchParams.toString()).toBe(filters.toString());
    map.searchParams.set("lat", "53.19");
    map.searchParams.set("venueId", "площадка");
    map.searchParams.set("events", "off");
    const list = new URL(
      activityViewHref("list", map.searchParams),
      "http://localhost",
    );
    expect(list.searchParams.toString()).toBe(filters.toString());
    expect(list.hash).toBe("#activities");
  });
  it("restores a viewport including zero coordinates and retains filters when writing it", () => {
    const params = writeMapView(
      new URLSearchParams("sportId=run&eventId=one"),
      { latitude: 0, longitude: -50.123456, zoom: 12 },
    );
    expect(readMapView(params)).toEqual({
      latitude: 0,
      longitude: -50.12346,
      zoom: 12,
    });
    expect(params.get("sportId")).toBe("run");
    expect(params.get("eventId")).toBe("one");
    expect(readMapView(new URLSearchParams("lat=53&lng=50"))?.zoom).toBe(17);
    for (const query of [
      "lat=&lng=50",
      "lat=NaN&lng=50",
      "lat=Infinity&lng=50",
      "lat=90&lng=50",
      "lat=53&lng=181",
      "lat=53&lng=50&zoom=99",
      "lat=53&lng=50&zoom=12.5",
    ])
      expect(readMapView(new URLSearchParams(query))).toBeUndefined();
  });
  it("accepts only internal map returns, never arbitrary navigation from history state", () => {
    expect(safeMapReturn({ mapReturn: "/map?lat=53&lng=50&sportId=run" })).toBe(
      "/map?lat=53&lng=50&sportId=run",
    );
    expect(safeMapReturn({ mapReturn: "/map" })).toBe("/map");
    for (const value of [
      "https://example.com",
      "//example.com",
      "/map-other",
      "/admin",
      "javascript:alert(1)",
      42,
    ])
      expect(safeMapReturn({ mapReturn: value })).toBeUndefined();
    expect(safeMapReturn(null)).toBeUndefined();
  });
  it("sends supported map filters and explicit UTC date boundaries", async () => {
    let url: URL | undefined;
    server.use(
      http.get("/api/v1/map/events", ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json({ items: [], truncated: false });
      }),
    );
    const client = new QueryClient();
    await client.fetchQuery(
      mapEventsQuery("49,53,51,54", "run", "viewer", {
        from: "2026-11-01",
        to: "2026-11-30",
      }),
    );
    expect(url?.searchParams.get("from")).toBe("2026-11-01T00:00:00Z");
    expect(url?.searchParams.get("to")).toBe("2026-11-30T23:59:59.999Z");
    expect(url?.searchParams.get("sportId")).toBe("run");
    expect(url?.searchParams.has("city")).toBe(false);
    client.clear();
  });
  it("keeps unpinned addresses readable without guessing coordinates", () => {
    render(
      <MemoryRouter>
        <EventLocation
          eventId="event"
          location={{ city: "Самара", address: "Вход в парк" }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Точная точка не указана/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Показать место на карте" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Открыть карту района" }),
    ).not.toBeInTheDocument();
  });
  it("loads the organizer's actual point on demand and links to it with map context", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <EventLocation
          eventId="event"
          location={{
            city: "Самара",
            address: "Площадь",
            latitude: 53.195561,
            longitude: 50.101022,
          }}
          mapReturn="/map?sportId=run&venueId=old&events=off"
        />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Показать место на карте" }),
    );
    expect(
      await screen.findByRole("img", { name: "Точка 53.195561, 50.101022" }),
    ).toBeVisible();
    const href = screen
      .getByRole("link", { name: "Открыть карту района" })
      .getAttribute("href")!;
    const params = new URL(href, "http://localhost").searchParams;
    expect(params.get("sportId")).toBe("run");
    expect(params.get("eventId")).toBe("event");
    expect(params.has("venueId")).toBe(false);
    expect(params.has("events")).toBe(false);
    await user.click(
      screen.getByRole("button", { name: "Скрыть карту места" }),
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
