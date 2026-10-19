import {
  RegistrationFailure,
  type Registration,
  type RegistrationRepository,
} from "../../../entities/registration/model";

export interface JoinEventInput {
  eventId: string;
  viewerId: string;
}

function verifyIdentity(
  registration: Registration,
  input: JoinEventInput,
): Registration {
  // A session may change while a request is in flight. Never confirm another user's response.
  if (
    registration.eventId !== input.eventId ||
    registration.participant.id !== input.viewerId
  ) {
    throw new RegistrationFailure("invalid-response");
  }
  return registration;
}

export async function joinEvent(
  repository: RegistrationRepository,
  input: JoinEventInput,
): Promise<Registration> {
  return verifyIdentity(await repository.join(input.eventId), input);
}

export async function findMyRegistration(
  repository: RegistrationRepository,
  input: JoinEventInput,
  signal?: AbortSignal,
): Promise<Registration | null> {
  const registration = await repository.findMine(input.eventId, signal);
  return registration ? verifyIdentity(registration, input) : null;
}
