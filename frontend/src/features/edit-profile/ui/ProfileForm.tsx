import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { sportsQuery } from "../../../entities/event";
import {
  profileErrorMessage,
  sportRoleLabels,
  levelLabels,
  timeLabels,
} from "../../../entities/profile";
import {
  profileDraft,
  safeAvatarUrl,
  sportRoles,
  experienceLevels,
  preferredTimes,
  type Profile,
} from "../../../entities/profile/model";
import { FormField } from "../../../shared/ui/FormField";
import { ErrorState } from "../../../shared/ui/Feedback";
import { useUpdateProfile } from "./use-update-profile";
const schema = z.object({
  handle: z
    .string()
    .trim()
    .min(3, "Никнейм — от 3 символов")
    .max(40, "Никнейм — до 40 символов"),
  name: z
    .string()
    .trim()
    .min(1, "Укажите имя")
    .max(100, "Имя — до 100 символов"),
  firstName: z.string().trim().max(80, "До 80 символов"),
  lastName: z.string().trim().max(80, "До 80 символов"),
  about: z.string().trim().max(1000, "Описание — до 1000 символов"),
  city: z.string().trim().max(100, "Город — до 100 символов"),
  avatarUrl: z
    .string()
    .trim()
    .refine(
      (value) => !value || safeAvatarUrl(value),
      "Укажите ссылку http или https без логина и пароля, до 2048 символов",
    ),
  roles: z.array(z.enum(sportRoles)),
  preferences: z.array(
    z.object({ sportId: z.string().uuid(), level: z.enum(experienceLevels) }),
  ),
  preferredTime: z.union([z.enum(preferredTimes), z.literal("")]),
});
type Values = z.infer<typeof schema>;
export function ProfileForm({
  profile,
  onSaved,
  onCancel,
}: {
  profile: Profile;
  onSaved: (profile: Profile) => void;
  onCancel: () => void;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: profileDraft(profile),
  });
  const preferences = useFieldArray({
    control: form.control,
    name: "preferences",
  });
  const sports = useQuery(sportsQuery);
  const mutation = useUpdateProfile(onSaved);
  const errors = form.formState.errors;
  const fields = [
    ["name", "Имя в профиле", 100],
    ["handle", "Никнейм", 40],
    ["firstName", "Имя (необязательно)", 80],
    ["lastName", "Фамилия (необязательно)", 80],
    ["city", "Город", 100],
    ["avatarUrl", "Ссылка на аватар", 2048],
  ] as const;
  return (
    <form
      className="profile-form"
      noValidate
      onSubmit={form.handleSubmit((draft) =>
        mutation.mutate({ viewerId: profile.id, draft }),
      )}
    >
      <h1>Редактировать профиль</h1>
      <p className="muted">
        Эти данные видны в публичном профиле. Указывайте то, чем готовы
        поделиться.
      </p>
      <fieldset disabled={mutation.isPending}>
        <legend>Знакомство</legend>
        <div className="profile-form-grid">
          {fields.map(([field, label, max]) => (
            <FormField
              key={field}
              id={`profile-${field}`}
              label={label}
              error={errors[field]?.message}
              hint={
                field === "avatarUrl"
                  ? "Аватар по ссылке. Если изображение недоступно, покажем первую букву имени."
                  : undefined
              }
            >
              <input
                id={`profile-${field}`}
                {...form.register(field)}
                maxLength={max}
                autoComplete={
                  field === "firstName"
                    ? "given-name"
                    : field === "lastName"
                      ? "family-name"
                      : field === "city"
                        ? "address-level2"
                        : "off"
                }
                aria-invalid={Boolean(errors[field])}
                aria-describedby={
                  errors[field]
                    ? `profile-${field}-error`
                    : field === "avatarUrl"
                      ? "profile-avatarUrl-hint"
                      : undefined
                }
              />
            </FormField>
          ))}
        </div>
        <FormField
          id="profile-about"
          label="О себе"
          hint="До 1000 символов. Например, какой спорт любите и какую компанию ищете."
          error={errors.about?.message}
        >
          <textarea
            id="profile-about"
            {...form.register("about")}
            rows={5}
            maxLength={1000}
            aria-invalid={Boolean(errors.about)}
            aria-describedby={
              errors.about ? "profile-about-error" : "profile-about-hint"
            }
          />
        </FormField>
        <FormField id="profile-time" label="Когда удобно заниматься">
          <select id="profile-time" {...form.register("preferredTime")}>
            <option value="">Не указано</option>
            {preferredTimes.map((value) => (
              <option value={value} key={value}>
                {timeLabels[value]}
              </option>
            ))}
          </select>
        </FormField>
      </fieldset>
      <fieldset disabled={mutation.isPending}>
        <legend>Спортивные роли</legend>
        <p className="field-hint">
          Роли описывают ваш опыт. Они не дают административных прав или доступа
          к чужим соревнованиям.
        </p>
        <div className="profile-role-options">
          {sportRoles.map((role) => (
            <label key={role}>
              <input type="checkbox" value={role} {...form.register("roles")} />
              {sportRoleLabels[role]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={mutation.isPending}>
        <legend>Любимые виды спорта</legend>
        <p className="field-hint">
          Выберите интересы и свой уровень. Их можно изменить или убрать.
        </p>
        {sports.isPending ? (
          <p role="status">Загружаем виды спорта…</p>
        ) : sports.isError ? (
          <ErrorState
            error={sports.error}
            retry={() => void sports.refetch()}
          />
        ) : (
          <div className="profile-sport-options">
            {sports.data.map((sport) => {
              const index = preferences.fields.findIndex(
                (item) => item.sportId === sport.id,
              );
              return (
                <label key={sport.id}>
                  <input
                    type="checkbox"
                    checked={index >= 0}
                    onChange={(event) =>
                      event.target.checked
                        ? preferences.append({
                            sportId: sport.id,
                            level: "BEGINNER",
                          })
                        : preferences.remove(index)
                    }
                  />
                  {sport.name}
                </label>
              );
            })}
          </div>
        )}
        {preferences.fields.map((item, index) => (
          <div className="profile-preference-row" key={item.id}>
            <FormField
              id={`profile-level-${item.sportId}`}
              label={`Уровень: ${sports.data?.find((sport) => sport.id === item.sportId)?.name ?? "Вид спорта недоступен"}`}
              error={errors.preferences?.[index]?.level?.message}
            >
              <select
                id={`profile-level-${item.sportId}`}
                {...form.register(`preferences.${index}.level`)}
              >
                {experienceLevels.map((level) => (
                  <option key={level} value={level}>
                    {levelLabels[level]}
                  </option>
                ))}
              </select>
            </FormField>
            <button
              className="button secondary"
              type="button"
              onClick={() => preferences.remove(index)}
            >
              Убрать интерес
            </button>
          </div>
        ))}
      </fieldset>
      {mutation.isError && (
        <p className="field-error" role="alert">
          {profileErrorMessage(mutation.error)} Введённые данные сохранены,
          можно повторить отправку.
        </p>
      )}
      <div className="profile-form-actions">
        <button
          className="button primary"
          type="submit"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Сохраняем профиль…" : "Сохранить профиль"}
          <Save size={18} />
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={mutation.isPending}
          onClick={onCancel}
        >
          Отменить изменения
        </button>
      </div>
    </form>
  );
}
