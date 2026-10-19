import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionQuery } from "../../../entities/session";
import {
  moderationKeys,
  useModerationRepository,
} from "../../../entities/moderation";
import { commentKeys } from "../../../entities/comment";
import {
  moderateContent,
  type ModerationAction,
} from "../model/moderate-content";
export function useModerateContent(onDone: () => void) {
  const repo = useModerationRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ModerationAction) => moderateContent(repo, input),
    onSuccess: async (result, input) => {
      if (
        client.getQueryData(sessionQuery.queryKey)?.user.id !== input.viewerId
      )
        return;
      onDone();
      await Promise.all([
        client.invalidateQueries({ queryKey: moderationKeys.all }),
        client.invalidateQueries({
          queryKey: commentKeys.event(
            result.kind === "event" ? result.event.id : result.comment.eventId,
          ),
        }),
        ...(result.kind === "event"
          ? [
              client.invalidateQueries({ queryKey: ["events"] }),
              client.invalidateQueries({ queryKey: ["map", "events"] }),
              client.invalidateQueries({ queryKey: ["registrations"] }),
            ]
          : []),
      ]);
    },
  });
}
