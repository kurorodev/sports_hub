import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "../../../shared/ui/FormField";
import { moderationErrorMessage } from "../../../entities/moderation";
const schema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Укажите причину: от 3 символов")
    .max(1000, "Причина — до 1000 символов"),
});
export function ModerationReasonForm({
  id,
  action,
  consequence,
  pending,
  error,
  onConfirm,
}: {
  id: string;
  action: string;
  consequence: string;
  pending: boolean;
  error: unknown;
  onConfirm: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const restore = useRef(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { reason: "" },
  });
  useEffect(() => {
    if (open) form.setFocus("reason");
    else if (restore.current) {
      trigger.current?.focus();
      restore.current = false;
    }
  }, [open, form]);
  return (
    <div className="moderation-action">
      {!open ? (
        <button
          ref={trigger}
          className="button secondary"
          onClick={() => setOpen(true)}
        >
          {action}
        </button>
      ) : (
        <form
          noValidate
          className="moderation-reason-form"
          onSubmit={form.handleSubmit(({ reason }) => onConfirm(reason))}
        >
          <p>{consequence}</p>
          <FormField
            id={`moderation-reason-${id}`}
            label="Причина модерации"
            hint="Обязательна: от 3 до 1000 символов."
            error={form.formState.errors.reason?.message}
          >
            <textarea
              id={`moderation-reason-${id}`}
              {...form.register("reason")}
              rows={3}
              maxLength={1000}
              disabled={pending}
              aria-invalid={Boolean(form.formState.errors.reason)}
              aria-describedby={
                form.formState.errors.reason
                  ? `moderation-reason-${id}-error`
                  : `moderation-reason-${id}-hint`
              }
            />
          </FormField>
          {Boolean(error) && (
            <p className="field-error" role="alert">
              {moderationErrorMessage(error)} Причина сохранена.
            </p>
          )}
          <div className="request-actions">
            <button
              className="button danger-button"
              type="submit"
              disabled={pending}
            >
              {pending
                ? "Сохраняем решение…"
                : `Подтвердить: ${action.toLocaleLowerCase("ru")}`}
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={pending}
              onClick={() => {
                restore.current = true;
                setOpen(false);
              }}
            >
              Отмена
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
