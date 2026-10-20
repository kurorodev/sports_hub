import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sessionQuery } from "../../../entities/session";
import { registrationKeys } from "../../../entities/registration";
import { useRegistrationRepository } from "../../../entities/registration";
import { joinEvent, type JoinEventInput } from "../model/join-event";
import { myRegistrationQuery } from "./queries";
import { useEffect } from "react";

export function useJoinEvent(eventId: string, joinMode: "OPEN" | "APPROVAL") {
  const session = useQuery(sessionQuery);
  const viewerId = session.data?.user.id;
  const repository = useRegistrationRepository();
  const ownQuery = myRegistrationQuery(repository, eventId, viewerId);
  const own = useQuery(ownQuery);
  const client = useQueryClient();
  const ownStatus = own.data?.status;
  useEffect(() => {
    if (!ownStatus) return;
    // Решение по заявке меняет и список участников, и счётчики события; обновляем связанные запросы.
    void client.invalidateQueries({ queryKey: ["events"] });
    void client.invalidateQueries({ queryKey: ["map", "events"] });
    void client.invalidateQueries({
      queryKey: [...registrationKeys.event(eventId), "participants"],
    });
  }, [client, eventId, ownStatus]);
  const refresh = (targetEventId: string) =>
    Promise.all([
      client.invalidateQueries({ queryKey: ["events"] }),
      client.invalidateQueries({ queryKey: ["map", "events"] }),
      client.invalidateQueries({ queryKey: ["notifications"] }),
      client.invalidateQueries({ queryKey: ["my-events"] }),
      client.invalidateQueries({ queryKey: ["recommendations"] }),
      client.invalidateQueries({
        queryKey: registrationKeys.event(targetEventId),
      }),
    ]);
  const mutation = useMutation({
    mutationFn: (input: JoinEventInput) => joinEvent(repository, input),
    onSuccess: async (registration, input) => {
      if (
        client.getQueryData(sessionQuery.queryKey)?.user.id !== input.viewerId
      )
        return;
      client.setQueryData(
        registrationKeys.mine(input.eventId, input.viewerId),
        registration,
      );
      await refresh(input.eventId);
    },
    onError: async (_error, input) => {
      if (
        client.getQueryData(sessionQuery.queryKey)?.user.id === input.viewerId
      )
        await refresh(input.eventId);
    },
  });
  const join = () => {
    if (viewerId) mutation.mutate({ eventId, viewerId, joinMode });
  };
  return { session, viewerId, own, mutation, join };
}
