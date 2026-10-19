import {
  CommentFailure,
  type CommentRepository,
  type DiscussionComment,
} from "../../../entities/comment/model";
export interface PublishCommentInput {
  eventId: string;
  viewerId: string;
  text: string;
}
export async function publishComment(
  repository: CommentRepository,
  input: PublishCommentInput,
): Promise<DiscussionComment> {
  const text = input.text.trim();
  if (!text || text.length > 2000) throw new CommentFailure("invalid-input");
  const comment = await repository.publish(input.eventId, text);
  if (
    comment.eventId !== input.eventId ||
    comment.author.id !== input.viewerId ||
    comment.visibility !== "visible" ||
    comment.text !== text
  )
    throw new CommentFailure("invalid-response");
  return comment;
}
