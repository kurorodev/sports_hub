import { Textarea } from "../../../shared/ui/Textarea";
import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, X } from "lucide-react";
import {
  registrationErrorMessage,
  registrationPresentation,
} from "../../../entities/registration";
import {
  RegistrationFailure,
  type Registration,
  type RegistrationDecision,
} from "../../../entities/registration/model";
import { FormField } from "../../../shared/ui/FormField";
import { useReviewRegistration } from "./use-review-registration";
const reasonSchema = z.object({
  reason: z.string().trim().max(1000, "Причина — до 1000 символов"),
});
type ReasonForm = z.infer<typeof reasonSchema>;
export function RequestRow({
  registration,
  viewerId,
  decisionsOpen,
  onDecided,
}: {
  registration: Registration;
  viewerId: string;
  decisionsOpen: boolean;
  onDecided: (registration: Registration) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const cancelTarget = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const mutation = useReviewRegistration(onDecided);
  const form = useForm<ReasonForm>({
    resolver: zodResolver(reasonSchema),
    defaultValues: { reason: "" },
  });
  useEffect(() => {
    if (rejecting) form.setFocus("reason");
    else if (restoreFocus.current) {
      cancelTarget.current?.focus();
      restoreFocus.current = false;
    }
  }, [rejecting, form]);
  const presentation = registrationPresentation[registration.status];
  const decide = (decision: RegistrationDecision) =>
    mutation.mutate({
      eventId: registration.eventId,
      registrationId: registration.id,
      participantId: registration.participant.id,
      viewerId,
      decision,
    });
  const { Icon } = presentation;
  return (
    <li
      className="request-card"
      aria-label={`Заявка: ${registration.participant.displayName}`}
    >
      <div className="request-heading">
        <h3>{registration.participant.displayName}</h3>
        <span className={`card-registration ${presentation.tone}`}>
          <Icon size={16} />
          {presentation.organizerLabel}
        </span>
      </div>
      {registration.message && (
        <p className="request-message">{registration.message}</p>
      )}
      {registration.decisionReason && (
        <p className="request-message">
          <strong>Причина решения: </strong>
          {registration.decisionReason}
        </p>
      )}
      {registration.status === "PENDING" && decisionsOpen && (
        <>
          {rejecting ? (
            <form
              className="request-rejection"
              onSubmit={form.handleSubmit((values) =>
                decide({ outcome: "decline", reason: values.reason }),
              )}
            >
              <FormField
                id={`reason-${registration.id}`}
                label="Причина отказа (необязательно)"
                error={form.formState.errors.reason?.message}
                hint="Заявитель увидит эту причину."
              >
                <Textarea
                  id={`reason-${registration.id}`}
                  {...form.register("reason")}
                  placeholder="Объясните участнику причину отказа"
                  maxLength={1000}
                  rows={3}
                  disabled={mutation.isPending}
                  aria-invalid={Boolean(form.formState.errors.reason)}
                  aria-describedby={
                    form.formState.errors.reason
                      ? `reason-${registration.id}-error`
                      : `reason-${registration.id}-hint`
                  }
                />
              </FormField>
              <div className="request-actions">
                <button
                  className="button danger-button"
                  type="submit"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending
                    ? "Сохраняем решение…"
                    : "Подтвердить отказ"}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => {
                    restoreFocus.current = true;
                    setRejecting(false);
                    mutation.reset();
                  }}
                >
                  Отмена
                </button>
              </div>
            </form>
          ) : (
            <div className="request-actions">
              <button
                className="button primary"
                disabled={mutation.isPending}
                onClick={() => decide({ outcome: "accept" })}
              >
                <Check size={18} />
                {mutation.isPending ? "Сохраняем решение…" : "Одобрить"}
              </button>
              <button
                className="button secondary"
                ref={cancelTarget}
                disabled={mutation.isPending}
                onClick={() => {
                  setRejecting(true);
                  mutation.reset();
                }}
              >
                <X size={18} />
                Отклонить
              </button>
            </div>
          )}
          {mutation.isError && (
            <p className="field-error" role="alert">
              {mutation.error instanceof RegistrationFailure &&
              mutation.error.code === "full"
                ? "Свободных мест больше нет. Заявка остаётся на рассмотрении."
                : registrationErrorMessage(mutation.error)}
            </p>
          )}
        </>
      )}
    </li>
  );
}
