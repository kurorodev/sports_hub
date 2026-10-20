import { ApiError, type HttpClient } from "../../../shared/api/client";
import {
  RegistrationFailure,
  type RegistrationFailureCode,
  type RegistrationRepository,
} from "../model";
import {
  toParticipantPage,
  toRegistration,
  toRegistrationPage,
} from "./mappers";
import type { RegistrationDecisionRequest } from "../../../shared/api/types";

const codeMap: Record<string, RegistrationFailureCode> = {
  ALREADY_REGISTERED: "already-registered",
  EVENT_FULL: "full",
  EVENT_NOT_AVAILABLE: "closed",
  NOT_EVENT_ORGANIZER: "forbidden",
  INVALID_STATUS_TRANSITION: "conflict",
};
const statusMap: Record<number, RegistrationFailureCode> = {
  0: "network",
  401: "unauthenticated",
  403: "forbidden",
  404: "not-found",
  409: "conflict",
  400: "invalid-input",
  422: "invalid-input",
};

async function adaptFailure<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "AbortError"
    )
      throw error;
    if (error instanceof RegistrationFailure) throw error;
    if (error instanceof ApiError) {
      const knownCode =
        error.body?.code && Object.hasOwn(codeMap, error.body.code)
          ? codeMap[error.body.code]
          : undefined;
      const code =
        knownCode ||
        statusMap[error.status] ||
        (error.status >= 500 ? "unavailable" : "unknown");
      throw new RegistrationFailure(code, { cause: error });
    }
    throw new RegistrationFailure("unknown", { cause: error });
  }
}

export function createHttpRegistrationRepository(
  http: HttpClient,
): RegistrationRepository {
  const path = (id: string) => `/events/${encodeURIComponent(id)}`;
  return {
    listRequests: (eventId, page, status, signal) =>
      adaptFailure(async () => {
        const params = new URLSearchParams({ page: String(page), size: "12" });
        if (status) params.set("status", status);
        return toRegistrationPage(
          await http(`${path(eventId)}/registrations?${params}`, { signal }),
        );
      }),
    decide: (eventId, registrationId, decision) =>
      adaptFailure(async () => {
        const body: RegistrationDecisionRequest = {
          decision: decision.outcome === "accept" ? "APPROVE" : "REJECT",
          ...(decision.reason ? { reason: decision.reason } : {}),
        };
        return toRegistration(
          await http(
            `${path(eventId)}/registrations/${encodeURIComponent(registrationId)}/decision`,
            { method: "POST", body: JSON.stringify(body) },
          ),
        );
      }),
    findMine: (eventId, signal) =>
      adaptFailure(async () => {
        let dto: unknown;
        try {
          dto = await http(`${path(eventId)}/my-registration`, { signal });
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) return null;
          throw error;
        }
        return toRegistration(dto);
      }),
    listParticipants: (eventId, page, signal) =>
      adaptFailure(async () =>
        toParticipantPage(
          await http(`${path(eventId)}/participants?page=${page}&size=12`, {
            signal,
          }),
        ),
      ),
    cancel: (eventId) =>
      adaptFailure(async () =>
        toRegistration(await http(`${path(eventId)}/registrations/me`, { method: "DELETE" })),
      ),
    join: (eventId) =>
      adaptFailure(async () =>
        toRegistration(
          await http(`${path(eventId)}/registrations`, {
            method: "POST",
            body: "{}",
          }),
        ),
      ),
  };
}
