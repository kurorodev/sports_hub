import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";
import { reviewRegistration } from "../features/review-registrations/model/review-registration";
import { RegistrationRequests } from "../features/review-registrations";
import { RegistrationRepositoryProvider } from "../entities/registration";
import type {
  Registration,
  RegistrationRepository,
} from "../entities/registration/model";
import { RegistrationFailure } from "../entities/registration/model";
import { sessionQuery } from "../entities/session";
import { makeSession } from "../mocks/database";

const pending: Registration = {
  id: "reg-1",
  eventId: "event-1",
  participant: { id: "maria", displayName: "Мария" },
  status: "PENDING",
  registeredAt: "2026-10-19T12:00:00Z",
};
const input = {
  eventId: pending.eventId,
  registrationId: pending.id,
  participantId: pending.participant.id,
  viewerId: "owner",
  decision: { outcome: "accept" as const },
};
const confirmed: Registration = { ...pending, status: "CONFIRMED" };
function repository(result = confirmed): RegistrationRepository {
  return {
    join: vi.fn(),
    findMine: vi.fn(),
    listParticipants: vi.fn(),
    listRequests: vi.fn(),
    decide: vi.fn(async () => result),
  };
}

describe("review application core", () => {
  it("accepts only the server's corresponding decision", async () => {
    const repo = repository();
    expect(await reviewRegistration(repo, input)).toEqual(confirmed);
    expect(repo.decide).toHaveBeenCalledExactlyOnceWith(
      input.eventId,
      input.registrationId,
      input.decision,
    );
    const rejected = {
      ...pending,
      status: "REJECTED" as const,
      decisionReason: "Другая группа",
    };
    expect(
      await reviewRegistration(repository(rejected), {
        ...input,
        decision: { outcome: "decline", reason: "Другая группа" },
      }),
    ).toEqual(rejected);
  });
  it.each([
    { ...confirmed, eventId: "other" },
    { ...confirmed, id: "other" },
    { ...confirmed, participant: { id: "other", displayName: "Другой" } },
    { ...confirmed, status: "PENDING" as const },
  ])("rejects a wrong identity or unchanged status", async (result) => {
    await expect(
      reviewRegistration(repository(result), input),
    ).rejects.toMatchObject({ code: "invalid-response" });
  });
  it("propagates the server capacity conflict without assigning a client status", async () => {
    const repo = repository();
    repo.decide = vi.fn(async () => {
      throw new RegistrationFailure("full");
    });
    await expect(reviewRegistration(repo, input)).rejects.toMatchObject({
      code: "full",
    });
  });
});

it("does not announce a late organizer decision in a new account", async () => {
  let finish: ((value: Registration) => void) | undefined;
  const response = new Promise<Registration>((resolve) => {
    finish = resolve;
  });
  const repo = repository();
  repo.decide = vi.fn(() => response);
  let hasRequests = true;
  repo.listRequests = vi.fn(async () => ({
    registrations: hasRequests ? [pending] : [],
    pageIndex: 0,
    pageSize: 12,
    totalCount: hasRequests ? 1 : 0,
  }));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(sessionQuery.queryKey, makeSession("user-alex"));
  render(
    <RegistrationRepositoryProvider repository={repo}>
      <QueryClientProvider client={client}>
        <RegistrationRequests eventId={pending.eventId} decisionsOpen />
      </QueryClientProvider>
    </RegistrationRepositoryProvider>,
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "Одобрить" }),
  );
  await act(async () => {
    hasRequests = false;
    client.setQueryData(sessionQuery.queryKey, makeSession("user-maria"));
  });
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Одобрить" }),
    ).not.toBeInTheDocument(),
  );
  await act(async () => {
    finish!(confirmed);
    await response;
  });
  expect(screen.queryByText(/Решение сохранено/)).not.toBeInTheDocument();
});
