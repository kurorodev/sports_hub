import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { QueryClient } from "@tanstack/react-query";
import { server } from "./setup";
import { eventsQuery } from "../entities/event";
import { toEventParticipation } from "../entities/event/api/participation-mapper";
import { toRegistration } from "../entities/registration/api/mappers";
import { mockId, mockUser, getEvents } from "../mocks/database";
import {
  participantCount,
  eventTimezone,
} from "../entities/event/lib/presentation";

it("sends date filters with explicit UTC boundaries while keeping calendar values in the URL model", async () => {
  const uiParams = new URLSearchParams({
    from: "2026-10-24",
    to: "2026-10-25",
    skillLevel: "BEGINNER",
  });
  server.use(
    http.get("/api/v1/events", ({ request }) => {
      const params = new URL(request.url).searchParams;
      expect(params.get("from")).toBe("2026-10-24T00:00:00Z");
      expect(params.get("to")).toBe("2026-10-25T23:59:59.999Z");
      expect(params.get("skillLevel")).toBe("BEGINNER");
      expect(params.get("size")).toBe("6");
      return HttpResponse.json({
        items: [],
        page: 0,
        size: 6,
        total: 0,
        totalPages: 0,
      });
    }),
  );
  await new QueryClient().fetchQuery(eventsQuery(uiParams));
  expect(uiParams.get("from")).toBe("2026-10-24");
});

describe("Java DTO adaptation", () => {
  it.each(["PENDING", "CONFIRMED", "REJECTED", "CANCELLED", "WAITLISTED"])(
    "keeps server status %s instead of assuming confirmation",
    (status) => {
      const registration = toRegistration({
        id: mockId("reg"),
        eventId: mockId("event"),
        user: mockUser("maria", "Мария"),
        status,
        decisionReason: "Ответ организатора",
        createdAt: "2026-10-19T12:00:00Z",
        updatedAt: "2026-10-19T12:00:00Z",
      });
      expect(registration.status).toBe(status);
      expect(registration.decisionReason).toBe("Ответ организатора");
    },
  );
  it("uses server availability and handles unlimited participation without inventing a limit", () => {
    const event = { ...getEvents()[0], maxParticipants: null };
    const participation = toEventParticipation(event, {
      eventId: event.id,
      confirmedCount: 8,
      pendingCount: 0,
      waitlistedCount: 0,
      joinAvailable: false,
      waitlistAvailable: false,
    });
    expect(participation.openForRegistration).toBe(false);
    expect(participation.participantLimit).toBeNull();
    expect(participantCount(8, event.maxParticipants)).toBe(
      "Участников: 8 · без лимита",
    );
    expect(eventTimezone("2026-11-07T11:30:00Z")).toBe("UTC");
    expect(eventTimezone("2026-11-07T18:30:00+07:00")).toBe("UTC+07:00");
  });
});
