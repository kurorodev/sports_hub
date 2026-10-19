import { afterEach, describe, expect, it, vi } from "vitest";
import { request, setCsrfToken, ApiError } from "../shared/api/client";
import type {
  Session,
  VenueMapItem,
  MapVenuesResponse,
  MapEventsResponse,
} from "../shared/api/types";
import { boundsToBbox, unpin } from "../shared/lib/map";
import { currentOccupancy, observationTime } from "../entities/venue";
import { demoSuggestion } from "../mocks/maps";
import { mockId } from "../mocks/database";

const bbox = "49.8,53.0,50.4,53.5";
const location = {
  city: demoSuggestion.city,
  address: demoSuggestion.address,
  latitude: demoSuggestion.latitude,
  longitude: demoSuggestion.longitude,
};
afterEach(() => vi.restoreAllMocks());
async function login(accountId = "user-alex") {
  const session = await request<Session>("/demo/session", {
    method: "POST",
    body: JSON.stringify({ accountId }),
  });
  setCsrfToken(session.csrfToken);
  return session;
}
async function create(name = "Новая площадка") {
  return request<VenueMapItem>("/map/venues", {
    method: "POST",
    body: JSON.stringify({ name, location }),
  });
}
async function report(venueId: string, level = "LOW", peopleCount = 5) {
  return request<VenueMapItem>(`/map/venues/${venueId}/reports`, {
    method: "POST",
    body: JSON.stringify({ level, peopleCount }),
  });
}

describe("map coordinates and occupancy", () => {
  it("serializes west,south,east,north and clears both coordinates on text edits", () => {
    expect(
      boundsToBbox({
        getWest: () => 49.8,
        getSouth: () => 53,
        getEast: () => 50.4,
        getNorth: () => 53.5,
      }),
    ).toBe("49.80000,53.00000,50.40000,53.50000");
    expect(unpin(location, "address", "Другой адрес")).toEqual({
      ...location,
      address: "Другой адрес",
      latitude: null,
      longitude: null,
    });
    expect(unpin(location, "city", "Москва").longitude).toBeNull();
  });
  it("never displays absent or expired reports as LOW and preserves historical timestamp", async () => {
    await login();
    const venue = await create();
    expect(currentOccupancy(venue)).toBe("UNKNOWN");
    expect(observationTime(venue)).toBe("Наблюдений пока нет");
    const updated = await report(venue.id);
    expect(currentOccupancy(updated)).toBe("LOW");
    expect(
      currentOccupancy(updated, Date.parse(updated.occupancy.validUntil!)),
    ).toBe("UNKNOWN");
    expect(
      observationTime(updated, Date.parse(updated.occupancy.validUntil!)),
    ).toContain("устарело");
  });
  it("requires login and CSRF, rejects spoofed owners, duplicates and invalid reports", async () => {
    await expect(create()).rejects.toMatchObject({ status: 401 });
    const session = await login();
    setCsrfToken();
    await expect(create()).rejects.toMatchObject({ status: 403 });
    setCsrfToken(session.csrfToken);
    const venue = await create();
    expect(venue).not.toHaveProperty("createdBy");
    await expect(create()).rejects.toMatchObject({ status: 409 });
    await expect(
      request("/map/venues", {
        method: "POST",
        body: JSON.stringify({
          name: "Другая площадка",
          location,
          createdBy: session.user.id,
        }),
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(report(venue.id, "UNKNOWN")).rejects.toMatchObject({
      status: 400,
    });
    await expect(report(venue.id, "LOW", 1001)).rejects.toMatchObject({
      status: 400,
    });
    await expect(report(mockId("missing"))).rejects.toMatchObject({
      status: 404,
    });
  });
  it("aggregates latest observations per account with upper median, cooldown and TTL", async () => {
    const now = Date.parse("2026-10-19T12:00:00Z"),
      clock = vi.spyOn(Date, "now").mockReturnValue(now);
    await login();
    const venue = await create();
    expect((await report(venue.id)).occupancy.level).toBe("LOW");
    await expect(report(venue.id, "HIGH")).rejects.toMatchObject({
      status: 429,
    });
    await login("user-maria");
    const updated = await report(venue.id, "HIGH");
    expect(updated.occupancy.level).toBe("HIGH");
    expect(updated.occupancy.reportsCount).toBe(2);
    clock.mockReturnValue(now + 90 * 60_000);
    const items = (await request<MapVenuesResponse>(`/map/venues?bbox=${bbox}`))
      .items;
    const expired = items.find((item) => item.id === venue.id)!;
    expect(expired.occupancy.level).toBe("UNKNOWN");
    expect(expired.occupancy.reportsCount).toBe(0);
    expect(expired.occupancy.lastReportedAt).toBeTruthy();
  });
  it("map events contain only published future events with coordinates in bbox", async () => {
    const session = await login();
    const body = {
      title: "Встреча на карте",
      description: "Объясняем правила и занимаемся вместе",
      sport: { customName: "Геоспорт" },
      startsAt: "2099-01-01T15:00:00+04:00",
      location,
      skillLevel: "ANY",
      eventKind: "ACTIVITY",
      joinMode: "OPEN",
      maxParticipants: 10,
      organizer: { type: "USER", id: session.user.id },
    };
    const published = await request<{ id: string }>("/events", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const draft = await request<{ id: string }>("/events", {
      method: "POST",
      body: JSON.stringify({ ...body, publishNow: false }),
    });
    const noPoint = await request<{ id: string }>("/events", {
      method: "POST",
      body: JSON.stringify({
        ...body,
        location: { city: "Самара", address: "Без точки" },
      }),
    });
    const result = await request<MapEventsResponse>(`/map/events?bbox=${bbox}`);
    expect(result.items.map((item) => item.id)).toContain(published.id);
    expect(result.items.map((item) => item.id)).not.toContain(draft.id);
    expect(result.items.map((item) => item.id)).not.toContain(noPoint.id);
    const outside = await request<MapEventsResponse>(
      "/map/events?bbox=30,50,31,51",
    );
    expect(outside.items).toHaveLength(0);
    const truncated = await request<MapVenuesResponse>(
      `/map/venues?bbox=${bbox}&limit=1`,
    );
    expect(truncated.truncated).toBe(true);
    await expect(
      request(`/map/events?bbox=${bbox}&limit=501`),
    ).rejects.toBeInstanceOf(ApiError);
    await login("admin");
    await request(`/admin/events/${published.id}/unpublish`, {
      method: "POST",
      body: JSON.stringify({ reason: "Площадка закрыта на ремонт" }),
    });
    const moderated = await request<MapEventsResponse>(
      `/map/events?bbox=${bbox}`,
    );
    expect(moderated.items.map((item) => item.id)).not.toContain(published.id);
  });
});
