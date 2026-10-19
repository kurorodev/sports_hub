import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./setup";
import { ApiError, request } from "../shared/api/client";
import { createHttpRegistrationRepository } from "../entities/registration/api/http-registration-repository";
import {
  toParticipantPage,
  toRegistration,
} from "../entities/registration/api/mappers";
import { RegistrationFailure } from "../entities/registration/model";

const dto = {
  id: "reg-1",
  eventId: "event-1",
  user: {
    id: "maria",
    displayName: "Мария",
    nickname: "maria",
    sportsRoles: [],
    rank: "ROOKIE",
    ratingPoints: 0,
  },
  status: "CONFIRMED",
  createdAt: "2026-10-19T12:00:00Z",
  updatedAt: "2026-10-19T12:00:00Z",
};
const repository = createHttpRegistrationRepository(request);

describe("registration HTTP boundary", () => {
  it("maps DTOs to independent models and copies nested user data", () => {
    const model = toRegistration(dto);
    expect(model.participant).toEqual({ id: "maria", displayName: "Мария" });
    expect(model).not.toHaveProperty("user");
    expect(model).not.toHaveProperty("createdAt");
    dto.user.displayName = "Изменено";
    expect(model.participant.displayName).toBe("Мария");
    dto.user.displayName = "Мария";
    expect(
      toParticipantPage({
        items: [dto.user],
        page: 1,
        size: 12,
        total: 13,
        totalPages: 2,
      }),
    ).toEqual({
      participants: [{ id: "maria", displayName: "Мария" }],
      pageIndex: 1,
      pageSize: 12,
      totalCount: 13,
    });
  });
  it.each([
    {},
    { ...dto, status: "UNRECOGNIZED" },
    { ...dto, user: null },
    { ...dto, createdAt: "invalid" },
  ])(
    "rejects malformed registration instead of showing false confirmation",
    (value) => {
      expect(() => toRegistration(value)).toThrow(RegistrationFailure);
    },
  );
  it("treats only own-registration 404 as absence", async () => {
    server.use(
      http.get("/api/v1/events/event-1/my-registration", () =>
        HttpResponse.json({}, { status: 404 }),
      ),
      http.get("/api/v1/events/event-1/participants", () =>
        HttpResponse.json({}, { status: 404 }),
      ),
    );
    expect(await repository.findMine("event-1")).toBeNull();
    await expect(
      repository.listParticipants("event-1", 0),
    ).rejects.toMatchObject({ code: "not-found" });
  });
  it.each([
    [409, "EVENT_FULL", "full"],
    [409, "ALREADY_REGISTERED", "already-registered"],
    [403, "NOT_EVENT_ORGANIZER", "forbidden"],
    [503, "UNEXPECTED_CODE", "unavailable"],
    [503, "__proto__", "unavailable"],
    [401, "UNAUTHENTICATED", "unauthenticated"],
  ])(
    "maps HTTP %s/%s into an application failure",
    async (status, code, expected) => {
      server.use(
        http.post("/api/v1/events/event-1/registrations", () =>
          HttpResponse.json({ code, message: "API error" }, { status }),
        ),
      );
      await expect(repository.join("event-1")).rejects.toMatchObject({
        code: expected,
        cause: expect.any(ApiError),
      });
    },
  );
  it("preserves query cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      repository.findMine("event-1", controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
