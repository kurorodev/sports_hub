import {
  ModerationFailure,
  type ModerationRepository,
} from "../../../entities/moderation/model";
export type ModerationAction =
  | { kind: "event"; id: string; reason: string; viewerId: string }
  | {
      kind: "comment";
      id: string;
      eventId: string;
      reason: string;
      viewerId: string;
    };
export async function moderateContent(
  repo: ModerationRepository,
  input: ModerationAction,
) {
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 1000)
    throw new ModerationFailure("invalid-input");
  if (input.kind === "event") {
    const event = await repo.unpublish(input.id, reason);
    if (
      event.id !== input.id ||
      event.status !== "UNPUBLISHED" ||
      event.reason !== reason
    )
      throw new ModerationFailure("invalid-response");
    return { kind: "event" as const, event };
  }
  const comment = await repo.hide(input.id, reason);
  if (
    comment.id !== input.id ||
    comment.eventId !== input.eventId ||
    comment.status !== "HIDDEN"
  )
    throw new ModerationFailure("invalid-response");
  return { kind: "comment" as const, comment };
}
