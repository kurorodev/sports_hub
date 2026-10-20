import { describe, expect, it } from "vitest";
import {
  distanceMeters,
  distanceParams,
  distanceRadii,
  formatDistance,
  withinDistance,
} from "../shared/lib/distance";
import { activityViewHref } from "../shared/lib/activity-navigation";
import { eventsQuery, mapEventsQuery } from "../entities/event";

describe("event distance", () => {
  it("measures short distances, antimeridian and poles without numerical errors", () => {
    const origin = { latitude: 0, longitude: 0 };
    expect(distanceMeters(origin, origin)).toBe(0);
    expect(
      distanceMeters(origin, {
        latitude: ((100 / 6371000) * 180) / Math.PI,
        longitude: 0,
      }),
    ).toBeCloseTo(100, 6);
    expect(
      distanceMeters(
        { latitude: 0, longitude: 179.9995 },
        { latitude: 0, longitude: -179.9995 },
      ),
    ).toBeCloseTo(111.195, 2);
    expect(
      distanceMeters(
        { latitude: 90, longitude: 0 },
        { latitude: 90, longitude: 180 },
      ),
    ).toBeLessThan(0.001);
    expect(formatDistance(240)).toBe("240 м");
    expect(formatDistance(2000)).toBe("2 км");
    expect(distanceRadii.at(-1)).toBe(5000);
  });
  it("only sends in-memory coordinates with a radius and waits for consent before fetching", () => {
    const params = new URLSearchParams("radiusMeters=100&city=Самара");
    const origin = { latitude: 53.2, longitude: 50.1 };
    expect(distanceParams(params, origin).get("originLatitude")).toBe("53.2");
    expect(params.has("originLatitude")).toBe(false);
    expect(
      distanceParams(new URLSearchParams(), origin).has("originLatitude"),
    ).toBe(false);
    expect(eventsQuery(params).enabled).toBe(false);
    expect(eventsQuery(params, origin).enabled).toBe(true);
    expect(
      mapEventsQuery(
        "49,53,51,54",
        "",
        undefined,
        {},
        { radius: "100", origin: null },
      ).enabled,
    ).toBe(false);
    const map = activityViewHref("map", params);
    expect(map).toContain("radiusMeters=100");
    expect(map).not.toContain("originLatitude");
    expect(activityViewHref("list", params)).toContain("radiusMeters=100");
    expect(
      withinDistance(
        { latitude: null, longitude: null },
        distanceParams(params, origin),
      ),
    ).toBe(false);
    expect(withinDistance(origin, distanceParams(params, origin))).toBe(true);
  });
});
