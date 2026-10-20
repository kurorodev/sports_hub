import { Textarea } from "../../../shared/ui/Textarea";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionQuery } from "../../../entities/session";
import {
  OrganizationCard,
  organizationErrorMessage,
  useOrganizationRepository,
} from "../../../entities/organization";
import type {
  Organization,
  OrganizationDecision,
} from "../../../entities/organization/model";
import { FormField } from "../../../shared/ui/FormField";
import { reviewOrganization } from "../model/review-organization";
const schema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Укажите причину: от 3 символов")
    .max(1000, "Причина — до 1000 символов"),
});
export function OrganizationDecisionCard({
  organization,
  viewerId,
  onDecided,
}: {
  organization: Organization;
  viewerId: string;
  onDecided: (organization: Organization) => void;
}) {
  const repo = useOrganizationRepository();
  const client = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { reason: "" },
  });
  const mutation = useMutation({
    mutationFn: (decision: OrganizationDecision) =>
      reviewOrganization(repo, organization.id, decision),
    onSuccess: (result) => {
      if (client.getQueryData(sessionQuery.queryKey)?.user.id !== viewerId)
        return;
      setRejecting(false);
      onDecided(result);
    },
  });
  useEffect(() => {
    if (rejecting) form.setFocus("reason");
  }, [rejecting, form]);
  const reasonId = `organization-reason-${organization.id}`;
  return (
    <OrganizationCard organization={organization}>
      {organization.status === "PENDING" && (
        <>
          <div className="request-actions">
            <button
              className="button primary"
              disabled={mutation.isPending || rejecting}
              onClick={() => mutation.mutate({ outcome: "approve" })}
            >
              {mutation.isPending && !rejecting
                ? "Одобряем…"
                : "Одобрить организацию"}
            </button>
            <button
              ref={trigger}
              className="button secondary"
              disabled={mutation.isPending}
              onClick={() => {
                setRejecting(true);
                mutation.reset();
              }}
            >
              Отклонить организацию
            </button>
          </div>
          {rejecting && (
            <form
              className="request-rejection"
              noValidate
              onSubmit={form.handleSubmit(({ reason }) =>
                mutation.mutate({ outcome: "reject", reason }),
              )}
            >
              <FormField
                id={reasonId}
                label="Причина отказа"
                hint="Обязательна: от 3 до 1000 символов. Представитель увидит её."
                error={form.formState.errors.reason?.message}
              >
                <Textarea
                  id={reasonId}
                  {...form.register("reason")}
                  placeholder="Объясните представителю причину отказа"
                  rows={3}
                  maxLength={1000}
                  disabled={mutation.isPending}
                  aria-invalid={Boolean(form.formState.errors.reason)}
                  aria-describedby={
                    form.formState.errors.reason
                      ? `${reasonId}-error`
                      : `${reasonId}-hint`
                  }
                />
              </FormField>
              <div className="request-actions">
                <button
                  className="button danger-button"
                  disabled={mutation.isPending}
                  type="submit"
                >
                  {mutation.isPending
                    ? "Отклоняем…"
                    : "Подтвердить отказ организации"}
                </button>
                <button
                  className="button secondary"
                  disabled={mutation.isPending}
                  type="button"
                  onClick={() => {
                    setRejecting(false);
                    mutation.reset();
                    trigger.current?.focus();
                  }}
                >
                  Отмена
                </button>
              </div>
            </form>
          )}
        </>
      )}
      {mutation.isError && (
        <p className="field-error" role="alert">
          {organizationErrorMessage(mutation.error)} Причина сохранена.
        </p>
      )}
    </OrganizationCard>
  );
}
