import { ApiError, type HttpClient } from "../../../shared/api/client";
import {
  RegistrationFailure,
  type RegistrationFailureCode,
  type RegistrationRepository,
} from "../model";
import { toParticipantPage, toRegistration } from "./mappers";

const codeMap: Record<string, RegistrationFailureCode> = {
  ALREADY_REGISTERED: "already-registered",
  EVENT_FULL: "full",
  EVENT_NOT_AVAILABLE: "closed",
  ORGANIZER_CANNOT_JOIN: "organizer",
  REGISTRATION_MODE_UNAVAILABLE: "unsupported-mode",
};
const statusMap: Record<number, RegistrationFailureCode> = {
  0: "network",
  401: "unauthenticated",
  403: "forbidden",
  404: "not-found",
  409: "conflict",
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
    join: (eventId) =>
      adaptFailure(async () =>
        toRegistration(
          await http(`${path(eventId)}/registrations`, { method: "POST" }),
        ),
      ),
  };
}
