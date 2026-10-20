import { useMutation, useQueryClient } from "@tanstack/react-query";
import { profileKeys, useProfileRepository } from "../../../entities/profile";
import type { Profile, ProfileDraft } from "../../../entities/profile/model";
import { sessionQuery } from "../../../entities/session";
import { updateProfile } from "../model/update-profile";
export function useUpdateProfile(onSaved: (profile: Profile) => void) {
  const repo = useProfileRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      viewerId,
      draft,
    }: {
      viewerId: string;
      draft: ProfileDraft;
    }) => updateProfile(repo, viewerId, draft),
    onSuccess: async (profile, input) => {
      if (
        client.getQueryData(sessionQuery.queryKey)?.user.id !== input.viewerId
      )
        return;
      await client.cancelQueries({ queryKey: ["profiles"] });
      if (
        client.getQueryData(sessionQuery.queryKey)?.user.id !== input.viewerId
      )
        return;
      client.setQueryData(profileKeys.own(profile.id), profile);
      client.setQueryData(profileKeys.public(profile.id), profile);
      onSaved(profile);
      await Promise.all([
        client.invalidateQueries({ queryKey: sessionQuery.queryKey }),
        ...[
          ["events"],
          ["map", "events"],
          ["registrations"],
          ["comments"],
          ["organizations"],
          ["moderation"],
          ["questionnaire", profile.id],
          ["recommendations", profile.id],
        ].map((queryKey) => client.invalidateQueries({ queryKey })),
      ]);
    },
  });
}
