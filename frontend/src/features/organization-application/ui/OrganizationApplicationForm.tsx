import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { Textarea } from "../../../shared/ui/Textarea";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
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
  useLocale();
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
  const selectedSports = useWatch({ control: form.control, name: "sportIds" });
  const visibleSports = sports.filter((sport) =>
    sportSearch.trim()
      ? sport.name
          .toLocaleLowerCase("ru")
          .includes(sportSearch.trim().toLocaleLowerCase("ru"))
      : selectedSports.includes(sport.id),
  );
  return (
    <form
      className="organization-form"
      noValidate
      onSubmit={form.handleSubmit((input) => mutation.mutate(input))}
    >
      <fieldset disabled={mutation.isPending}>
        <legend>{tr("Новая заявка организации")}</legend>
        <FormField
          id="organization-name"
          label={tr("Название организации")}
          error={error.name?.message}
        >
          <input
            id="organization-name"
            placeholder={tr("Например, беговой клуб «Темп»")}
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
          label={tr("О вашей организации")}
          hint={tr(
            "Чем занимаетесь, кого ждёте на встречах. От 10 до 2000 символов.",
          )}
          error={error.description?.message}
        >
          <Textarea
            id="organization-description"
            placeholder={tr(
              "Расскажите, какие тренировки и мероприятия вы проводите и кого ждёте",
            )}
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
          label={tr("Найти вид спорта организации")}
          hint={tr("Необязательно. Найдите и отметьте нужные направления.")}
        >
          <input
            id="organization-sport-search"
            type="search"
            value={sportSearch}
            onChange={(event) => setSportSearch(event.target.value)}
            placeholder={tr("Например, шахматы")}
            aria-describedby="organization-sport-search-hint"
          />
        </FormField>
        <fieldset className="organization-sports">
          <legend>
            {tr("Выбрано видов спорта: ")}
            {selectedSports.length}
          </legend>
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
            <p className="field-hint" role="status">
              {sportSearch.trim()
                ? tr("По этому запросу виды спорта не найдены.")
                : tr("Начните вводить название вида спорта.")}
            </p>
          )}
        </fieldset>
      </fieldset>
      <p className="join-note">
        {tr(
          "До одобрения администратора публикация от имени организации недоступна. Личные встречи можно создавать сразу.",
        )}
      </p>
      {mutation.isError && (
        <p className="field-error" role="alert">
          {tr(organizationErrorMessage(mutation.error))}
          {tr(" Данные формы сохранены.")}
        </p>
      )}
      <button
        className="button primary"
        disabled={mutation.isPending}
        type="submit"
      >
        {mutation.isPending
          ? tr("Отправляем заявку…")
          : tr("Отправить заявку организации")}
      </button>
    </form>
  );
}
