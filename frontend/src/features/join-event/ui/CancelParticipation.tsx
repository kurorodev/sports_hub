import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  registrationKeys,
  registrationErrorMessage,
  useRegistrationRepository,
} from "../../../entities/registration";
import { RegistrationFailure } from "../../../entities/registration/model";
import { sessionQuery } from "../../../entities/session";
import { Dialog } from "../../../shared/ui/Dialog";
import { tr } from "../../../shared/i18n/translate";

export function CancelParticipation({
  eventId,
  viewerId,
}: {
  eventId: string;
  viewerId: string;
}) {
  const [confirm, setConfirm] = useState(false);
  const titleId = useId();
  const repository = useRegistrationRepository();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const registration = await repository.cancel(eventId);
      if (
        registration.eventId !== eventId ||
        registration.participant.id !== viewerId ||
        registration.status !== "CANCELLED"
      )
        throw new RegistrationFailure("invalid-response");
      return registration;
    },
    onSuccess: async (registration) => {
      if (client.getQueryData(sessionQuery.queryKey)?.user.id !== viewerId)
        return;
      setConfirm(false);
      client.setQueryData(
        registrationKeys.mine(eventId, viewerId),
        registration,
      );
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
        ["registrations", eventId],
        ["events"],
        ["map", "events"],
        ["my-events"],
        ["recommendations"],
        ["notifications"],
      ].map((queryKey) => client.invalidateQueries({ queryKey })),
    );
  }
  return (
    <>
      <button
        className="button secondary"
        onClick={() => {
          mutation.reset();
          setConfirm(true);
        }}
      >
        {tr("Отменить участие")}
      </button>
      {confirm && (
        <Dialog
          labelledBy={titleId}
          className="cancel-participation-dialog"
          onClose={() => {
            if (!mutation.isPending) setConfirm(false);
          }}
        >
          <h2 id={titleId}>{tr("Отменить участие?")}</h2>
          <p>
            {tr(
              "Ваша запись или заявка будет отменена. Освободившееся место сможет занять другой участник.",
            )}
          </p>
          {mutation.isError && (
            <p className="field-error" role="alert">
              {registrationErrorMessage(mutation.error)}
            </p>
          )}
          <div className="participation-dialog-actions">
            <button
              autoFocus
              className="button secondary"
              disabled={mutation.isPending}
              onClick={() => setConfirm(false)}
            >
              {tr("Оставить участие")}
            </button>
            <button
              className="button danger-button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending
                ? tr("Отменяем…")
                : tr("Да, отменить участие")}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
