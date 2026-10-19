import { describe, expect, it, vi } from "vitest";
import {
  findMyRegistration,
  joinEvent,
} from "../features/join-event/model/join-event";
import {
  RegistrationFailure,
  type Registration,
  type RegistrationRepository,
} from "../entities/registration/model";

const input = { eventId: "event-1", viewerId: "maria" };
const registration: Registration = {
  id: "reg-1",
  eventId: input.eventId,
  participant: { id: input.viewerId, displayName: "Мария" },
  status: "CONFIRMED",
  registeredAt: "2026-10-19T12:00:00Z",
};

function repository(result: Registration | null): RegistrationRepository {
  return {
    listRequests: vi.fn(),
    decide: vi.fn(),
    join: vi.fn(async () => {
      if (!result) throw new RegistrationFailure("full");
      return result;
    }),
    findMine: vi.fn(async () => result),
    listParticipants: vi.fn(async () => ({
      participants: [],
      pageIndex: 0,
      pageSize: 12,
      totalCount: 0,
    })),
  };
}

describe("registration use cases without React or HTTP", () => {
  it("confirms only the requested participant/event returned by the injected repository", async () => {
    const port = repository(registration);
    expect(await joinEvent(port, input)).toEqual(registration);
    expect(port.join).toHaveBeenCalledExactlyOnceWith(input.eventId);
  });
  it.each([
    { ...registration, eventId: "other-event" },
    {
      ...registration,
      participant: { id: "other-user", displayName: "Другой пользователь" },
    },
  ])("rejects a response for another event or account", async (result) => {
    const port = repository(result);
    await expect(joinEvent(port, input)).rejects.toMatchObject({
      code: "invalid-response",
    });
    await expect(findMyRegistration(port, input)).rejects.toMatchObject({
      code: "invalid-response",
    });
  });
  it("keeps absence distinct from failure and propagates a server rejection", async () => {
    const port = repository(null);
    expect(await findMyRegistration(port, input)).toBeNull();
    await expect(joinEvent(port, input)).rejects.toMatchObject({
      code: "full",
    });
  });
});

it("accepts APPROVAL only as a pending application, never as immediate confirmation", async () => {
  const approvalInput = { ...input, joinMode: "APPROVAL" as const };
  const pending = { ...registration, status: "PENDING" as const };
  expect(await joinEvent(repository(pending), approvalInput)).toEqual(pending);
  await expect(
    joinEvent(repository(registration), approvalInput),
  ).rejects.toMatchObject({ code: "invalid-response" });
});
