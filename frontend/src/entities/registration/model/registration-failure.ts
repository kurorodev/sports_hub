export type RegistrationFailureCode =
  | "network"
  | "unauthenticated"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "invalid-input"
  | "already-registered"
  | "full"
  | "closed"
  | "organizer"
  | "unsupported-mode"
  | "unavailable"
  | "invalid-response"
  | "unknown";

/** Transport-independent failures consumed by the application and presentation layers. */
export class RegistrationFailure extends Error {
  constructor(
    public readonly code: RegistrationFailureCode,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "RegistrationFailure";
  }
}
