import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionQuery } from "../../entities/session";
import { request, errorMessage } from "../../shared/api/client";
import type { EventPreview } from "../../shared/api/types";
import { Dialog } from "../../shared/ui/Dialog";
import { tr } from "../../shared/i18n/translate";
import { useNow } from "../../shared/lib/use-now";

export function CancelEvent({
  event,
  viewerId,
}: {
  event: EventPreview;
  viewerId: string;
}) {
  const [confirm, setConfirm] = useState(false);
  const titleId = useId();
  const now = useNow();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const result = await request<EventPreview>(
        `/events/${encodeURIComponent(event.id)}/cancel`,
        { method: "POST" },
      );
      if (
        result.id !== event.id ||
        !result.cancelledAt ||
        result.status !== "UNPUBLISHED"
      )
        throw new Error("Invalid cancellation response");
      return result;
    },
    onSuccess: async () => {
      if (client.getQueryData(sessionQuery.queryKey)?.user.id !== viewerId)
        return;
      setConfirm(false);
      await refresh();
    },
    onError: async () => {
      if (client.getQueryData(sessionQuery.queryKey)?.user.id === viewerId)
        await refresh();
    },
  });
  function refresh() {
    return Promise.all(
      [
        ["events"],
        ["map", "events"],
        ["my-events"],
        ["recommendations"],
        ["registrations", event.id],
        ["notifications"],
      ].map((queryKey) => client.invalidateQueries({ queryKey })),
    );
  }
  if (
    !event.viewerIsOrganizer ||
    event.cancelledAt ||
    !["PUBLISHED", "DRAFT"].includes(event.status) ||
    Date.parse(event.startsAt) <= now
  )
    return null;
  return (
    <>
      <button
        className="button secondary"
        onClick={() => {
          mutation.reset();
          setConfirm(true);
        }}
      >
        {tr("Отменить мероприятие")}
      </button>
      {confirm && (
        <Dialog
          labelledBy={titleId}
          className="cancel-participation-dialog"
          onClose={() => {
            if (!mutation.isPending) setConfirm(false);
          }}
        >
          <h2 id={titleId}>{tr("Отменить мероприятие?")}</h2>
          <p className="cancel-event-title">{event.title}</p>
          <p>
            {tr(
              "Все участия и заявки будут отменены. Участники получат уведомление, а запись и обсуждение закроются. Восстановить мероприятие после отмены нельзя.",
            )}
          </p>
          {mutation.isError && (
            <p className="field-error" role="alert">
              {errorMessage(mutation.error)}
            </p>
          )}
          <div className="participation-dialog-actions">
            <button
              autoFocus
              className="button secondary"
              disabled={mutation.isPending}
              onClick={() => setConfirm(false)}
            >
              {tr("Оставить мероприятие")}
            </button>
            <button
              className="button danger-button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending
                ? tr("Отменяем…")
                : tr("Да, отменить мероприятие")}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
