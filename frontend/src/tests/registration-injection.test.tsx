import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import {
  RegistrationRepositoryProvider,
  registrationKeys,
} from "../entities/registration";
import type {
  Registration,
  RegistrationRepository,
} from "../entities/registration/model";
import { sessionQuery } from "../entities/session";
import { JoinAction } from "../features/join-event";
import type { Session } from "../shared/api/types";

const event = {
  eventId: "event-1",
  organizer: false,
  openForRegistration: true,
  participantLimit: 2,
  confirmedParticipants: 0,
  pendingParticipants: 0,
  joinMode: "OPEN" as const,
};
const registration: Registration = {
  id: "reg-1",
  eventId: event.eventId,
  participant: { id: "maria", displayName: "Мария" },
  status: "CONFIRMED",
  registeredAt: "2026-10-19T12:00:00Z",
};
const session = (id: string): Session => ({
  user: {
    id,
    displayName: id,
    nickname: id,
    sportsRoles: [],
    rank: "ROOKIE",
    ratingPoints: 0,
    sportsPreferences: [],
    createdAt: "2026-10-19T12:00:00Z",
  },
  systemRoles: ["USER"],
  manageableOrganizationIds: [],
  csrfToken: "test",
  demo: true,
});

function mount(repository: RegistrationRepository) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(sessionQuery.queryKey, session("maria"));
  render(
    <RegistrationRepositoryProvider repository={repository}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <JoinAction event={event} />
        </MemoryRouter>
      </QueryClientProvider>
    </RegistrationRepositoryProvider>,
  );
  return client;
}

describe("React adapter with an injected repository, without HTTP", () => {
  it("runs the scenario and shows only repository-confirmed participation", async () => {
    let saved: Registration | null = null;
    const repository: RegistrationRepository = {
      findMine: vi.fn(async () => saved),
      listRequests: vi.fn(),
      decide: vi.fn(),
      join: vi.fn(async () => {
        saved = registration;
        return saved;
      }),
      listParticipants: vi.fn(),
    };
    mount(repository);
    await userEvent.click(
      await screen.findByRole("button", { name: "Присоединиться" }),
    );
    expect(await screen.findByText("Вы участвуете")).toBeInTheDocument();
    expect(repository.join).toHaveBeenCalledExactlyOnceWith(event.eventId);
  });

  it("does not put a late previous-account response into the new account cache", async () => {
    let finish: ((value: Registration) => void) | undefined;
    const pending = new Promise<Registration>((resolve) => {
      finish = resolve;
    });
    const repository: RegistrationRepository = {
      findMine: vi.fn(async () => null),
      listRequests: vi.fn(),
      decide: vi.fn(),
      join: vi.fn(() => pending),
      listParticipants: vi.fn(),
    };
    const client = mount(repository);
    await userEvent.click(
      await screen.findByRole("button", { name: "Присоединиться" }),
    );
    expect(
      await screen.findByRole("button", { name: "Записываем…" }),
    ).toBeDisabled();
    await act(async () => {
      client.setQueryData(sessionQuery.queryKey, session("alex"));
    });
    await waitFor(() =>
      expect(
        client.getQueryData(registrationKeys.mine(event.eventId, "alex")),
      ).toBeNull(),
    );
    await act(async () => {
      finish!(registration);
      await pending;
    });
    expect(
      await screen.findByRole("button", { name: "Присоединиться" }),
    ).toBeEnabled();
    expect(screen.queryByText("Вы участвуете")).not.toBeInTheDocument();
    expect(
      client.getQueryData(registrationKeys.mine(event.eventId, "alex")),
    ).toBeNull();
  });
});
