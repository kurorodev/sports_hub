import {
  RegistrationFailure,
  type RegistrationRepository,
  type RegistrationDecision,
  type Registration,
} from "../../../entities/registration/model";

export interface ReviewRegistrationInput {
  eventId: string;
  registrationId: string;
  participantId: string;
  viewerId: string;
  decision: RegistrationDecision;
}
export async function reviewRegistration(
  repository: RegistrationRepository,
  input: ReviewRegistrationInput,
): Promise<Registration> {
  const registration = await repository.decide(
    input.eventId,
    input.registrationId,
    input.decision,
  );
  const expected =
    input.decision.outcome === "accept" ? "CONFIRMED" : "REJECTED";
  if (
    registration.eventId !== input.eventId ||
    registration.id !== input.registrationId ||
    registration.participant.id !== input.participantId ||
    registration.status !== expected
  )
    throw new RegistrationFailure("invalid-response");
  return registration;
}
