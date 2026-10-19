import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionQuery } from "../../../entities/session";
import {
  organizationErrorMessage,
  useOrganizationRepository,
} from "../../../entities/organization";
import type { Organization } from "../../../entities/organization/model";
import { FormField } from "../../../shared/ui/FormField";
import { applyOrganization } from "../model/apply-organization";
const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Название — от 2 символов")
    .max(160, "Название — до 160 символов"),
  description: z
    .string()
    .trim()
    .min(10, "Описание — от 10 символов")
    .max(2000, "Описание — до 2000 символов"),
  sportIds: z.array(z.string().uuid()),
});
type Values = z.infer<typeof schema>;
export function OrganizationApplicationForm({
  viewerId,
  sports,
  onCreated,
}: {
  viewerId: string;
  sports: { id: string; name: string }[];
  onCreated: (organization: Organization) => void;
}) {
  const repo = useOrganizationRepository();
  const client = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "", sportIds: [] },
  });
  const mutation = useMutation({
    mutationFn: (input: Values) => applyOrganization(repo, input, viewerId),
    onSuccess: (organization) => {
      if (client.getQueryData(sessionQuery.queryKey)?.user.id !== viewerId)
        return;
      form.reset();
      setSportSearch("");
      onCreated(organization);
    },
  });
  const error = form.formState.errors;
  const [sportSearch, setSportSearch] = useState("");
  const visibleSports = sports.filter((sport) =>
    sport.name
      .toLocaleLowerCase("ru")
      .includes(sportSearch.trim().toLocaleLowerCase("ru")),
  );
  return (
    <form
      className="organization-form"
      noValidate
      onSubmit={form.handleSubmit((input) => mutation.mutate(input))}
    >
      <fieldset disabled={mutation.isPending}>
        <legend>Новая заявка организации</legend>
        <FormField
          id="organization-name"
          label="Название организации"
          error={error.name?.message}
        >
          <input
            id="organization-name"
            {...form.register("name")}
            maxLength={160}
            required
            aria-invalid={Boolean(error.name)}
            aria-describedby={
              error.name ? "organization-name-error" : undefined
            }
          />
        </FormField>
        <FormField
          id="organization-description"
          label="О вашей организации"
          hint="Чем занимаетесь, кого ждёте на встречах. От 10 до 2000 символов."
          error={error.description?.message}
        >
          <textarea
            id="organization-description"
            {...form.register("description")}
            rows={4}
            maxLength={2000}
            required
            aria-invalid={Boolean(error.description)}
            aria-describedby={
              error.description
                ? "organization-description-error"
                : "organization-description-hint"
            }
          />
        </FormField>
        <FormField
          id="organization-sport-search"
          label="Найти вид спорта организации"
        >
          <input
            id="organization-sport-search"
            type="search"
            value={sportSearch}
            onChange={(event) => setSportSearch(event.target.value)}
            placeholder="Например, шахматы"
          />
        </FormField>
        <fieldset className="organization-sports">
          <legend>Виды спорта (необязательно)</legend>
          {sports.map((sport) => (
            <label key={sport.id} hidden={!visibleSports.includes(sport)}>
              <input
                type="checkbox"
                value={sport.id}
                {...form.register("sportIds")}
              />
              {sport.name}
            </label>
          ))}
          {visibleSports.length === 0 && (
            <p role="status">По этому запросу виды спорта не найдены.</p>
          )}
        </fieldset>
      </fieldset>
      <p className="join-note">
        До одобрения администратора публикация от имени организации недоступна.
        Личные встречи можно создавать сразу.
      </p>
      {mutation.isError && (
        <p className="field-error" role="alert">
          {organizationErrorMessage(mutation.error)} Данные формы сохранены.
        </p>
      )}
      <button
        className="button primary"
        disabled={mutation.isPending}
        type="submit"
      >
        {mutation.isPending
          ? "Отправляем заявку…"
          : "Отправить заявку организации"}
      </button>
    </form>
  );
}
