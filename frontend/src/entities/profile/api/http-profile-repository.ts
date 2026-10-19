import { ApiError, type HttpClient } from "../../../shared/api/client";
import {
  ProfileFailure,
  type ProfileFailureCode,
  type ProfileRepository,
} from "../model";
import { readProfile, profilePatch } from "./mappers";
async function translate<T>(operation: () => Promise<T>): Promise<T> {
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
    if (error instanceof ProfileFailure) throw error;
    const codes: Record<number, ProfileFailureCode> = {
      0: "network",
      400: "invalid-input",
      401: "unauthenticated",
      403: "forbidden",
      404: "not-found",
      409: "conflict",
      422: "invalid-input",
    };
    throw new ProfileFailure(
      error instanceof ApiError
        ? (codes[error.status] ??
            (error.status >= 500 ? "unavailable" : "unknown"))
        : "unknown",
      { cause: error },
    );
  }
}
export function createHttpProfileRepository(
  http: HttpClient,
): ProfileRepository {
  return {
    own: (signal) =>
      translate(async () => readProfile(await http("/me/profile", { signal }))),
    find: (id, signal) =>
      translate(async () => {
        const result = readProfile(
          await http(`/users/${encodeURIComponent(id)}`, { signal }),
        );
        if (result.id !== id) throw new ProfileFailure("invalid-response");
        return result;
      }),
    update: (changes) =>
      translate(async () =>
        readProfile(
          await http("/me/profile", {
            method: "PATCH",
            body: JSON.stringify(profilePatch(changes)),
          }),
        ),
      ),
  };
}
